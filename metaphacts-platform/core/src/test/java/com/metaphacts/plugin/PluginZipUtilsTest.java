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
package com.metaphacts.plugin;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.URI;
import java.nio.file.FileSystem;
import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.zip.ZipException;
import java.util.zip.ZipOutputStream;

import org.apache.commons.io.FileUtils;
import org.apache.commons.io.filefilter.FileFilterUtils;
import org.apache.commons.io.filefilter.TrueFileFilter;
import org.hamcrest.Matchers;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import org.pf4j.PluginRuntimeException;

import com.google.common.collect.Lists;
import com.metaphacts.junit.MpAssert;
import com.metaphacts.util.ZipUtils;

/**
 * @author Johannes Trame <jt@metaphacts.com>
 * 
 */
public class PluginZipUtilsTest {
    @Rule
    public TemporaryFolder tempFolderRule = new TemporaryFolder();

    @Test
    public void testZipCreation() throws IOException, PluginRuntimeException {
        File appFolder = createDummyAppFolder();
        File archive = tempFolderRule.newFile("app1.zip");
        ZipUtils.compressDirToZipFile(appFolder, archive);
        assertTrue(archive.exists());
        
        assertTrue(PluginZipUtils.isSingleDirectoryAppZip(archive));
        assertThat(PluginZipUtils.getZipEntries(archive), containsInAnyOrder("app1/config/repositories/default.ttl","app1/ldp/default", "app1/ldp/assets/test.trig","app1/plugin.properties"));

    }

    @Test
    public void testBackupCreation() throws IOException {
        File appFolder = createDummyAppFolder();
        assertTrue(appFolder.exists());
        File backup = PluginZipUtils.createBackupZipAndDelete(appFolder.toPath());
        assertFalse(appFolder.exists());
        assertTrue(backup.exists());
        
        assertThat(PluginZipUtils.getZipEntries(backup), containsInAnyOrder("app1/config/repositories/default.ttl","app1/ldp/assets/test.trig","app1/plugin.properties", "app1/ldp/default"));
        
    }
    
    @Test
    public void expandAndDeleteIfValidZipTest() throws ZipException, IOException, PluginRuntimeException  {
        File tempAppFolder = createDummyAppFolder();
        assertTrue(tempAppFolder.exists());
        File appsFolder =tempFolderRule.newFolder("apps");
        File nestedZipApp = new File(appsFolder, "app1.zip");
        ZipUtils.compressDirToZipFile(tempAppFolder, nestedZipApp);
        assertTrue(nestedZipApp.exists());
        
        File appFolder = new File(appsFolder,"app1");
        FileUtils.moveDirectory(tempAppFolder,appFolder);
        expandAndDeleteIfValidZipApp(nestedZipApp, appFolder, appsFolder);
    }

    @Test
    public void expandAndDeleteIfValidZipTestAdditionalFilesOrFolders() throws ZipException, IOException, PluginRuntimeException  {
        File tempAppFolder = createDummyAppFolder();
        
        assertTrue(tempAppFolder.exists());
        File appsFolder =tempFolderRule.newFolder("apps");
        File nestedZipApp = new File(appsFolder, "app1.zip");
        ZipUtils.compressDirToZipFile(tempAppFolder, nestedZipApp);
        Map<String, String> env = new HashMap<>(); 
        URI uri = URI.create("jar:"+nestedZipApp.toPath().toUri().toString());
        try (FileSystem fs = FileSystems.newFileSystem(uri, env, null))
        {
            File externalTxtFile = tempFolderRule.newFile(".DS_Store");
            
            FileUtils.touch(externalTxtFile);
            FileUtils.writeLines(externalTxtFile, Lists.newArrayList("hello world"));
            Path pathInZipfile = fs.getPath("/.DS_Store");
            Files.createDirectory(fs.getPath("/__MACOSX"));
            Files.copy( externalTxtFile.toPath(),pathInZipfile,
                    StandardCopyOption.REPLACE_EXISTING ); 
        }
        System.out.println(PluginZipUtils.getZipEntries(nestedZipApp));
        assertTrue(nestedZipApp.exists());
        
        File appFolder = new File(appsFolder,"app1");
        FileUtils.moveDirectory(tempAppFolder,appFolder);
        expandAndDeleteIfValidZipApp(nestedZipApp, appFolder, appsFolder);
    }
    
    
    public void expandAndDeleteIfValidZipApp(File nestedAppZipFile, File finalAppFolder, File appsFolder) throws ZipException, IOException, PluginRuntimeException {
        assertTrue(PluginZipUtils.isSingleDirectoryAppZip(nestedAppZipFile));
        
        // path returned should 
        assertEquals(finalAppFolder.toPath(), PluginZipUtils.expandAndDeleteIfValidZipApp(nestedAppZipFile.toPath()));
        assertTrue(finalAppFolder.exists());
        // backup should have been created
        assertEquals(1,FileUtils.listFiles(appsFolder, FileFilterUtils.suffixFileFilter(".zip.bk"),null).size());
        
        //the app folder has properly unpacked
        List<String> filesInAppsFolder = FileUtils.listFiles(appsFolder,FileFilterUtils.notFileFilter(FileFilterUtils.suffixFileFilter(".zip.bk")),TrueFileFilter.INSTANCE).stream().map( f -> 
               appsFolder.toPath().relativize(f.toPath()).toString()).collect(Collectors.toList());
        assertEquals(4, filesInAppsFolder.size());
        assertThat(filesInAppsFolder, containsInAnyOrder("app1/config/repositories/default.ttl","app1/ldp/assets/test.trig","app1/ldp/default","app1/plugin.properties"));
        // original zip should have been deleted
        assertFalse(nestedAppZipFile.exists());
    }
    

