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
package com.metaphacts.cache;

import java.net.URI;
import java.util.Optional;

import com.google.common.collect.Iterables;
import com.metaphacts.resource.TypeService;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.impl.TreeModel;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.model.vocabulary.RDFS;
import org.eclipse.rdf4j.model.vocabulary.SKOS;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.glassfish.grizzly.http.server.HttpServer;
import org.glassfish.jersey.grizzly2.httpserver.GrizzlyHttpServerFactory;
import org.glassfish.jersey.media.multipart.MultiPartFeature;
import org.glassfish.jersey.server.ResourceConfig;
import org.junit.After;
import org.junit.AfterClass;
import org.junit.Assert;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Rule;
import org.junit.Test;

import com.google.common.collect.Lists;
import com.google.inject.Inject;
import com.metaphacts.config.Configuration;
import com.metaphacts.junit.MetaphactsJerseyTest;
import com.metaphacts.junit.MetaphactsShiroRule;
import com.metaphacts.junit.NamespaceRule;
import com.metaphacts.junit.PlatformStorageRule;
import com.metaphacts.lookup.api.LookupServiceManager;
import com.metaphacts.lookup.impl.RemoteLookupConfig;
import com.metaphacts.lookup.impl.RemoteLookupService;
import com.metaphacts.reconciliation.RemoteTestReconciliationEndpoint;
import com.metaphacts.rest.endpoint.ReconciliationEndpoint;
import com.metaphacts.security.MetaphactsSecurityTestUtils;

/**
 * Test cases for {@link LookupBasedResourceInformationService} functionality.
 *
 * @author Daniil Razdiakonv <dr@metaphacts.com>
 */
public class LookupBasedResourceInformationServiceTest extends MetaphactsJerseyTest {
    private static final ValueFactory vf = SimpleValueFactory.getInstance();
    private static HttpServer server;

    private final static String CUSTOM_NAMESPACE = "http://my.custom.namespace/";
    static final String REMOTE_ENDPOINT_PATH = "remote/reconciliation";
    static final String REMOTE_BASE_URI = "http://localhost:10001/api/";
    static final String LOOKUP_REPOSITORY_2 = "my-lookup-2";

    private static final IRI IRI_1 = vf.createIRI(CUSTOM_NAMESPACE + "s1");
    private static final IRI IRI_1_TYPE = vf.createIRI(CUSTOM_NAMESPACE + "ExampleEntity");
    private static final IRI IRI_2_TYPE = vf.createIRI(CUSTOM_NAMESPACE + "ExampleEntity_remote");

    private static final Literal IRI1_LABEL_NO_LANG = vf.createLiteral("label s1 (no language tag)");
    private static final Literal IRI1_DESCRIPTION_NO_LANG = vf.createLiteral("It's the test description for the test");

    private static final IRI IRI_2 = vf.createIRI(CUSTOM_NAMESPACE + "s2");
    private static final Literal IRI2_LABEL_NO_LANG = vf.createLiteral("label s2 (no language tag)");
    private static final Literal IRI2_DESCRIPTION_NO_LANG = vf.createLiteral("It's the test description for the test");

    private static final IRI IRI_3 = vf.createIRI(CUSTOM_NAMESPACE + "s3");

    @Inject
    protected Configuration config;

    @Inject
    @Rule
    public NamespaceRule namespaceRule;

    @Inject
    @Rule
    public PlatformStorageRule storageRule;

    @Inject
    private LabelService labelService;

    @Inject
    private DescriptionService descriptionService;

    @Inject
    private TypeService typeService;

    @Inject
    private CacheManager cacheManager;

    @Inject
    private LookupServiceManager lookupServiceManager;

    @Inject
    @Rule
    public PlatformStorageRule platformStorageRule;

    @Rule
    public MetaphactsShiroRule rule = new MetaphactsShiroRule(() ->
            Lists.newArrayList(
                MetaphactsSecurityTestUtils.loadRealm(
                        "classpath:com/metaphacts/security/shiro-legacy.ini")
            ),
            () -> config
    ).withCacheManager(() -> cacheManager
    ).withPlatformStorageRule(() -> platformStorageRule)
            .withPlatformRole("admin", Lists.newArrayList("reconciliation:manifest:read"));

    @BeforeClass
    public static void beforeClass() {
        // TODO move this to a re-usable base class which properly takes care for
        // finding a suitable free port (e.g. relevant for parallel execution of tests)
        // Ideally this also has a retry mechanism with a given number of attempts
        final ResourceConfig rc = new ResourceConfig(RemoteTestReconciliationEndpoint.class);
        server = GrizzlyHttpServerFactory.createHttpServer(URI.create(REMOTE_BASE_URI), rc);
    }

    @AfterClass
    public static void afterClass() {
        server.shutdown();
    }

    @Before
    public void setup() throws Exception {
        namespaceRule.set("rdfs",RDFS.NAMESPACE);
        namespaceRule.set("skos",SKOS.NAMESPACE);
        namespaceRule.set("myns",CUSTOM_NAMESPACE);

        Model model = new TreeModel();
        model.addAll(Lists.newArrayList(
            vf.createStatement(IRI_1, RDFS.LABEL, IRI1_LABEL_NO_LANG),
            vf.createStatement(IRI_1, RDF.TYPE, IRI_1_TYPE),
            vf.createStatement(IRI_1, RDFS.COMMENT, IRI1_DESCRIPTION_NO_LANG)
        ));
        try (RepositoryConnection con = repositoryRule.getRepository().getConnection()) {
            con.add(model, vf.createIRI("http://www.metaphacts.com/test/graph"));
        }
    }

