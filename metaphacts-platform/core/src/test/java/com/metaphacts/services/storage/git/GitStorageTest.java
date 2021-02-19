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

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

import javax.annotation.Nullable;

import org.apache.commons.io.FileUtils;
import org.apache.commons.io.IOUtils;
import org.apache.logging.log4j.Level;
import org.eclipse.jgit.api.CloneCommand;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.LogCommand;
import org.eclipse.jgit.api.ResetCommand;
import org.eclipse.jgit.api.TransportConfigCallback;
import org.eclipse.jgit.lib.Ref;
import org.eclipse.jgit.revwalk.RevCommit;
import org.eclipse.jgit.transport.JschConfigSessionFactory;
import org.eclipse.jgit.transport.OpenSshConfig.Host;
import org.eclipse.jgit.transport.SshSessionFactory;
import org.eclipse.jgit.transport.SshTransport;
import org.eclipse.jgit.transport.Transport;
import org.eclipse.jgit.transport.URIish;
import org.eclipse.jgit.util.FS;
import org.hamcrest.MatcherAssert;
import org.hamcrest.Matchers;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Ignore;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import com.google.common.base.Charsets;
import com.google.common.collect.Lists;
import com.jcraft.jsch.JSch;
import com.jcraft.jsch.JSchException;
import com.jcraft.jsch.Session;
import com.metaphacts.junit.Log4jRule;
import com.metaphacts.junit.MpAssert;
import com.metaphacts.services.storage.StorageUtils;
import com.metaphacts.services.storage.api.ObjectMetadata;
import com.metaphacts.services.storage.api.ObjectMetadata.ObjectMetadataBuilder;
import com.metaphacts.services.storage.api.ObjectRecord;
import com.metaphacts.services.storage.api.PathMapping;
import com.metaphacts.services.storage.api.StorageException;
import com.metaphacts.services.storage.api.StoragePath;
import com.metaphacts.services.storage.api.Tag;

public class GitStorageTest {
    @Rule
    public Log4jRule log4j = Log4jRule.create(Level.INFO);

    @Rule
    public TemporaryFolder tempFolder = new TemporaryFolder();



    protected File localGitFolder;
    protected File remoteGitFolder;

    protected Git remoteGit;
    protected Git localGit;

    private String storageDirectoryBefore = null;

    @Before
    public void initializeLocalGitRepository() throws Exception {
        localGitFolder = tempFolder.newFolder("git");
        remoteGitFolder = tempFolder.newFolder("remote");

        remoteGit = Git.init().setDirectory(remoteGitFolder).call();

        // clone the local git from the "remote"
        localGit = Git.cloneRepository().setURI(remoteGitFolder.toURI().toString()).setDirectory(localGitFolder).call();

        // set storageDirectory
        storageDirectoryBefore = System.getProperty("storageDirectory");
        System.setProperty("storageDirectory", tempFolder.getRoot().toString());
    }

    @After
    public void after() {
        if (storageDirectoryBefore == null) {
            System.clearProperty("storageDirectory");
        } else {
            System.setProperty("storageDirectory", storageDirectoryBefore);
        }
    }

    @Test
    public void testReadFromEmptyRepository() throws Exception {
        try (GitStorage git = createGitStorage(remoteUrl())) {
            StoragePath readmePath = StoragePath.parse("readme.txt");
            Optional<ObjectRecord> before = git.getObject(readmePath, null);
            Assert.assertFalse("Git storage should be initially empty", before.isPresent());
        }
    }

    @Test
    public void testSimpleStore() throws Exception {
        try (GitStorage git = createGitStorage()) {
            StoragePath readmePath = StoragePath.parse("readme.txt");
            storeContent(git, readmePath, "Hello World");

            assertObjectExists(git, readmePath, "Hello World");
            assertFileExists(localGitFolder, "readme.txt", "Hello World");
            List<ObjectRecord> records = git.getRevisions(readmePath);
            Assert.assertEquals(1, records.size());
        }
    }

    @Test
    public void testGetAllObjects() throws Exception {
        try (GitStorage git = createGitStorage()) {
            StoragePath readmePath1 = StoragePath.parse("readme1.txt");
            StoragePath readmePath2 = StoragePath.parse("readme2.txt");
            storeContent(git, readmePath1, "Hello World");
            storeContent(git, readmePath2, "Hello World");

            List<ObjectRecord> records = git.getAllObjects(StoragePath.EMPTY);
            Assert.assertEquals(2, records.size());
        }
    }