    @Test
    public void isSingleDirectoryAppZipTest() throws IOException, PluginRuntimeException {
        File appFolder = createDummyAppFolder();
        assertTrue(appFolder.exists());
        File backup = tempFolderRule.newFile("app1.zip");
        ZipUtils.compressDirToZipFile(appFolder, backup);
        assertTrue(backup.exists());
        assertTrue(PluginZipUtils.isSingleDirectoryAppZip(backup));

        File backupNotSingleDirectory = tempFolderRule.newFile("app-not-single.zip");
        try (ZipOutputStream zipFile = new ZipOutputStream(
                new FileOutputStream(backupNotSingleDirectory))) {
            for (File f : appFolder.listFiles()) {
               if(f.isDirectory()) {
                   ZipUtils.addFileOrFolderToZipStream(f, f, zipFile);
               }
               
            }
        }
        
        assertTrue(backupNotSingleDirectory.exists());
        MpAssert.assertThrows(
                Matchers.containsString(
                        "The zip file does not contain a folder with a name that is equal to the zip name"),
                PluginRuntimeException.class, () -> {
                    PluginZipUtils.isSingleDirectoryAppZip(backupNotSingleDirectory);
                });
    }
    
    @Test
    public void isFlatZipTest() throws IOException, PluginRuntimeException {
        File zip = new File(tempFolderRule.newFolder(UUID.randomUUID().toString()),"test-app.zip");
        Map<String, String> env = new HashMap<>(); 
        env.put("create", "true");
        URI uri = URI.create("jar:"+zip.toPath().toUri().toString());
        try (FileSystem fs = FileSystems.newFileSystem(uri, env))
        {

            Files.createDirectory(fs.getPath("config"));
            File pluginProperties = tempFolderRule.newFile(".DS_Store");
            FileUtils.touch(pluginProperties);
            FileUtils.writeLines(pluginProperties, Lists.newArrayList("plugin.id=test-app"));
            Path pathInZipfile = fs.getPath("plugin.properties");

            Files.copy( pluginProperties.toPath(),pathInZipfile,
                    StandardCopyOption.REPLACE_EXISTING ); 
        }
        
        // should also not throw an exception i.e. contains flat the mandatory files
        assertFalse(PluginZipUtils.isSingleDirectoryAppZip(zip));
    }
    
    @Test
    public void isSingleDirectoryAppZipWithoutLeadingSlashTest() throws IOException, PluginRuntimeException {
        /*
         * some os / zip tools create zip entries without leading slash
         */
        File zip = new File(tempFolderRule.newFolder(UUID.randomUUID().toString()),"test-app.zip");
        Map<String, String> env = new HashMap<>(); 
        env.put("create", "true");
        URI uri = URI.create("jar:"+zip.toPath().toUri().toString());
        try (FileSystem fs = FileSystems.newFileSystem(uri, env))
        {
            Files.createDirectory(fs.getPath("test-app"));
            Files.createDirectory(fs.getPath("test-app/config"));
            File externalTxtFile = tempFolderRule.newFile(".DS_Store");
            FileUtils.touch(externalTxtFile);
            FileUtils.writeLines(externalTxtFile, Lists.newArrayList("hello world"));
            Path pathInZipfile = fs.getPath("test-app/plugin.properties");

            Files.copy( externalTxtFile.toPath(),pathInZipfile,
                    StandardCopyOption.REPLACE_EXISTING ); 
        }
        assertTrue(PluginZipUtils.isSingleDirectoryAppZip(zip));
    }
    
    File createDummyAppFolder() throws IOException {
        File appsFolder = tempFolderRule.newFolder(UUID.randomUUID().toString());
        File appFolder = new File(appsFolder, "app1");
        assertTrue(appFolder.mkdirs());
        File repDir = new File(appFolder, "config/repositories/");
        File ldpDir = new File(appFolder, "ldp/assets/");
        File ldpDefaultDir = new File(appFolder, "ldp/default/");
        assertTrue(repDir.mkdirs());
        assertTrue(ldpDir.mkdirs());
        assertTrue(ldpDefaultDir.mkdirs());
        File pluginProperties = new File(appFolder, "plugin.properties");
        FileUtils.touch(pluginProperties);
        FileUtils.writeLines(pluginProperties, Lists.newArrayList("plugin.id=app1"));
        FileUtils.touch(new File(repDir, "default.ttl"));
        FileUtils.touch(new File(ldpDir, "test.trig"));

        return appFolder;
    }
}