    @Override
    protected void register(ResourceConfig resourceConfig) {
        resourceConfig.register(MultiPartFeature.class);
        resourceConfig.register(ReconciliationEndpoint.class);
    }

    @After
    public void tearDown() throws Exception {
        repositoryRule.delete();
    }

    @Test
    public void lookupBasedTypeServiceTest() throws Exception {
        Repository repository = repositoryRule.getRepository();
        final Iterable<IRI> types_1 = typeService.getTypes(IRI_1, repository);
        Assert.assertFalse(Iterables.isEmpty(types_1));
        var iterator = types_1.iterator();
        Assert.assertEquals(IRI_1_TYPE, iterator.next());
        Assert.assertFalse(iterator.hasNext());

        final Iterable<IRI> types_2 = typeService.getTypes(IRI_2, repository);
        // This data is not on the local storage - only on the remote service, so the result is empty
        Assert.assertTrue(Iterables.isEmpty(types_2));

        // Now we are configuring the remote lookup, which implements label/description/type services as well,
        // so types_2 can be fetched from the remote via the LookupBasedResourceInformationService
        configureRemoteEndpoint();

        // Type for IRI_1 should still be available
        final Iterable<IRI> types_1_second_check = typeService.getTypes(IRI_1, repository);
        Assert.assertFalse(Iterables.isEmpty(types_1_second_check));
        iterator = types_1_second_check.iterator();
        Assert.assertEquals(IRI_1_TYPE, iterator.next());
        Assert.assertFalse(iterator.hasNext());

        // Now type for IRI_2 should be available via LookupBasedTypeService
        final Iterable<IRI> types_2_second_check = typeService.getTypes(IRI_2, repository);
        Assert.assertFalse(Iterables.isEmpty(types_2_second_check));
        iterator = types_2_second_check.iterator();
        Assert.assertEquals(IRI_2_TYPE, iterator.next());
        Assert.assertFalse(iterator.hasNext());

        // Fetch the type for a resource which should not return anything
        final Iterable<IRI> types_3 = typeService.getTypes(IRI_3, repository);
        Assert.assertTrue(Iterables.isEmpty(types_3));
    }

    @Test
    public void lookupBasedLabelDescriptionServiceTest() throws Exception {

        Repository repository = repositoryRule.getRepository();
        final Optional<Literal> label1 = labelService.getLabel(IRI_1, repository, null);
        Assert.assertTrue(label1.isPresent());
        Assert.assertEquals(IRI1_LABEL_NO_LANG.stringValue(), label1.get().stringValue());

        final Optional<Literal> description1 = descriptionService.getDescription(IRI_1, repository, null);
        Assert.assertTrue(description1.isPresent());
        Assert.assertEquals(IRI1_DESCRIPTION_NO_LANG.stringValue(), description1.get().stringValue());

        final Optional<Literal> label2_1 = labelService.getLabel(IRI_2, repository, null);
        // This data is not on the local storage - only on the remote service, so the result is empty
        Assert.assertTrue(label2_1.isEmpty());

        final Optional<Literal> description2_1 = descriptionService.getDescription(IRI_2, repository, null);
        // This data is not on the local storage - only on the remote service, so the result is empty
        Assert.assertTrue(description2_1.isEmpty());

        // Now we are configuring the remote lookup, which implements label/description services as well,
        // so label2_1, description2_1 can be fetched from the remote via the LookupBasedResourceInformationService
        configureRemoteEndpoint();

        final Optional<Literal> label2_2 = labelService.getLabel(IRI_2, repository, null);
        Assert.assertTrue(label2_2.isPresent());
        Assert.assertEquals(IRI2_LABEL_NO_LANG.stringValue(), label2_2.get().stringValue());

        final Optional<Literal> description2_2 = descriptionService.getDescription(IRI_2, repository, null);
        Assert.assertTrue(description2_2.isPresent());
        Assert.assertEquals(IRI2_DESCRIPTION_NO_LANG.stringValue(), description2_2.get().stringValue());

        // Fetch label again, it should be cached now
        // TODO ensure that we are now using the cache
        final Optional<Literal> label2_3 = labelService.getLabel(IRI_2, repository, null);
        Assert.assertTrue(label2_3.isPresent());
        Assert.assertEquals(IRI2_LABEL_NO_LANG.stringValue(), label2_3.get().stringValue());

        // Fetch the label for a resource which should not return anything (or rather
        // the local name as fallback)
        final Optional<Literal> label3_1 = labelService.getLabel(IRI_3, repository, null);
        Assert.assertFalse(label3_1.isPresent());

        // Fetch again the label for a resource which should not return anything
        // TODO ensure that the negative result was served from the cache
        final Optional<Literal> label3_2 = labelService.getLabel(IRI_3, repository, null);
        Assert.assertFalse(label3_2.isPresent());
    }

    private void configureRemoteEndpoint() throws Exception {
        RemoteLookupConfig config = new RemoteLookupConfig();
        config.setRemoteServiceUrl(REMOTE_BASE_URI + REMOTE_ENDPOINT_PATH);
        config.setRemoteInformationServiceEnabled(true);

        if (repositoryRule.getRepositoryManager().getInitializedRepositoryIds().contains(LOOKUP_REPOSITORY_2)) {
            repositoryRule.getRepositoryManager().deleteRepositoryConfig(LOOKUP_REPOSITORY_2);
        }
        repositoryRule.addRepoWithLookupService(LOOKUP_REPOSITORY_2, new RemoteLookupService(config));
        lookupServiceManager.reloadLookupServices();
        cacheManager.invalidateAll();
    }
}