    @Test
    public void testGetRevisionsOfDeletedObject() throws Exception {
        try (GitStorage git = createGitStorage()) {
            StoragePath readmePath = StoragePath.parse("readme.txt");
            storeContent(git, readmePath, "Hello World");
            storeContent(git, readmePath, "Hello World Updated");
            git.deleteObject(readmePath, defaultMetadata());

            Optional<ObjectRecord> found = git.getObject(readmePath, null);
            Assert.assertFalse(found.isPresent());

            List<ObjectRecord> records = git.getRevisions(readmePath);
            Assert.assertEquals(2, records.size());
        }
    }

    @Test
    public void testPushToRemote() throws Exception {
        try (GitStorage git = createGitStorage(remoteUrl())) {

            StoragePath readmePath = StoragePath.parse("readme.txt");

            storeContent(git, readmePath, "Hello World 1");
            assertObjectExists(git, readmePath, "Hello World 1");

            storeContent(git, readmePath, "Hello World 2");
            assertObjectExists(git, readmePath, "Hello World 2");

            List<ObjectRecord> localRevisions = git.getRevisions(readmePath);
            Assert.assertEquals(2, localRevisions.size());

            assertObjectExists(git, readmePath, "Hello World 2");
            localRevisions = git.getRevisions(readmePath);
            Assert.assertEquals(2, localRevisions.size());
        }

        // refresh the current branch
        remoteGit.checkout().setName("master").call();
        assertFileExists(remoteGitFolder, "readme.txt", "Hello World 2");
    }

    @Test
    public void testPushToRemoteNonFastForward() throws Exception {
        try (GitStorage git = createGitStorage(remoteUrl())) {
            StoragePath readmePath = StoragePath.parse("readme.txt");
            storeContent(git, readmePath, "Hello World");
        }

        // refresh the current branch
        remoteGit.checkout().setName("master").call();
        assertFileExists(remoteGitFolder, "readme.txt", "Hello World");

        // add an independent commit to the remote
        File testFile = new File(remoteGitFolder, "testFile.txt");
        FileUtils.write(testFile, "Another file", Charsets.UTF_8);
        remoteGit.add().addFilepattern("testFile.txt").call();
        remoteGit.commit().setMessage("Commit on remote").call();

        // try a non-fast forward remote push
        try (GitStorage git = createGitStorage(remoteUrl())) {

            StoragePath readmePath = StoragePath.parse("readme2.txt");
            storeContent(git, readmePath, "My second file");


            assertObjectExists(git, readmePath, "My second file");
            assertFileExists(localGitFolder, "readme2.txt", "My second file");
        }

        // refresh the local git repository, commit and change should be present
        try (GitStorage git = createGitStorage(remoteUrl())) {
            StoragePath readmePath = StoragePath.parse("readme2.txt");
            assertObjectExists(git, readmePath, "My second file");
            assertFileExists(localGitFolder, "readme2.txt", "My second file");
        }

        // check the number of commits to be as expected
        AtomicInteger commitsLocal = new AtomicInteger(0);
        localGit.log().call().forEach(r -> commitsLocal.incrementAndGet());
        Assert.assertEquals(2, commitsLocal.get());

        // refresh the current branch, readme2.txt should not be available in the remote
        remoteGit.checkout().setName("master").call();
        remoteGit.reset().setRef("master").setMode(ResetCommand.ResetType.HARD).call();
        assertFileNotExists(remoteGitFolder, "readme2.txt", "My second file");

        // try another write operation to the same file, remote push still fails, local
        // commit is added

        // try a non-fast forward remote push
        try (GitStorage git = createGitStorage(remoteUrl())) {

            StoragePath readmePath = StoragePath.parse("readme2.txt");
            storeContent(git, readmePath, "My second file - UPDATE");

            assertObjectExists(git, readmePath, "My second file - UPDATE");
            assertFileExists(localGitFolder, "readme2.txt", "My second file - UPDATE");
        }

        // refresh the local git repository, commit and change should be present
        try (GitStorage git = createGitStorage(remoteUrl())) {
            StoragePath readmePath = StoragePath.parse("readme2.txt");
            assertObjectExists(git, readmePath, "My second file - UPDATE");
            assertFileExists(localGitFolder, "readme2.txt", "My second file - UPDATE");
        }

        // check the number of commits to be as expected
        AtomicInteger commitsLocal2 = new AtomicInteger(0);
        localGit.log().call().forEach(r -> commitsLocal2.incrementAndGet());
        Assert.assertEquals(3, commitsLocal2.get());

        // refresh the current branch, readme2.txt should not be available in the remote
        remoteGit.checkout().setName("master").call();
        remoteGit.reset().setRef("master").setMode(ResetCommand.ResetType.HARD).call();
        assertFileNotExists(remoteGitFolder, "readme2.txt", "My second file");
    }

