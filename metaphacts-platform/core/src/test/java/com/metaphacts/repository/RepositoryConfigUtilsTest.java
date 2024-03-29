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
package com.metaphacts.repository;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.util.Map;

import javax.inject.Inject;

import org.apache.commons.io.output.ByteArrayOutputStream;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.LinkedHashModel;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.util.Models;
import org.eclipse.rdf4j.model.util.Values;
import org.eclipse.rdf4j.repository.config.RepositoryConfig;
import org.eclipse.rdf4j.repository.config.RepositoryConfigException;
import org.eclipse.rdf4j.repository.config.RepositoryConfigSchema;
import org.eclipse.rdf4j.repository.config.RepositoryImplConfig;
import org.eclipse.rdf4j.repository.sail.config.SailRepositoryConfig;
import org.eclipse.rdf4j.repository.sail.config.SailRepositoryFactory;
import org.eclipse.rdf4j.rio.RDFFormat;
import org.eclipse.rdf4j.rio.Rio;
import org.eclipse.rdf4j.sail.config.SailConfigSchema;
import org.eclipse.rdf4j.sail.config.SailImplConfig;
import org.eclipse.rdf4j.sail.memory.config.MemoryStoreConfig;
import org.eclipse.rdf4j.sail.memory.config.MemoryStoreFactory;
import org.eclipse.rdf4j.sail.nativerdf.config.NativeStoreConfig;
import org.eclipse.rdf4j.sail.nativerdf.config.NativeStoreFactory;
import org.junit.Rule;
import org.junit.Test;

import com.metaphacts.junit.AbstractIntegrationTest;
import com.metaphacts.junit.MpAssert;
import com.metaphacts.junit.PlatformStorageRule;
import com.metaphacts.junit.TestUtils;
import com.metaphacts.services.storage.api.SizedStream;

/**
 * @author Johannes Trame <jt@metaphacts.com>
 *
 */
public class RepositoryConfigUtilsTest extends AbstractIntegrationTest {
    ValueFactory vf = SimpleValueFactory.getInstance();
    private final IRI baseIri =  vf.createIRI("http://www.metaphacts.com/base");
    private final String MEMORY_STORE_CONFIG_FILE = "/com/metaphacts/repository/test-sail-memory-repository.ttl";
    private final String NATIVE_STORE_CONFIG_FILE = "/com/metaphacts/repository/test-sail-native-repository.ttl";

    @Inject
    @Rule
    public PlatformStorageRule storage;

    @Test
    public void testCreateMemorySailRepositoryConfigFromModel() throws Exception{
        Model model = TestUtils.readTurtleInputStreamIntoModel(
                TestUtils.readPlainTextTurtleInput(MEMORY_STORE_CONFIG_FILE),
                baseIri
        );

        RepositoryConfig repConfig = RepositoryConfigUtils.createRepositoryConfig(model);

        assertMemorySailTestConfig(repConfig);
    }

    @Test
    public void testCreateNativeSailRepositoryConfigFromModel() throws Exception{
        Model model = TestUtils.readTurtleInputStreamIntoModel(
                TestUtils.readPlainTextTurtleInput(NATIVE_STORE_CONFIG_FILE),
                baseIri
                );

        RepositoryConfig repConfig = RepositoryConfigUtils.createRepositoryConfig(model);

        assertNativeSailTestConfig(repConfig);
    }

    @Test
    public void testCreateRepositoryConfigFromModelFail() throws Exception {
        MpAssert.assertThrows("Repository configuration model must have exactly one repository id.",
                RepositoryConfigException.class, () -> {
                    RepositoryConfigUtils.createRepositoryConfig(new LinkedHashModel());
                });
    }


    @Test
    public void testCreateRepositoryConfigFromModelFail2() throws Exception{
        final Model model = new LinkedHashModel();
        final RepositoryConfig repConfig1 = createTestMemorySailRepositoryConfig("test-sail-memory-repository-1");
        final RepositoryConfig repConfig2 = createTestMemorySailRepositoryConfig("test-sail-memory-repository-2");
        repConfig1.export(model, Values.bnode());
        repConfig2.export(model, Values.bnode());
        assertEquals(
                2,
                model.filter(null, RepositoryConfigSchema.REPOSITORYID, null).size()
        );
        MpAssert.assertThrows("Repository configuration model must have exactly one repository id.",
                RepositoryConfigException.class, () -> {
                    RepositoryConfigUtils.createRepositoryConfig(model);
                });
    }

