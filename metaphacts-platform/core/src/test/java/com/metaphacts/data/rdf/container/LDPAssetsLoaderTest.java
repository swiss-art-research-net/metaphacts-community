/*
 * Copyright (C) 2015-2019, metaphacts GmbH
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

package com.metaphacts.data.rdf.container;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;

import javax.inject.Inject;

import org.eclipse.rdf4j.common.iteration.Iterations;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.LinkedHashModel;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.util.Models;
import org.eclipse.rdf4j.model.vocabulary.RDFS;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.rio.RDFFormat;
import org.eclipse.rdf4j.rio.Rio;
import org.eclipse.rdf4j.sail.memory.MemoryStore;
import org.eclipse.rdf4j.repository.sail.SailRepository;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

import com.google.inject.Injector;
import com.metaphacts.junit.AbstractIntegrationTest;
import com.metaphacts.repository.RepositoryManager;
import com.metaphacts.services.storage.api.ObjectKind;
import com.metaphacts.services.storage.api.ObjectMetadata;
import com.metaphacts.services.storage.api.ObjectStorage;
import com.metaphacts.services.storage.api.PathMapping;
import com.metaphacts.services.storage.api.PlatformStorage;

public class LDPAssetsLoaderTest extends AbstractIntegrationTest {
    
    private static ValueFactory VF = SimpleValueFactory.getInstance();
    
    @Inject
    private Injector injector;
    
    @Inject
    private PlatformStorage platformStorage;
    
    public LDPAssetsLoaderTest() {
        
    }
    
    @After
    public void tearDown() throws Exception {
        repositoryRule.delete();
    }

    
    @Test
    public void testLoadIntoEmpty() throws Exception {
        Model totalModel = Rio.parse(LDPApiInternal.class.getResourceAsStream(
                "testQueryContainerPermissions.trig"), "", RDFFormat.TRIG);
        LDPAssetsLoader loader = new LDPAssetsLoader();
        injector.injectMembers(loader);
        Assert.assertEquals(repositoryRule.getAssetRepository(), loader.repositoryManager.getAssetRepository());
        Assert.assertTrue(loader.repositoryManager.getAssetRepository().isInitialized());
        IRI contextIri = VF
                .createIRI("http://localhost:10214/container/queryContainer/test-query/context");
        IRI resourceIri = VF
                .createIRI("http://localhost:10214/container/queryContainer/test-query");
        Model model = totalModel.filter(null, null, null, contextIri);
        writeModelToStorage(resourceIri, model);
        try (RepositoryConnection con = repositoryRule.getAssetRepository().getConnection()) {
            loader.load();
            Model model2 = new LinkedHashModel(
                    Iterations.asList(con.getStatements(null, null, null, contextIri)));
            Assert.assertTrue(Models.isomorphic(model, model2));
        }
    }
    
    

    @Test
    public void testLoadIconsistent() throws Exception {
        try (RepositoryConnection con = repositoryRule.getAssetRepository().getConnection()) {
            con.add(LDPApiInternal.class.getResourceAsStream("testQueryContainerPermissions.trig"), "", RDFFormat.TRIG);
        }
        LDPAssetsLoader loader = new LDPAssetsLoader();
        injector.injectMembers(loader);
        IRI contextIri = VF.createIRI("http://localhost:10214/container/queryContainer/test-query/context");
        IRI resourceIri = VF.createIRI("http://localhost:10214/container/queryContainer/test-query");
        Model model = copyContextToModel(contextIri, repositoryRule.getAssetRepository());
        model.add(resourceIri, RDFS.COMMENT, VF.createLiteral("blahblah"), contextIri);
        writeModelToStorage(resourceIri, model);
        try {
            loader.load();
            Assert.fail("Loaded the asset from storage despite being inconsistent with the assets repository");
        } catch (IllegalStateException e) {
            Assert.assertTrue(e.getMessage().startsWith("Inconsistent state of the LDP assets storage"));
        }
    }

    
    private Model copyContextToModel(IRI contextIri, Repository repository) {
        try (RepositoryConnection con = repository.getConnection()) {
            Model model = new LinkedHashModel();
            model.addAll(Iterations.asList(con.getStatements(null, null, null, contextIri)));
            return model;
        }
    }
    
    private void writeModelToStorage(IRI pointer, Model model) throws Exception {
        String objectId = RepositoryManager.ASSET_REPOSITORY_ID + PathMapping.SEPARATOR
                + ObjectStorage.objectIdFromIri(pointer) + ".trig";
        ByteArrayOutputStream outStream = new ByteArrayOutputStream();
        
        Rio.write(model, outStream, RDFFormat.TRIG);
        byte[] bytes = outStream.toByteArray();
        
        ByteArrayInputStream content = new ByteArrayInputStream(bytes);
        platformStorage.getStorage(PlatformStorage.DEVELOPMENT_RUNTIME_STORAGE_KEY).appendObject(
                ObjectKind.LDP, objectId,
                new ObjectMetadata(null, null), 
                content,
                bytes.length);
    }
    
}