    @Test
    public void testPushToRemoteFails() throws Exception {

        try (GitStorage git = createGitStorage(remoteUrl())) {

            // make push fail with invalid remote URL
            localGit.remoteSetUrl().setRemoteName("origin").setRemoteUri(new URIish("invalid:origin")).call();


            StoragePath readmePath = StoragePath.parse("readme.txt");
            storeContent(git, readmePath, "Hello World");

            // object exists in local git
            assertObjectExists(git, readmePath, "Hello World");
        }

        // check that the file exists in the local working tree
        assertFileExists(localGitFolder, "readme.txt", "Hello World");

        // check the number of commits to be as expected
        AtomicInteger commitsLocal = new AtomicInteger(0);
        localGit.log().call().forEach(r -> commitsLocal.incrementAndGet());
        Assert.assertEquals(1, commitsLocal.get());
    }

    @Test
    @Ignore // TODO not yet supported
    public void testFastForwardOnEmptyRepository() throws Exception {
        // add an independent commit to the remote
        File readmeFile = new File(remoteGitFolder, "readme.txt");
        FileUtils.write(readmeFile, "Hello remote", Charsets.UTF_8);
        remoteGit.add().addFilepattern("readme.txt").call();
        remoteGit.commit().setMessage("Commit on remote").call();

        try (GitStorage git = createGitStorage(remoteUrl())) {

            StoragePath readmePath = StoragePath.parse("readme.txt");
            storeContent(git, readmePath, "Hello local");
            assertObjectExists(git, readmePath, "Hello local");

            assertObjectExists(git, readmePath, "Hello local");

            List<ObjectRecord> recordsAfterPush = git.getRevisions(readmePath);
            Assert.assertEquals(2, recordsAfterPush.size());
        }
    }

    @Test
    public void testConcurrentModifications() throws Exception {
        int numberOfCommits = 10;

        CountDownLatch latch = new CountDownLatch(3);
        ExecutorService executor = Executors.newFixedThreadPool(5);
        try (GitStorage git = createGitStorage()) {

            List<Future<?>> scheduled = Lists.newArrayList();
            for (int i = 0; i < numberOfCommits; i++) {

                final int _i = i;
                scheduled.add(executor.submit(() -> {

                    latch.countDown();

                    try {
                        // wait to make sure that we have at least
                        // three background threads
                        latch.await();
                    } catch (InterruptedException e) {
                        throw new RuntimeException(e);
                    }
                    
                    String file = "file" + _i + ".txt";
                    String content = "Content " + _i;
                    StoragePath path = StoragePath.parse(file);
                    try {
                        storeContent(git, path, content);
                    } catch (StorageException e) {
                        throw new RuntimeException(e);
                    }

                    assertObjectExists(git, path, content);

                }));
            }

            for (Future<?> f : scheduled) {
                f.get(); // just consume to obtain exceptions
            }

        } finally {
            executor.shutdown();
            executor.awaitTermination(10, TimeUnit.SECONDS);
        }

        AtomicInteger commitsLocal = new AtomicInteger(0);
        localGit.log().call().forEach(r -> commitsLocal.incrementAndGet());
        Assert.assertEquals(numberOfCommits, commitsLocal.get());
    }