    private void assertMemorySailTestConfig(RepositoryConfig repConfig){
        assertEquals("test-sail-memory-repository", repConfig.getID());
        assertEquals("Test Memory Sail Description" , repConfig.getTitle());
        RepositoryImplConfig repImplConfig = repConfig.getRepositoryImplConfig();
        assertEquals(SailRepositoryFactory.REPOSITORY_TYPE, repImplConfig.getType());
        SailImplConfig sailImplConfig = ((SailRepositoryConfig)repImplConfig).getSailImplConfig();
        assertEquals(MemoryStoreFactory.SAIL_TYPE, sailImplConfig.getType());
    }

    private void assertNativeSailTestConfig(RepositoryConfig repConfig){
        assertEquals("test-sail-native-repository", repConfig.getID());
        assertEquals("Test Native Sail Description" , repConfig.getTitle());
        RepositoryImplConfig repImplConfig = repConfig.getRepositoryImplConfig();
        assertEquals(SailRepositoryFactory.REPOSITORY_TYPE, repImplConfig.getType());
        SailImplConfig sailImplConfig = ((SailRepositoryConfig)repImplConfig).getSailImplConfig();
        assertEquals(NativeStoreFactory.SAIL_TYPE, sailImplConfig.getType());
    }

    private RepositoryConfig createTestMemorySailRepositoryConfig(String repID){
        final RepositoryConfig repConfig = new RepositoryConfig(
                repID , "Test Memory Sail Description");
        final SailRepositoryConfig sailImpl = new SailRepositoryConfig();
        final MemoryStoreConfig sailImplConfig = new MemoryStoreConfig();
        sailImpl.setSailImplConfig(sailImplConfig);
        repConfig.setRepositoryImplConfig(sailImpl);
        return repConfig;
    }

    private RepositoryConfig createTestNativeSailRepositoryConfig(String repID){
        final RepositoryConfig repConfig = new RepositoryConfig(
                repID , "Test Native Sail Description");
        final SailRepositoryConfig sailImpl = new SailRepositoryConfig();
        final NativeStoreConfig sailImplConfig = new NativeStoreConfig();
        sailImpl.setSailImplConfig(sailImplConfig);
        repConfig.setRepositoryImplConfig(sailImpl);
        return repConfig;
    }


    @Test
    public void testWriteMemorySailRepositoryConfigToFile() throws Exception {
        final RepositoryConfig repConfig = createTestMemorySailRepositoryConfig("test-sail-memory-repository");

        final Model model = new LinkedHashModel();
        repConfig.export(model, Values.bnode());

        final Model fileModel = TestUtils.readTurtleInputStreamIntoModel(
                TestUtils.readPlainTextTurtleInput(MEMORY_STORE_CONFIG_FILE),
                baseIri);

        // the config as in turtle file should be isomorphic as the model
        // created programmatically
        assertTrue(Models.isomorphic(fileModel, model));
    }


    @Test
    public void testWriteNativeSailRepositoryConfigToFile() throws Exception {
        final RepositoryConfig repConfig = createTestNativeSailRepositoryConfig("test-sail-native-repository");

        final Model model = new LinkedHashModel();
        repConfig.export(model, Values.bnode());

        final Model fileModel = TestUtils.readTurtleInputStreamIntoModel(
                TestUtils.readPlainTextTurtleInput(NATIVE_STORE_CONFIG_FILE),
                baseIri);

        // the config as in turtle file should be isomorphic as the model
        // created programmatically
        assertTrue(Models.isomorphic(fileModel, model));
    }

