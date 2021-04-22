/*
 * "Commons Clause" License Condition v1.0
 *
 * The Software is provided to you by the Licensor under the
 * License, as defined below, subject to the following condition.
 *
 * Without limiting other conditions in the License, the grant
 * of rights under the License will not include, and the
 * License does not grant to you, the right to Sell the Software.
 *
 * For purposes of the foregoing, "Sell" means practicing any
 * or all of the rights granted to you under the License to
 * provide to third parties, for a fee or other consideration
 * (including without limitation fees for hosting or
 * consulting/ support services related to the Software), a
 * product or service whose value derives, entirely or substantially,
 * from the functionality of the Software. Any
 * license notice or attribution required by the License must
 * also include this Commons Clause License Condition notice.
 *
 * License: LGPL 2.1 or later
 * Licensor: metaphacts GmbH
 *
 * Copyright (C) 2015-2021, metaphacts GmbH
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, you can receive a copy
 * of the GNU Lesser General Public License from http://www.gnu.org/
 */
package com.metaphacts.services.storage.git;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;

import javax.annotation.Nullable;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.jgit.api.CloneCommand;
import org.eclipse.jgit.api.CommitCommand;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.MergeCommand;
import org.eclipse.jgit.api.PullCommand;
import org.eclipse.jgit.api.PushCommand;
import org.eclipse.jgit.api.ResetCommand;
import org.eclipse.jgit.api.TransportCommand;
import org.eclipse.jgit.api.TransportConfigCallback;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.api.errors.InvalidRemoteException;
import org.eclipse.jgit.api.errors.RefAlreadyExistsException;
import org.eclipse.jgit.api.errors.RefNotFoundException;
import org.eclipse.jgit.api.errors.TransportException;
import org.eclipse.jgit.dircache.DirCache;
import org.eclipse.jgit.dircache.DirCacheBuilder;
import org.eclipse.jgit.dircache.DirCacheEntry;
import org.eclipse.jgit.errors.IncorrectObjectTypeException;
import org.eclipse.jgit.errors.InvalidObjectIdException;
import org.eclipse.jgit.internal.storage.file.FileRepository;
import org.eclipse.jgit.lib.CommitBuilder;
import org.eclipse.jgit.lib.Constants;
import org.eclipse.jgit.lib.FileMode;
import org.eclipse.jgit.lib.ObjectId;
import org.eclipse.jgit.lib.ObjectInserter;
import org.eclipse.jgit.lib.ObjectLoader;
import org.eclipse.jgit.lib.ObjectReader;
import org.eclipse.jgit.lib.PersonIdent;
import org.eclipse.jgit.lib.Ref;
import org.eclipse.jgit.lib.RefUpdate;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.revwalk.RevCommit;
import org.eclipse.jgit.revwalk.RevTag;
import org.eclipse.jgit.revwalk.RevTree;
import org.eclipse.jgit.revwalk.RevWalk;
import org.eclipse.jgit.transport.JschConfigSessionFactory;
import org.eclipse.jgit.transport.OpenSshConfig.Host;
import org.eclipse.jgit.transport.PushResult;
import org.eclipse.jgit.transport.RemoteConfig;
import org.eclipse.jgit.transport.RemoteRefUpdate;
import org.eclipse.jgit.transport.SshSessionFactory;
import org.eclipse.jgit.transport.SshTransport;
import org.eclipse.jgit.transport.Transport;
import org.eclipse.jgit.transport.URIish;
import org.eclipse.jgit.transport.UsernamePasswordCredentialsProvider;
import org.eclipse.jgit.treewalk.TreeWalk;
import org.eclipse.jgit.treewalk.filter.AndTreeFilter;
import org.eclipse.jgit.treewalk.filter.PathFilter;
import org.eclipse.jgit.treewalk.filter.TreeFilter;
import org.eclipse.jgit.util.FS;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.Lists;
import com.google.common.util.concurrent.ThreadFactoryBuilder;
import com.jcraft.jsch.JSch;
import com.jcraft.jsch.JSchException;
import com.jcraft.jsch.Session;
import com.metaphacts.services.storage.StorageUtils;
import com.metaphacts.services.storage.api.ObjectMetadata;
import com.metaphacts.services.storage.api.ObjectMetadata.ObjectMetadataBuilder;
import com.metaphacts.services.storage.api.ObjectRecord;
import com.metaphacts.services.storage.api.ObjectStorage;
import com.metaphacts.services.storage.api.PathMapping;
import com.metaphacts.services.storage.api.SizedStream;
import com.metaphacts.services.storage.api.StorageException;
import com.metaphacts.services.storage.api.StorageLocation;
import com.metaphacts.services.storage.api.StoragePath;
import com.metaphacts.services.storage.api.Tag;
import com.metaphacts.services.storage.api.VersionedObjectStorage;