    @Test
    public void testConcurrentModificationsWithRemote() throws Exception {

        int numberOfCommits = 10;

        ExecutorService executor = Executors.newFixedThreadPool(5);
        try (GitStorage git = createGitStorage(remoteUrl())) {

            List<Future<?>> scheduled = Lists.newArrayList();
            for (int i = 0; i < numberOfCommits; i++) {

                final int _i = i;
                scheduled.add(executor.submit(() -> {
                    String file = "file" + _i + ".txt";
                    String content = "Content " + _i;
                    StoragePath path = StoragePath.parse(file);
                    try {
                        storeContent(git, path, content);
                    } catch (StorageException e) {
                        throw new RuntimeException(e);
                    }

                    assertObjectExists(git, path, content);
                }));
            }

            for (Future<?> f : scheduled) {
                f.get(); // just consume to obtain exceptions
            }

        } finally {
            executor.shutdown();
            executor.awaitTermination(10, TimeUnit.SECONDS);
        }

        AtomicInteger commitsLocal = new AtomicInteger(0);
        localGit.log().call().forEach(r -> commitsLocal.incrementAndGet());
        Assert.assertEquals(numberOfCommits, commitsLocal.get());

        AtomicInteger commitsRemote = new AtomicInteger(0);
        remoteGit.log().call().forEach(r -> commitsRemote.incrementAndGet());
        Assert.assertEquals(numberOfCommits, commitsRemote.get());
    }

    @Test
    public void testTag() throws Exception {

        try (GitStorage git = createGitStorage(remoteUrl())) {
            StoragePath readmePath = StoragePath.parse("readme.txt");
            storeContent(git, readmePath, "Hello World @ rev1");
            storeContent(git, readmePath, "Hello World @ rev2");

            List<ObjectRecord> records = git.getRevisions(readmePath);
            Assert.assertEquals(2, records.size());

            List<RevCommit> commits = new ArrayList<>();
            localGit.log().call().forEach(commits::add);

            // commit IDs
            String commit1 = records.get(1).getRevision();
            String commit2 = records.get(0).getRevision();

            git.tag(commit1, "rev1", defaultMetadata());
            git.tag(commit2, "rev2", defaultMetadata());

            List<Ref> tags = localGit.tagList().call();
            Assert.assertEquals(2, tags.size());


            MatcherAssert.assertThat(tags.stream().map(t -> t.getName()).collect(Collectors.toList()),
                    Matchers.containsInAnyOrder("refs/tags/rev1", "refs/tags/rev2"));

            // lookup commit referenced by tag1
            LogCommand log = localGit.log();
            Ref tag1 = tags.get(0);
            Ref peeledRef = localGit.getRepository().getRefDatabase().peel(tag1);
            if (peeledRef.getPeeledObjectId() != null) {
                log.add(peeledRef.getPeeledObjectId());
            } else {
                log.add(tag1.getObjectId());
            }
            Assert.assertEquals(commit1, log.call().iterator().next().getName());

            // lookup commit referenced by tag2
            log = localGit.log();
            Ref tag2 = tags.get(1);
            peeledRef = localGit.getRepository().getRefDatabase().peel(tag2);
            if (peeledRef.getPeeledObjectId() != null) {
                log.add(peeledRef.getPeeledObjectId());
            } else {
                log.add(tag2.getObjectId());
            }
            Assert.assertEquals(commit2, log.call().iterator().next().getName());

            // check that tags are pushed to the remote
            List<Ref> remoteTags = remoteGit.tagList().call();
            Assert.assertEquals(2, remoteTags.size());
            MatcherAssert.assertThat(remoteTags.stream().map(t -> t.getName()).collect(Collectors.toList()),
                    Matchers.containsInAnyOrder("refs/tags/rev1", "refs/tags/rev2"));
        }
        
    }

    @Test
    public void testTag_AlreadyExists() throws Exception {

        try (GitStorage git = createGitStorage()) {
            StoragePath readmePath = StoragePath.parse("readme.txt");
            storeContent(git, readmePath, "Hello World @ rev1");
            storeContent(git, readmePath, "Hello World @ rev2");

            List<ObjectRecord> records = git.getRevisions(readmePath);
            Assert.assertEquals(2, records.size());

            // commit IDs
            String commit1 = records.get(1).getRevision();
            String commit2 = records.get(0).getRevision();

            git.tag(commit1, "rev1", defaultMetadata());

            MpAssert.assertThrows("Tag with name rev1 already exists", StorageException.class, () -> {
                git.tag(commit2, "rev1", defaultMetadata());
            });

        }
    }