    private void writeConfigToStorage(String repositoryId, InputStream content) throws IOException {
        try (SizedStream bufferedContent = SizedStream.bufferAndMeasure(content)) {
            storage.getObjectStorage().appendObject(
                RepositoryConfigUtils.getConfigObjectPath(repositoryId),
                storage.getPlatformStorage().getDefaultMetadata(),
                bufferedContent.getStream(),
                bufferedContent.getLength()
            );
        }
    }

    @Test
    public void testReadRepositoryConfigurationFile() throws Exception {
        URL fileUrl = RepositoryConfigUtilsTest.class.getResource(MEMORY_STORE_CONFIG_FILE);
        writeConfigToStorage("test-sail-memory-repository", fileUrl.openStream());
        RepositoryConfig repConfig = RepositoryConfigUtils.readRepositoryConfigurationFile(
            storage.getPlatformStorage(), "test-sail-memory-repository");
        assertMemorySailTestConfig(repConfig);
    }

    @Test
    public void testReadInvalidRepositoryConfigurationFile() throws Exception {
        final Model model = new LinkedHashModel();
        final RepositoryConfig repConfig = createTestMemorySailRepositoryConfig("test-sail-memory-repository-invalid");
        repConfig.export(model, Values.bnode());

        model.remove(null, SailConfigSchema.SAILTYPE, null);
        try (ByteArrayOutputStream os = new ByteArrayOutputStream()) {
            Rio.write(model, os, RDFFormat.TURTLE);
            writeConfigToStorage("test-sail-memory-repository-invalid", os.toInputStream());
        }

        MpAssert.assertThrows("No Sail implementation specified for Sail repository", RepositoryConfigException.class,
                () -> {
                    RepositoryConfigUtils.readRepositoryConfigurationFile(storage.getPlatformStorage(),
                            "test-sail-memory-repository-invalid");
                });
    }

    @Test
    public void testWriteRepositoryConfigAsPrettyTurtleToFile() throws Exception {
        final RepositoryConfig repConfig = createTestMemorySailRepositoryConfig("test-sail-memory-repository");

        RepositoryConfigUtils.writeRepositoryConfigAsPrettyTurtleToFile(
            storage.getObjectStorage(), storage.getPlatformStorage().getDefaultMetadata(), repConfig, false);

        RepositoryConfig repConfigFromFile = RepositoryConfigUtils.readRepositoryConfigurationFile(
            storage.getPlatformStorage(), "test-sail-memory-repository");
        assertMemorySailTestConfig(repConfigFromFile);
    }

    @Test
    public void testWriteRepositoryConfigAsPrettyTurtleToFileFail() throws Exception {
        final RepositoryConfig repConfig = createTestMemorySailRepositoryConfig("test-sail-memory-repository");

        RepositoryConfigUtils.writeRepositoryConfigAsPrettyTurtleToFile(
            storage.getObjectStorage(), storage.getPlatformStorage().getDefaultMetadata(), repConfig, false);

        RepositoryConfig repConfigFromFile = RepositoryConfigUtils.readRepositoryConfigurationFile(
            storage.getPlatformStorage(), "test-sail-memory-repository");
        assertMemorySailTestConfig(repConfigFromFile);

        MpAssert.assertThrows(
                "Repository configuration for \"test-sail-memory-repository\" already exists, but is not supposed to be overwritten by the method which is calling this function.",
                IOException.class, () -> {

                    RepositoryConfigUtils.writeRepositoryConfigAsPrettyTurtleToFile(storage.getObjectStorage(),
                            storage.getPlatformStorage().getDefaultMetadata(), repConfig, false);
                });
    }

    @Test
    public void testWriteInvalidRepositoryConfigAsPrettyTurtleToFile() throws Exception {
        final RepositoryConfig repConfig = createTestMemorySailRepositoryConfig("test-sail-memory-repository-invalid");
        ((SailRepositoryConfig)repConfig.getRepositoryImplConfig()).setSailImplConfig(null);
        MpAssert.assertThrows("No Sail implementation specified for Sail repository", RepositoryConfigException.class,
                () -> {
                    RepositoryConfigUtils.writeRepositoryConfigAsPrettyTurtleToFile(storage.getObjectStorage(),
                            storage.getPlatformStorage().getDefaultMetadata(), repConfig, false);
                });
    }

