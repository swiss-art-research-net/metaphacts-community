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
 * Copyright (C) 2015-2020, metaphacts GmbH
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
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import javax.annotation.Nullable;

import org.apache.commons.io.FileUtils;
import org.apache.logging.log4j.Level;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.ResetCommand;
import org.eclipse.jgit.transport.URIish;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Ignore;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import com.google.common.base.Charsets;
import com.google.common.collect.Lists;
import com.metaphacts.junit.Log4jRule;
import com.metaphacts.services.storage.StorageUtils;
import com.metaphacts.services.storage.api.ObjectMetadata;
import com.metaphacts.services.storage.api.ObjectRecord;
import com.metaphacts.services.storage.api.PathMapping;
import com.metaphacts.services.storage.api.StorageException;
import com.metaphacts.services.storage.api.StoragePath;

public class GitStorageTest {
    @Rule
    public Log4jRule log4j = Log4jRule.create(Level.TRACE);

    @Rule
    public TemporaryFolder tempFolder = new TemporaryFolder();

    protected File localGitFolder;
    protected File remoteGitFolder;

    protected Git remoteGit;
    protected Git localGit;

    @Before
    public void initializeLocalGitRepository() throws Exception {
        localGitFolder = tempFolder.newFolder("git");
        remoteGitFolder = tempFolder.newFolder("remote");

        remoteGit = Git.init().setDirectory(remoteGitFolder).call();

        // clone the local git from the "remote"
        localGit = Git.cloneRepository().setURI(remoteGitFolder.toURI().toString()).setDirectory(localGitFolder).call();
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

    private GitStorage createGitStorage() throws Exception {
        return createGitStorage(null);
    }

    private GitStorage createGitStorage(@Nullable String remoteUrl) throws Exception {
        PathMapping paths = new PathMapping.Default();
        GitStorageConfig config = new GitStorageConfig();
        config.setLocalPath(localGitFolder.toPath());
        config.setMutable(true);
        config.setBranch("master");
        if (remoteUrl != null) {
            config.setRemoteUrl(remoteUrl);
        }
        return new GitStorage(paths, config);
    }

    private String remoteUrl() throws Exception {
        return new URIish(remoteGitFolder.toURI().toURL()).toPrivateString();
    }

    private ObjectMetadata defaultMetadata() {
        return new ObjectMetadata(null, null);
    }

    private ObjectRecord storeContent(GitStorage storage, StoragePath targetPath, String content)
            throws StorageException {
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        return storage.appendObject(targetPath, defaultMetadata(), new ByteArrayInputStream(bytes), bytes.length);
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