    @Test
    public void testTag_TagNoChanges() throws Exception {

        try (GitStorage git = createGitStorage()) {
            StoragePath readmePath = StoragePath.parse("readme.txt");
            storeContent(git, readmePath, "Hello World @ rev1");
            storeContent(git, readmePath, "Hello World @ rev2");

            List<ObjectRecord> records = git.getRevisions(readmePath);
            Assert.assertEquals(2, records.size());

            // commit IDs
            String commit1 = records.get(1).getRevision();

            git.tag(commit1, "rev1", defaultMetadata());

            // tag is not changed, no error expected
            git.tag(commit1, "rev1", defaultMetadata());
        }
    }

    @Test
    public void testGetTags() throws Exception {

        try (GitStorage git = createGitStorage()) {
            StoragePath readmePath = StoragePath.parse("readme.txt");
            storeContent(git, readmePath, "Hello World @ rev1");
            storeContent(git, readmePath, "Hello World @ rev2");

            List<ObjectRecord> records = git.getRevisions(readmePath);

            // commit IDs
            String commit1 = records.get(1).getRevision();
            String commit2 = records.get(0).getRevision();

            git.tag(commit1, "rev1", defaultMetadata());
            git.tag(commit1, "rev1a", defaultMetadata());
            git.tag(commit2, "rev2", defaultMetadata());

            List<Tag> tags = git.getTags();
            Assert.assertEquals(3, tags.size());

            Assert.assertTrue(
                    tags.stream().anyMatch(t -> t.getRevision().equals(commit1) && t.getTagName().equals("rev1")));
            Assert.assertTrue(
                    tags.stream().anyMatch(t -> t.getRevision().equals(commit1) && t.getTagName().equals("rev1a")));
            Assert.assertTrue(
                    tags.stream().anyMatch(t -> t.getRevision().equals(commit2) && t.getTagName().equals("rev2")));

        }

    }

    @Test
    public void testCloneFromRemote() throws Exception {

        // use another folder for local git
        localGitFolder = tempFolder.newFolder("localGit");
        localGit = null;

        // add a commit to the remote
        File testFile = new File(remoteGitFolder, "testFile.txt");
        FileUtils.write(testFile, "Another file", Charsets.UTF_8);
        remoteGit.add().addFilepattern("testFile.txt").call();
        remoteGit.commit().setMessage("Commit on remote").call();

        try (GitStorage git = createGitStorage(remoteUrl())) {

            List<ObjectRecord> revisions = git.getRevisions(StoragePath.parse("testFile.txt"));
            Assert.assertEquals(1, revisions.size());
        }
    }

    @Test
    public void testInitializeEmptyLocalRepository() throws Exception {

        // use another folder for local git
        localGitFolder = tempFolder.newFolder("localGit");
        localGit = null;

        // initialize with empty commit
        try (GitStorage git = createGitStorage()) {

            storeContent(git, StoragePath.parse("test.txt"), "Hello World @ rev1");

        }

        localGit = Git.open(localGitFolder);
        // check the number of commits to be as expected
        AtomicInteger commitsLocal = new AtomicInteger(0);
        localGit.log().call().forEach(r -> commitsLocal.incrementAndGet());
        Assert.assertEquals(2, commitsLocal.get());
    }

    @Test
    public void testInitializeEmptyLocalRepository_NonMaster() throws Exception {

        // use another folder for local git
        localGitFolder = tempFolder.newFolder("localGit");
        localGit = null;

        GitStorageConfig config = new GitStorageConfig();
        config.setLocalPath(localGitFolder.toPath());
        config.setMutable(true);
        config.setBranch("mybranch");

        // initialize with empty commit
        try (GitStorage git = createGitStorage(config)) {

            storeContent(git, StoragePath.parse("test.txt"), "Hello World @ rev1");

        }

        localGit = Git.open(localGitFolder);
        // check the number of commits to be as expected
        AtomicInteger commitsLocal = new AtomicInteger(0);
        localGit.log().call().forEach(r -> commitsLocal.incrementAndGet());
        Assert.assertEquals(2, commitsLocal.get());
    }

    @Test
    public void testGetDescription() throws Exception {

        try (GitStorage git = createGitStorage(remoteUrl())) {
            Assert.assertEquals("Git: " + remoteUrl() + " (Branch: master)", git.getDescription());
        }

        try (GitStorage git = createGitStorage()) {
            Assert.assertEquals("Git: local repository (Branch: master)", git.getDescription());
        }
    }