    @Test
    public void testWriteModelAsPrettyTurtleToFileOverwrite() throws Exception {
        final RepositoryConfig repConfig = createTestMemorySailRepositoryConfig("test-sail-memory-repository");

        RepositoryConfigUtils.writeRepositoryConfigAsPrettyTurtleToFile(
            storage.getObjectStorage(), storage.getPlatformStorage().getDefaultMetadata(), repConfig, false);

        RepositoryConfig repConfigFromFile = RepositoryConfigUtils.readRepositoryConfigurationFile(
            storage.getPlatformStorage(), "test-sail-memory-repository");
        assertMemorySailTestConfig(repConfigFromFile);

        RepositoryConfig repConfigChanged = createTestMemorySailRepositoryConfig("test-sail-memory-repository");
        repConfigChanged.setTitle("This is a config being overwriten.");
        RepositoryConfigUtils.writeRepositoryConfigAsPrettyTurtleToFile(
            storage.getObjectStorage(), storage.getPlatformStorage().getDefaultMetadata(), repConfigChanged, true);

        RepositoryConfig repConfigChangedFromFile = RepositoryConfigUtils.readRepositoryConfigurationFile(
            storage.getPlatformStorage(), "test-sail-memory-repository");
        assertEquals("This is a config being overwriten." ,repConfigChangedFromFile.getTitle());
    }

    @Test
    public void testCharacterHandlingInRepositoryConfigIdRead() throws Exception {
        final RepositoryConfig repConfig = createTestMemorySailRepositoryConfig("test/sail-memory-repository");

        RepositoryConfigUtils.writeRepositoryConfigAsPrettyTurtleToFile(
            storage.getObjectStorage(), storage.getPlatformStorage().getDefaultMetadata(), repConfig, false);

        RepositoryConfig repConfigFromFile = RepositoryConfigUtils.readRepositoryConfigurationFile(
            storage.getPlatformStorage(), "test-sail-memory-repository");
        assertMemorySailTestConfig(repConfigFromFile);
    }

    @Test
    public void testFailReadRepositoryConfigurationFile() throws Exception {
        URL fileUrl = RepositoryConfigUtilsTest.class.getResource(MEMORY_STORE_CONFIG_FILE);
        writeConfigToStorage("not-valid-config-id", fileUrl.openStream());
        MpAssert.assertThrows("Repository configuration for \"test-sail-memory-repository\" does not exist.",
                IllegalArgumentException.class, () -> {
                    RepositoryConfigUtils.readRepositoryConfigurationFile(storage.getPlatformStorage(),
                            "test-sail-memory-repository");
                });
    }

    @Test
    public void testFailReadRepositoryConfigurationFileIdDoesNotMatch() throws Exception {
        URL fileUrl = RepositoryConfigUtilsTest.class.getResource(MEMORY_STORE_CONFIG_FILE);
        writeConfigToStorage("not-valid-config-id", fileUrl.openStream());
        MpAssert.assertThrows("Repository configuration for \"test-sail-memory-repository\" does not exist.",
                IllegalArgumentException.class, () -> {
                    RepositoryConfigUtils.readRepositoryConfigurationFile(storage.getPlatformStorage(),
                            "test-sail-memory-repository");
                });
    }

    @Test
    public void testReadInitialRepositoryConfigsFromFileSystem() throws Exception {
        URL memoryFile = RepositoryConfigUtilsTest.class.getResource(MEMORY_STORE_CONFIG_FILE);
        writeConfigToStorage("test-sail-memory-repository", memoryFile.openStream());
        URL nativeFile = RepositoryConfigUtilsTest.class.getResource(NATIVE_STORE_CONFIG_FILE);
        writeConfigToStorage("test-sail-native-repository", nativeFile.openStream());

        Map<String, RepositoryConfig> map = RepositoryConfigUtils
            .readInitialRepositoryConfigsFromStorage(storage.getPlatformStorage());

        assertEquals(2,map.size());

        assertMemorySailTestConfig(map.get("test-sail-memory-repository"));
        assertNativeSailTestConfig(map.get("test-sail-native-repository"));
    }
}