/**
 * An {@link ObjectStorage} implementation that makes use of a local GIT
 * repository, potentially synching changes to a configured remote.
 * 
 * <p>
 * If the Git repository does not exist in the file system, the Git Storage
 * attempts to clone the repository (if a remote is configured) or initialize an
 * empty one with an initial commit. Configuration of a remote is optional. If a
 * remote is configured, the configured branch must exist.
 * </p>
 * 
 * <p>
 * The GitStorage supports different authentication methods. By default (if no
 * external authentication information is provided) it uses the built-in
 * mechanism, i.e. the openssh configuration from the user's <i>~/.ssh</i>
 * config or the credentials provided as part of the URL. In addition to the
 * built-in mechanisms a private key (SSH connections) or credentials (HTTPS)
 * can be configured with the {@link GitStorageConfig}.
 * </p>
 * 
 * <p>
 * The general approach is that commits are always synchronously done to the
 * local GIT repository. All remote push operations are added to a queue and are
 * executed as background operations.
 * </p>
 * 
 * <p>
 * The assumption of the {@link GitStorage} is that it is typically the only
 * client interacting with the remote GIT repository.
 * </p>
 * 
 * <p>
 * If a remote GIT push fails (e.g. due to a non-fast-forward push), the local
 * commit will always be kept, and a warning is written to the log. It is left
 * to the system administrator to bring the local and remote GIT repositories
 * back into synch. Note that temporary outages (e.g. the remote is not
 * reachable) are recovered automatically with the next push operation, i.e. in
 * that case a number of locally available commits are pushed to the remote as
 * fast-forward operation.
 * </p>
 * 
 * @author Alexey Morozov
 * @author Andreas Schwarte
 *
 */
public class GitStorage implements VersionedObjectStorage {
    private static final Logger logger = LogManager.getLogger(GitStorage.class);

    public static final String STORAGE_TYPE = "git";

    private final PathMapping paths;
    private final GitStorageConfig config;

    private Repository repository;
    private final ReadWriteLock lock = new ReentrantReadWriteLock();

    private ExecutorService executor;

    // ssh session factory with customized connection settings (if configured)
    // otherwise use default built-in
    private Optional<SshSessionFactory> sshSessionFactory = Optional.empty();


    public GitStorage(PathMapping paths, GitStorageConfig config) throws StorageException {
        this.paths = paths;
        this.config = config;

        initialize();
    }

    private void initialize() throws StorageException {

        sshSessionFactory = initializeSshAuthenticationFactory();

        Path gitFolder = config.getLocalPath().resolve(".git");
        try {
            if (!Files.isDirectory(gitFolder)) {
                // try to create local directory, if it is permitted
                StorageUtils.mkdirs(config.getLocalPath());
                if (config.getRemoteUrl() != null) {
                    cloneRepository();
                } else {
                    createEmptyLocalRepository();
                }
            }
            initializeExisting(gitFolder);
        } catch (IOException | GitAPIException e) {
            String details = "";
            if (e instanceof TransportException) {
                details = "\nDetails: error while establishing connection, check the authentication method.";
            }
            else if (e instanceof RefNotFoundException) {
                details = "\nDetails: " + e.getMessage();
            } else if (e instanceof InvalidRemoteException) {
                // this is the case if the user is authenticated, but does not see the requested
                // repository (e.g no permissions to see a private github repo)
                details = "\nDetails: not possible to access the remote, check the authentication method.";
            }
            throw new StorageException(
                    "Failed to open Git repository at: " + config.getLocalPath() + details, e);
        }

        executor = Executors
                .newSingleThreadExecutor(new ThreadFactoryBuilder().setNameFormat("git-storage-%d").build());
    }

    private void cloneRepository() throws GitAPIException, IOException {
        logger.info("Cloning remote repository <{}> at {}, Branch: {}", config.getRemoteUrl(), config.getLocalPath(),
                config.getBranch());

        // uses built-in authentication or configured one
        CloneCommand cloneCommand = Git.cloneRepository()
                .setURI(config.getRemoteUrl())
                .setBranch(config.getBranch())
                .setDirectory(config.getLocalPath().toFile());

        configureTransport(cloneCommand);

        cloneCommand.call();
    }