    @Test
    public void testGetObjectMetadata() throws Exception {

        try (GitStorage git = createGitStorage()) {
            StoragePath readmePath = StoragePath.parse("readme.txt");
            String commitMessage = "Adding new readme file\n\nThis is a hello world example";
            ObjectMetadata metadata = ObjectMetadataBuilder.create().withAuthor("the-author").withComment(commitMessage)
                    .build();
            storeContent(git, readmePath, "Hello World", metadata);

            assertObjectExists(git, readmePath, "Hello World");
            assertFileExists(localGitFolder, "readme.txt", "Hello World");
            List<ObjectRecord> records = git.getRevisions(readmePath);
            Assert.assertEquals(1, records.size());

            ObjectMetadata fetchedMetadata = records.get(0).getMetadata();
            Assert.assertEquals(commitMessage, fetchedMetadata.getComment());
            Assert.assertEquals("Adding new readme file", fetchedMetadata.getTitle());
            Assert.assertEquals("the-author", fetchedMetadata.getAuthor());
        }
    }



    /********************************************************
     * LOCAL MANUAL TESTS FOR AUTHENTICATION METHODS
     * 
     * Activate and adjust settings for easy local debugging
     */

    private static final String REMOTE_URL_SSH = "git@github.com:metaphacts/knowledge-graph-assets.git";
    private static final String REMOTE_URL_HTTPS = "https://github.com/metaphacts/knowledge-graph-assets.git";

    @Test
    @Ignore
    public void testCloneWithOpenSsh() throws Exception {

        /*
         * This test assumes that a valid openssh configuration exists in the current
         * user's home directory.
         */

        File folder = tempFolder.newFolder("clone");

        GitStorageConfig config = new GitStorageConfig();
        config.setLocalPath(folder.toPath());
        config.setMutable(true);
        config.setBranch("master");
        config.setRemoteUrl(REMOTE_URL_SSH);

        try (GitStorage git = createGitStorage(config)) {

            List<ObjectRecord> revisions = git.getRevisions(StoragePath.parse("ontologies"));
            System.out.println("Number of revisions: " + revisions.size());
        }

    }

    @Test
    @Ignore
    public void testCloneWith_CustomKeyLocation() throws Exception {

        /*
         * Before running this test make sure temporarily rename "~./ssh"
         * 
         * Set private_key to the fully qualified path
         */

        File folder = tempFolder.newFolder("clone");
        String private_key = "/path/to/.ssh-rename/id_rsa";

        GitStorageConfig config = new GitStorageConfig();
        config.setLocalPath(folder.toPath());
        config.setMutable(true);
        config.setBranch("master");
        config.setKeyPath(private_key);
        // explicitly do not do known host verification
        config.setVerifyKnownHosts(false);
        config.setRemoteUrl(REMOTE_URL_SSH);
        try (GitStorage git = createGitStorage(config)) {

            List<ObjectRecord> revisions = git.getRevisions(StoragePath.parse("ontologies"));
            System.out.println("Number of revisions: " + revisions.size());
        }
    }

    @Test
    @Ignore
    public void testCloneWith_CustomKeyAsString() throws Exception {

        /*
         * Before running this test make sure temporarily rename "~./ssh"
         * 
         * Set private_key to the textual key
         */

        File folder = tempFolder.newFolder("clone");
        String private_key = 
                "-----BEGIN RSA PRIVATE KEY-----\n" 
              + "XXXX+ " 
              + "-----END RSA PRIVATE KEY-----";

        GitStorageConfig config = new GitStorageConfig();
        config.setLocalPath(folder.toPath());
        config.setMutable(true);
        config.setBranch("master");
        config.setKey(private_key);
        // explicitly do not do known host verification
        config.setVerifyKnownHosts(false);
        config.setRemoteUrl(REMOTE_URL_SSH);
        try (GitStorage git = createGitStorage(config)) {

            List<ObjectRecord> revisions = git.getRevisions(StoragePath.parse("ontologies"));
            System.out.println("Number of revisions: " + revisions.size());
        }
    }