    private void createEmptyLocalRepository() throws GitAPIException, IOException {
        logger.info("Creating empty local repository at " + config.getLocalPath());
        
        Git localGit = Git.init().setDirectory(config.getLocalPath().toFile()).call();

        CommitCommand commit = localGit.commit();
        commit.setMessage("initial commit").call();
        
        if (config.getBranch() != null) {
            boolean branchExists = localGit.branchList().call().stream()
                    .anyMatch(ref -> ref.getName().equals("refs/heads/" + config.getBranch()));
            if (!branchExists) {
                localGit.branchCreate().setName(config.getBranch()).call();
            }
        }

    }

    private void initializeExisting(Path gitFolder) throws GitAPIException, IOException {
        repository = new FileRepository(gitFolder.toFile());
        try (Git git = new Git(repository)) {
            assertCleanWorkTree(git);

            if (config.getRemoteUrl() != null) {
                RemoteConfig origin = git.remoteList().call().stream()
                    .filter(r -> r.getName().equals("origin"))
                    .findFirst()
                    .orElseThrow(() -> new StorageException(
                        "Git repository is required to have 'origin' remote when 'remoteUrl' is set"
                    ));
                URIish originUri = origin.getURIs().size() == 1 ? origin.getURIs().get(0) : null;
                if (originUri == null || !originUri.toPrivateString().equals(config.getRemoteUrl())) {
                    throw new StorageException(
                        "'origin' remote is inconsistent with storage configuration"
                    );
                }
            }

            if (config.getBranch() != null && !config.getBranch().equals(repository.getBranch())) {
                logger.info("Checking out branch '" +
                    config.getBranch() + "' at " + config.getLocalPath());
                git.checkout().setName(config.getBranch()).call();
            }
        } catch (GitAPIException | IOException e) {
            repository.close();
            throw e;
        }
    }

    @Override
    public String getDescription() {
        StringBuilder sb = new StringBuilder();
        sb.append("Git: ");
        if (config.getRemoteUrl() != null) {
            sb.append(config.getRemoteUrl());
        } else {
            sb.append("local repository");
        }
        sb.append(" (Branch: ").append(Optional.ofNullable(config.getBranch()).orElse("n/a")).append(")");

        return sb.toString();
    }