    @Test
    @Ignore
    public void testCloneWith_HttpsWithToken() throws Exception {

        /*
         * Before running this test make sure temporarily rename "~./ssh"
         * 
         * Use a token (e.g. a github personal access token)
         */

        File folder = tempFolder.newFolder("clone");
        String username = "username";
        String token = "the-token-here";

        GitStorageConfig config = new GitStorageConfig();
        config.setLocalPath(folder.toPath());
        config.setMutable(true);
        config.setBranch("master");
        config.setUsername(username);
        config.setPassword(token);
        config.setRemoteUrl(REMOTE_URL_HTTPS);
        try (GitStorage git = createGitStorage(config)) {

            List<ObjectRecord> revisions = git.getRevisions(StoragePath.parse("ontologies"));
            System.out.println("Number of revisions: " + revisions.size());
        }

    }

    @Test
    @Ignore
    public void testCloneWithKey_KeyFromStream() throws Exception {

        File folder = tempFolder.newFolder("clone");
        SshSessionFactory sshSessionFactory = new JschConfigSessionFactory() {
            @Override
            protected void configure(Host host, Session session) {

                // deactivate known_hosts checking
                java.util.Properties config = new java.util.Properties();
                config.put("StrictHostKeyChecking", "no");
                session.setConfig(config);
            }

            @Override
            protected JSch createDefaultJSch(FS fs) throws JSchException {
                String key = "id_rsa";
                String directory = "/path/to/.ssh-rename/";

                JSch defaultJSch = super.createDefaultJSch(fs);

                byte[] private_key = null;
                try (InputStream in = new FileInputStream(new File(directory, key))) {
                    private_key = IOUtils.toByteArray(in);
                } catch (Exception e1) {
                    throw new RuntimeException(e1);
                }

                defaultJSch.addIdentity(key, private_key, null, null);
                return defaultJSch;
            }

        };
        CloneCommand cloneCommand = Git.cloneRepository();
        cloneCommand.setURI(REMOTE_URL_SSH);
        cloneCommand.setTransportConfigCallback(new TransportConfigCallback() {
            @Override
            public void configure(Transport transport) {
                SshTransport sshTransport = (SshTransport) transport;
                sshTransport.setSshSessionFactory(sshSessionFactory);
            }
        });
        cloneCommand.setDirectory(folder);

        cloneCommand.call();

        System.out.println("Done, see " + folder);

    }

    private GitStorage createGitStorage() throws Exception {
        return createGitStorage((String) null);
    }

    private GitStorage createGitStorage(@Nullable String remoteUrl) throws Exception {

        GitStorageConfig config = new GitStorageConfig();
        config.setLocalPath(localGitFolder.toPath());
        config.setMutable(true);
        config.setBranch("master");
        if (remoteUrl != null) {
            config.setRemoteUrl(remoteUrl);
        }
        return createGitStorage(config);
    }

    private GitStorage createGitStorage(GitStorageConfig config) throws Exception {
        PathMapping paths = new PathMapping.Default();
        return new GitStorage(paths, config);
    }

    private String remoteUrl() throws Exception {
        return new URIish(remoteGitFolder.toURI().toURL()).toPrivateString();
    }

    private ObjectMetadata defaultMetadata() {
        return new ObjectMetadata();
    }

    private ObjectRecord storeContent(GitStorage storage, StoragePath targetPath, String content)
            throws StorageException {
        return storeContent(storage, targetPath, content, defaultMetadata());
    }

    private ObjectRecord storeContent(GitStorage storage, StoragePath targetPath, String content,
            ObjectMetadata metadata) throws StorageException {
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        return storage.appendObject(targetPath, metadata, new ByteArrayInputStream(bytes), bytes.length);
    }

    private void assertObjectExists(GitStorage storage, StoragePath path, String expectedContent) {
        try {
            Optional<ObjectRecord> record = storage.getObject(path, null);
            Assert.assertTrue("Failed to find object in Git storage: \"" + path + "\"", record.isPresent());
            String foundContent = StorageUtils.readTextContent(record.get());
            Assert.assertEquals(expectedContent, foundContent);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    private void assertFileExists(File baseFolder, String relPath, String content) {
        Assert.assertTrue(new File(baseFolder, relPath).isFile());
        try {
            Assert.assertEquals(content, FileUtils.readFileToString(new File(baseFolder, relPath), Charsets.UTF_8));
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    private void assertFileNotExists(File baseFolder, String relPath, String content) {
        Assert.assertFalse(new File(baseFolder, relPath).isFile());
    }
}