    @Override
    public synchronized void close() throws StorageException {

        if (executor != null) {
            executor.shutdown();
            try {
                executor.awaitTermination(30, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                executor.shutdownNow();
            }
        }
    }

    public Path getLocation() {
        return config.getLocalPath();
    }

    private final class GitStorageLocation implements StorageLocation {
        private ObjectId blobId;

        public GitStorageLocation(ObjectId blobId) {
            this.blobId = blobId;
        }

        @Override
        public ObjectStorage getStorage() {
            return GitStorage.this;
        }

        @Override
        public SizedStream readSizedContent() throws IOException {
            ObjectLoader loader = repository.open(blobId, Constants.OBJ_BLOB);
            return new SizedStream(loader.openStream(), loader.getSize());
        }
    }

    @Override
    public boolean isMutable() {
        return config.isMutable();
    }

    @Override
    public Optional<ObjectRecord> getObject(
        StoragePath path,
        @Nullable String revision
    ) throws StorageException {
        Optional<StoragePath> mappedPath = paths.mapForward(path);
        if (!mappedPath.isPresent()) {
            return Optional.empty();
        }

        try {
            lock.readLock().lock();
            try (RevWalk walk = new RevWalk(repository)) {
                PathFilter pathFilter = PathFilter.create(mappedPath.get().toString());

                if (revision == null) {
                    ObjectId headCommitId = repository.resolve(Constants.HEAD);
                    RevCommit headCommit = parseCommitOrNull(walk, headCommitId);
                    if (headCommit == null) {
                        return Optional.empty();
                    }

                    // return nothing if object is missing from HEAD commit,
                    // even if it's still present in the Git history
                    if (!lookupRecord(path, headCommit, pathFilter).isPresent()) {
                        return Optional.empty();
                    }

                    walk.markStart(headCommit);
                    walk.setTreeFilter(AndTreeFilter.create(pathFilter, TreeFilter.ANY_DIFF));
                    for (RevCommit commit : walk) {
                        return lookupRecord(path, commit, pathFilter);
                    }
                    return Optional.empty();
                } else {
                    ObjectId targetCommitId;
                    try {
                        targetCommitId = ObjectId.fromString(revision);
                    } catch (InvalidObjectIdException e) {
                        return Optional.empty();
                    }
                    RevCommit commit = parseCommitOrNull(walk, targetCommitId);
                    if (commit == null) {
                        return Optional.empty();
                    }
                    return lookupRecord(path, commit, pathFilter);
                }
            }
        } catch (IOException e) {
            throw new StorageException(e);
        } finally {
            lock.readLock().unlock();
        }
    }

    @Override
    public List<ObjectRecord> getRevisions(StoragePath path) throws StorageException {
        Optional<StoragePath> mappedPath = paths.mapForward(path);
        if (!mappedPath.isPresent()) {
            return ImmutableList.of();
        }

        try {
            lock.readLock().lock();
            try (RevWalk walk = new RevWalk(repository)) {
                PathFilter pathFilter = PathFilter.create(mappedPath.get().toString());

                ObjectId headCommitId = repository.resolve(Constants.HEAD);
                RevCommit headCommit = parseCommitOrNull(walk, headCommitId);
                if (headCommit == null) {
                    return ImmutableList.of();
                }
                walk.markStart(headCommit);
                walk.setTreeFilter(AndTreeFilter.create(pathFilter, TreeFilter.ANY_DIFF));

                List<ObjectRecord> records = new ArrayList<>();
                for (RevCommit commit : walk) {
                    Optional<ObjectRecord> foundRecord = lookupRecord(path, commit, pathFilter);
                    if (foundRecord.isPresent()) {
                        records.add(foundRecord.get());
                    }
                }
                return records;
            }
        } catch (IOException e) {
            throw new StorageException(e);
        } finally {
            lock.readLock().unlock();
        }
    }

    @Override
    public List<ObjectRecord> getAllObjects(StoragePath prefix) throws StorageException {
        Optional<StoragePath> mappedPrefix = paths.mapForward(prefix);
        if (!mappedPrefix.isPresent()) {
            return ImmutableList.of();
        }

        try {
            lock.readLock().lock();
            try (RevWalk walk = new RevWalk(repository)) {
                TreeFilter pathFilter = mappedPrefix.get().isEmpty()
                    ? TreeFilter.ALL
                    : PathFilter.create(mappedPrefix.get().toString() + "/");

                ObjectId headCommitId = repository.resolve(Constants.HEAD);
                RevCommit headCommit = parseCommitOrNull(walk, headCommitId);
                if (headCommit == null) {
                    return ImmutableList.of();
                }

                try (TreeWalk treeWalk = new TreeWalk(repository)) {
                    treeWalk.addTree(headCommit.getTree());
                    treeWalk.setRecursive(true);
                    treeWalk.setFilter(pathFilter);

                    List<ObjectRecord> records = new ArrayList<>();

                    while (treeWalk.next()) {
                        String path = treeWalk.getPathString();
                        Optional<StoragePath> mappedObjectId = StoragePath.tryParse(path).flatMap(paths::mapBack);
                        if (mappedObjectId.isPresent()) {
                            Optional<ObjectRecord> record = getObject(mappedObjectId.get(), null);
                            if (record.isPresent()) {
                                records.add(record.get());
                            }
                        }
                    }

                    return records;
                }
            }
        } catch (IOException e) {
            throw new StorageException(e);
        } finally {
            lock.readLock().unlock();
        }
    }

    @Override
    public ObjectRecord appendObject(
        StoragePath path,
        ObjectMetadata metadata,
        InputStream content,
        long contentLength
    ) throws StorageException {
        StorageUtils.throwIfNonMutable(config.isMutable());

        StoragePath objectPath = paths.mapForward(path).orElseThrow(() ->
            new StorageException(String.format("Cannot map object path: %s", path))
        );
        String message = metadata.getComment() != null ? metadata.getComment() : "Append: " + objectPath;
        PersonIdent author = createAuthorFromMetadata(metadata.withCurrentDate());

        RevCommit commit;
        try {
            lock.writeLock().lock();

            ObjectId insertedBlobId;
            try (ObjectInserter inserter = repository.newObjectInserter()) {
                insertedBlobId = inserter.insert(Constants.OBJ_BLOB, contentLength, content);
                inserter.flush();
            } catch (IOException e) {
                throw new StorageException(
                    "Failed to insert object content into Git object database", e);
            }

            try {
                commit = performAttemptsToCommitAndPushChanges(
                    objectPath, insertedBlobId, author, message
                );
            } catch (IOException | GitAPIException e) {
                throw new StorageException(e);
            }
        } finally {
            lock.writeLock().unlock();
        }

        try {
            lock.readLock().lock();
            return lookupRecord(path, commit, PathFilter.create(objectPath.toString()))
                .orElseThrow(() -> new StorageException(
                    "Failed to find newly committed object: " + objectPath));
        } catch (IOException e) {
            throw new StorageException(e);
        } finally {
            lock.readLock().unlock();
        }
    }

    @Override
    public void deleteObject(
        StoragePath path,
        ObjectMetadata metadata
    ) throws StorageException {
        StorageUtils.throwIfNonMutable(config.isMutable());

        StoragePath objectPath = paths.mapForward(path).orElseThrow(() ->
            new StorageException(String.format("Cannot map object path: %s", path)));
        String message = "Delete: " + objectPath;
        PersonIdent author = createAuthorFromMetadata(metadata.withCurrentDate());

        try {
            lock.writeLock().lock();
            performAttemptsToCommitAndPushChanges(objectPath, null, author, message);
        } catch (IOException | GitAPIException e) {
            throw new StorageException(e);
        } finally {
            lock.writeLock().unlock();
        }
    }

    /**
     * Tag a given revision
     * 
     * <p>
     * If there was no change in the tag, this method is a No-OP.
     * </p>
     * 
     * <p>
     * If a remote is configured this method pushes the tag to the upstream.
     * </p>
     * 
     * @param revision the revision identifier
     * @param tagName  the name of the tag
     * @param metadata additional {@link ObjectMetadata}
     * @throws StorageException if tag creation fails (e.g. if a tag with the
     *                          provided name already exists)
     */
    @Override
    public void tag(String revision, String tagName, ObjectMetadata metadata) throws StorageException {

        try {
            lock.writeLock().lock();

            try (Git git = new Git(repository)) {
                ObjectId id = repository.resolve(revision);
                try (RevWalk walk = new RevWalk(repository)) {
                    RevCommit commit = walk.parseCommit(id);
                    String comment = Optional.ofNullable(metadata.getComment()).orElse(tagName);
                    Ref tag = git.tag()
                            .setObjectId(commit)
                            .setName(tagName)
                            .setAnnotated(true)
                            .setMessage(comment)
                            .setTagger(createAuthorFromMetadata(metadata.withCurrentDate()))
                            .call();
                    logger.debug("Created tag " + tag + ".");
                    walk.dispose();

                    if (config.getRemoteUrl() != null) {
                        logger.debug("Pushing tags to remote repository...");
                        PushCommand push = git.push().setPushTags();
                        configureTransport(push);
                        push.call();
                    }
                }
            } catch (RefAlreadyExistsException e) {
                throw new StorageException("Tag with name " + tagName + " already exists");
            } catch (Exception e) {
                // special handling if there was no change
                // Note: unfortunately there is no specific exception type
                if (e.getMessage().contains("NO_CHANGE")) {
                    logger.debug("No change while creating tag: " + e.getMessage());
                    return;
                }

                throw new StorageException(
                        "Failed to create tag " + tagName + " on revision " + revision + ": " + e.getMessage(), e);
            }
        } finally {
            lock.writeLock().unlock();
        }
    }

    @Override
    public List<Tag> getTags() throws StorageException {

        List<Tag> res = Lists.newArrayList();

        try (Git git = new Git(repository)) {
            try {
                for (Ref tag : git.tagList().call()) {

                    try (RevWalk revWalk = new RevWalk(repository)) {
                        RevTag annotatedTag = revWalk.parseTag(tag.getObjectId());
                        String commitId = annotatedTag.getObject().getId().getName();
                        String tagName = annotatedTag.getTagName();

                        res.add(new GitTag(tagName, commitId));
                    } catch (IncorrectObjectTypeException ex) {
                        logger.warn("Failed to resolve tag {}: {}", tag.getName(), ex.getMessage());
                        logger.debug("Details:", ex);
                    }
                }

            } catch (GitAPIException e) {
                throw new StorageException(e);
            } catch (IOException e) {
                throw new StorageException(e);
            }
        }

        return res;
    }

    @Nullable
    private static RevCommit parseCommitOrNull(RevWalk walk, ObjectId commitId) throws IOException {
        if (commitId == null) {
            return null;
        }
        RevCommit commit = walk.lookupCommit(commitId);
        if (commit == null) {
            return null;
        }
        walk.parseHeaders(commit);
        walk.parseBody(commit);
        return commit;
    }

    private PersonIdent createAuthorFromMetadata(ObjectMetadata metadataWithDate) {
        return new PersonIdent(
            metadataWithDate.getAuthor() == null ? "" : metadataWithDate.getAuthor(),
            "", // set email as empty
            Date.from(metadataWithDate.getCreationDate()),
            TimeZone.getTimeZone("UTC")
        );
    }

    private RevCommit performAttemptsToCommitAndPushChanges(
        StoragePath objectPath,
        @Nullable ObjectId newBlobId,
        PersonIdent author,
        String commitMessage
    ) throws IOException, GitAPIException {
        try (Git git = new Git(repository)) {
            assertCleanWorkTree(git);
        }


        Ref head = repository.exactRef(Constants.HEAD);
        if (head == null || !head.isSymbolic()) {
            throw new StorageException("Cannot update repository with detached HEAD");
        }
        ObjectId headCommitId = head.getObjectId();

        RevCommit committedChanges;
        try {
            committedChanges = commitChanges(head, objectPath, newBlobId, author, commitMessage);
        } catch (Exception e) {
            performRollback(headCommitId);
            throw e;
        }

        if (config.getRemoteUrl() != null) {
            String branch = head.getTarget().getName();
            pushChangesAsynch(headCommitId, branch, committedChanges);
        }

        return committedChanges;

    }

    private RevCommit commitChanges(
        Ref head,
        StoragePath objectPath,
        @Nullable ObjectId newBlobId,
        PersonIdent author,
        String commitMessage
    ) throws IOException, GitAPIException {
        String initialBranch = head.getTarget().getName();
        ObjectId headCommitId = head.getObjectId();
        RevCommit headCommit =
            headCommitId == null ? null : repository.parseCommit(headCommitId);

        try (ObjectInserter inserter = repository.newObjectInserter()) {
            DirCache newIndex = DirCache.newInCore();
            if (headCommit != null) {
                readIndexFromTree(newIndex, headCommit.getTree());
            }

            Optional<DirCacheEntry> targetEntry = addOrRemoveIndexEntry(newIndex, objectPath, newBlobId);
            if (!targetEntry.isPresent()) {
                // index entry is unchanged
                return headCommit;
            }

            DirCacheEntry entry = targetEntry.get();
            if (newBlobId != null) {
                entry.setObjectId(newBlobId);
                entry.setFileMode(FileMode.REGULAR_FILE);
                Instant commitTime = author.getWhen().toInstant();
                entry.setCreationTime(commitTime.toEpochMilli());
                entry.setLastModified(commitTime);
            }

            ObjectId insertedTreeId = newIndex.writeTree(inserter);
            inserter.flush();

            CommitBuilder commit = new CommitBuilder();
            commit.setTreeId(insertedTreeId);
            commit.setCommitter(author);
            commit.setAuthor(author);
            commit.setMessage(commitMessage);
            if (headCommitId != null) {
                commit.setParentIds(headCommitId);
            }

            ObjectId insertedCommitId = inserter.insert(commit);
            RevCommit insertedCommit = repository.parseCommit(insertedCommitId);

            RefUpdate ru = repository.updateRef(Constants.HEAD);

            ru.setNewObjectId(insertedCommitId);
            ru.setRefLogMessage("commit: " + insertedCommit.getShortMessage(), false);
            ru.setExpectedOldObjectId(headCommitId == null ? ObjectId.zeroId() : headCommitId);
            RefUpdate.Result rc = ru.forceUpdate();
            switch (rc) {
                case NEW:
                case FORCED:
                case FAST_FORWARD:
                    break;
                case REJECTED:
                case LOCK_FAILURE:
                    throw new StorageException("Failed to lock HEAD");
                default:
                    throw new StorageException("Failed to update Git ref");
            }

            try (Git git = new Git(repository)) {
                git.reset().setRef(initialBranch).setMode(ResetCommand.ResetType.HARD).call();
            }

            return insertedCommit;
        }
    }

    private void pushChangesAsynch(ObjectId headCommitId, String branch, RevCommit committedChanges) {

        executor.submit(() -> {
            try {
                pushChanges(headCommitId, branch, committedChanges);
            } catch (Throwable e) {
                logger.warn("Failed to push changes to remote in background thread: " + e.getMessage());
                logger.debug("Details:", e);
            }
        });
    }

    private void pushChanges(ObjectId headCommitId, String branch, RevCommit committedChanges)
            throws GitAPIException, StorageException {

        int attempts = 0;
        do {
            RemoteRefUpdate.Status pushStatus = tryPushChanges(branch);
            switch (pushStatus) {
            case OK:
                logger.debug("Successfully pushed changes to remote as commit " + committedChanges.getId().getName());
                return;
            case REJECTED_NONFASTFORWARD:
                logger.warn(
                        "Fast forward merge to remote not possible: remote has other changes. Commit {} will not be pushed to remote Git repository. "
                                + "Make sure to synch the repository manually from the commandline.",
                        committedChanges.getId().getName());
                return;
            case UP_TO_DATE:
                logger.debug("Remote is up to date and contains commit {}. All local changes are pushed",
                        committedChanges.getId().getName());
                return;

            default:
                logger.warn("Failed to push to remote Git repository due to unexpected reason: {}, push status: {}",
                        committedChanges.getId().getName(), pushStatus);
            }

            attempts++;
        } while (attempts < config.getMaxPushAttempts());

        throw new StorageException(
                "Failed to push committed changes after " + config.getMaxPushAttempts() + " failed attempts");
    }

    private RemoteRefUpdate.Status tryPushChanges(String branch) throws GitAPIException {
        try (Git git = new Git(repository)) {
            logger.debug("Pushing changes to remote repository...");
            PushCommand push = git.push()
                .add(branch)
                .setAtomic(true)
                .setRemote("origin");

            configureTransport(push);

            Iterable<PushResult> results = push.call();
            for (PushResult result : results) {
                String messages = result.getMessages();
                if (!messages.isEmpty()) {
                    logger.debug("Push message: {}", result.getMessages());
                }
                for (RemoteRefUpdate update : result.getRemoteUpdates()) {
                    if (update.getStatus() != RemoteRefUpdate.Status.OK) {
                        return update.getStatus();
                    }
                }
            }
            return RemoteRefUpdate.Status.OK;
        }
    }

    @SuppressWarnings("unused")
    private void pullChangesInFastForwardMode() throws GitAPIException {
        try (Git git = new Git(repository)) {
            PullCommand pull = git.pull()
                .setRemote("origin")
                    .setFastForward(MergeCommand.FastForwardMode.FF_ONLY);

            configureTransport(pull);

            pull.call();
        }
    }

    private Optional<ObjectRecord> lookupRecord(
        StoragePath originalPath,
        RevCommit commit,
        PathFilter filter
    ) throws IOException {
        Optional<GitStorageLocation> location = lookupBlob(commit, filter);
        if (!location.isPresent()) {
            return Optional.empty();
        }
        String foundRevision = commit.getId().name();
        ObjectMetadata metadata = getMetadata(commit);
        return Optional.of(
            new ObjectRecord(location.get(), originalPath, foundRevision, metadata)
        );
    }

    private Optional<GitStorageLocation> lookupBlob(RevCommit commit, PathFilter filter) throws IOException {
        try (TreeWalk treeWalk = new TreeWalk(repository)) {
            treeWalk.addTree(commit.getTree());
            treeWalk.setRecursive(true);
            treeWalk.setFilter(filter);
            if (treeWalk.next()) {
                ObjectId blobId = treeWalk.getObjectId(0);
                return Optional.of(new GitStorageLocation(blobId));
            }
            return Optional.empty();
        }
    }

    private ObjectMetadata getMetadata(RevCommit commit) {
        String author = commit.getAuthorIdent().getName();
        Date when = commit.getAuthorIdent().getWhen();
        return ObjectMetadataBuilder.create().
                withAuthor(author).
                withCreationDate(when.toInstant()).
                withTitle(commit.getShortMessage()).
                withComment(commit.getFullMessage())
                .build();
    }

    private void assertCleanWorkTree(Git git) throws GitAPIException, StorageException {
        if (!git.status().call().isClean()) {
            throw new StorageException("Git work tree is not clean");
        }
    }

    private void readIndexFromTree(DirCache index, RevTree tree) throws IOException {
        DirCacheBuilder builder = index.builder();
        try (ObjectReader reader = repository.newObjectReader()) {
            builder.addTree(null, DirCacheEntry.STAGE_0, reader, tree.getId());
        }
        builder.finish();
    }

    private Optional<DirCacheEntry> addOrRemoveIndexEntry(
        DirCache index,
        StoragePath objectPath,
        @Nullable ObjectId newBlobId
    ) {
        DirCacheEntry entry = index.getEntry(objectPath.toString());
        boolean unchanged = (
            entry == null && newBlobId == null ||
            entry != null && entry.getObjectId().equals(newBlobId)
        );
        if (unchanged) {
            return Optional.empty();
        }
        if (entry == null) {
            DirCacheBuilder builder = index.builder();
            for (int i = 0; i < index.getEntryCount(); i++) {
                builder.add(index.getEntry(i));
            }
            entry = new DirCacheEntry(objectPath.toString());
            entry.setFileMode(FileMode.REGULAR_FILE);
            builder.add(entry);
            builder.finish();
        } else if (newBlobId == null) {
            DirCacheBuilder builder = index.builder();
            for (int i = 0; i < index.getEntryCount(); i++) {
                DirCacheEntry existing = index.getEntry(i);
                if (existing != entry) {
                    // add all entries except the removed one
                    builder.add(index.getEntry(i));
                }
            }
            builder.finish();
        }
        return Optional.of(entry);
    }

    private void performRollback(ObjectId rollbackTo) throws GitAPIException {
        logger.debug("Performing rollback to " + rollbackTo.toString());
        try (Git git = new Git(repository)) {
            git.reset()
                .setMode(ResetCommand.ResetType.HARD)
                .setRef(rollbackTo.getName())
                .call();
        }
    }

    private void configureTransport(TransportCommand<?,?> command) {
        
        // if present: configure custom SSH factory (e.g. a custom private key)
        if (sshSessionFactory.isPresent()) {
            
            command.setTransportConfigCallback(new TransportConfigCallback() {
                @Override
                public void configure(Transport transport) {
                    if (!(transport instanceof SshTransport)) {
                        logger.warn("Invalid configuration supplied to GitStorage configuration. "
                                + "It looks like an SSH configuration setting (e.g. key, keyPath, or "
                                + "verifyKnownHosts) is defined for a HTTPS Git URL. Settings are ignored.");
                        return;
                    }
                    SshTransport sshTransport = (SshTransport) transport;
                    sshTransport.setSshSessionFactory(sshSessionFactory.get());
                }
            });
        }

        if (config.getUsername() != null) {

            String password = config.getPassword();
            if (password == null) {
                throw new IllegalStateException("Username defined, but no password given.");
            }

            logger.debug("Configuring credentials for user {}", config.getUsername());
            command.setCredentialsProvider(new UsernamePasswordCredentialsProvider(config.getUsername(), password));
        }
    }

    private Optional<SshSessionFactory> initializeSshAuthenticationFactory() {
        
        // no custom authentication => use built-in
        if (!config.customSSHAuthentication()) {
            return Optional.empty();
        }
        logger.debug("Using custom authentication configuration for Git repesitory at {}", config.getLocalPath());
   
        SshSessionFactory sessionFactory = new JschConfigSessionFactory() {
            @Override
            protected void configure(Host host, Session session) {

                if (!config.isVerifyKnownHosts()) {

                    logger.trace("Known hosts verification is deactivated.");

                    // deactivate known_hosts checking
                    java.util.Properties config = new java.util.Properties();
                    config.put("StrictHostKeyChecking", "no");
                    session.setConfig(config);
                }
            }

            @Override
            protected JSch createDefaultJSch(FS fs) throws JSchException {

                JSch jsch = super.createDefaultJSch(fs);

                String keyPath = config.getKeyPath();
                String key = config.getKey();

                // built-in configuration
                if (keyPath == null && key == null) {
                    return jsch;
                }

                // if a textual key is set, use this as identity
                if (key != null) {
                    logger.debug("Adding identity from private key provided as string");
                    byte[] private_key = key.getBytes();
                    jsch.addIdentity(keyPath, private_key, null, null);
                    return jsch;
                }

                // key points to an existing file
                if (new File(keyPath).isFile()) {
                    logger.debug("Adding identity from private key file at {}", keyPath);
                    jsch.addIdentity(keyPath);
                    return jsch;
                }

                throw new JSchException("Private key not found at " + keyPath);
            }
        };
        return Optional.of(sessionFactory);
    }
}
