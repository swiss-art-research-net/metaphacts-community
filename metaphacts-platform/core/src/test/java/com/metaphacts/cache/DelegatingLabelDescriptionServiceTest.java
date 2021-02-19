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

import com.google.common.collect.Lists;
import com.google.inject.Inject;
import com.metaphacts.config.UnknownConfigurationException;
import com.metaphacts.junit.AbstractRepositoryBackedIntegrationTest;
import com.metaphacts.junit.NamespaceRule;
import com.metaphacts.junit.PlatformStorageRule;
import com.metaphacts.junit.TestPlatformStorage;
import com.metaphacts.lookup.api.LookupProcessingException;
import com.metaphacts.lookup.api.LookupService;
import com.metaphacts.lookup.api.LookupServiceManager;
import com.metaphacts.lookup.impl.AbstractLookupService;
import com.metaphacts.lookup.impl.CommonLookupConfig;
import com.metaphacts.lookup.model.*;
import com.metaphacts.util.QueryUtil;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.vocabulary.FOAF;
import org.eclipse.rdf4j.model.vocabulary.RDFS;
import org.eclipse.rdf4j.model.vocabulary.SKOS;

import org.junit.*;
import java.util.*;

/**
 * Test cases for {@link DelegatingLabelService} functionality.
 *
 * @author Daniil Razdiakonv <dr@metaphacts.com>
 */
public class DelegatingLabelDescriptionServiceTest extends AbstractRepositoryBackedIntegrationTest {
    private static final ValueFactory vf = SimpleValueFactory.getInstance();

    private final static String CUSTOM_NAMESPACE = "http://my.custom.namespace/";

    private static final IRI IRI_1 = vf.createIRI(CUSTOM_NAMESPACE + "s1");
    private static final Literal IRI1_LABEL_NO_LANG = vf.createLiteral("label s1 (no language tag)");
    private static final Literal IRI1_DESCRIPTION_NO_LANG = vf.createLiteral("It's the test description for the test");

    private static final IRI ALICE = vf.createIRI("http://www.metaphacts.com/Alice");
    private static final Literal ALICE_NAME = vf.createLiteral("Alice");
    private static final Literal ALICE_DESCRIPTION = vf.createLiteral("Alice is the character of the fairy tale");

    private static final IRI BOB = vf.createIRI("http://www.metaphacts.com/Bob");
//    private static final Literal BOB_NAME = vf.createLiteral("Bob");
//    private static final Literal BOB_DESCRIPTION = vf.createLiteral("Bob is just a Bob");

    @Inject
    protected LookupServiceManager lookupServiceManager;

    @Inject
    @Rule
    public NamespaceRule namespaceRule;

    @Inject
    @Rule
    public PlatformStorageRule storageRule;

    @Inject
    LabelService labelCache;

    @Inject
    DescriptionService descriptionCache;

    @Before
    public void setup() throws Exception {
        namespaceRule.set("rdfs",RDFS.NAMESPACE);
        namespaceRule.set("skos",SKOS.NAMESPACE);
        namespaceRule.set("myns",CUSTOM_NAMESPACE);
        this.addStatements(Lists.newArrayList(
            vf.createStatement(IRI_1, RDFS.LABEL, IRI1_LABEL_NO_LANG),
            vf.createStatement(IRI_1, RDFS.COMMENT, IRI1_DESCRIPTION_NO_LANG)
        ));
    }

    @After
    public void tearDown() throws Exception {
        repositoryRule.delete();
    }

    @Test
    public void testCheckExtractingLabelsAndDescriptionBeforeAndAfterUsingLookupService() throws Exception {
        setPreferredLabelRdfsLabel(); // only rdfs:label considered as label

        final Optional<Literal> label1 =
            labelCache.getLabel(IRI_1, repositoryRule.getRepository(), null);
        // whatever the default will be, it should return the label
        Assert.assertTrue(label1.isPresent());
        Assert.assertEquals(IRI1_LABEL_NO_LANG.stringValue(), label1.get().stringValue());

        final Optional<Literal> description1 =
                descriptionCache.getDescription(IRI_1, repositoryRule.getRepository(), null);
        // whatever the default will be, it should return the description
        Assert.assertTrue(description1.isPresent());
        Assert.assertEquals(IRI1_DESCRIPTION_NO_LANG.stringValue(), description1.get().stringValue());

        final Optional<Literal> label2 =
                labelCache.getLabel(ALICE, repositoryRule.getRepository(), null);
        // whatever the default will be, it shouldn't return the label
        Assert.assertFalse(label2.isPresent());

        final Optional<Literal> description2 =
                descriptionCache.getDescription(ALICE, repositoryRule.getRepository(), null);
        // whatever the default will be, it shouldn't return the description
        Assert.assertFalse(description2.isPresent());

        final Optional<Literal> label2_1 =
                labelCache.getLabel(BOB, repositoryRule.getRepository(), null);
        // whatever the default will be, it shouldn't return the label
        Assert.assertFalse(label2_1.isPresent());

        final Optional<Literal> description2_1 =
                descriptionCache.getDescription(BOB, repositoryRule.getRepository(), null);
        // whatever the default will be, it shouldn't return the description
        Assert.assertFalse(description2_1.isPresent());

        // perform lookup request and the response should be cached as descriptions and labels
        Optional<LookupService> lookupService = setupMockLookupService();
        LookupRequest request = new LookupRequest("test-query", new LookupQuery(
            ALICE_NAME.stringValue(), 3, FOAF.AGENT.stringValue(), null, null, null));
        LookupResponse response = lookupService.get().lookup(request);

        Assert.assertEquals(1, response.getResult().size());
        LookupCandidate candidate1 = response.getResult().get(0);
        Assert.assertEquals(ALICE.stringValue(), candidate1.getId());
        Assert.assertEquals(ALICE_NAME.stringValue(), candidate1.getName());

        final Optional<Literal> label3 =
                labelCache.getLabel(ALICE, repositoryRule.getRepository(), null);
        // Now it should return the label
        Assert.assertTrue(label3.isPresent());

        final Optional<Literal> description3 =
                descriptionCache.getDescription(ALICE, repositoryRule.getRepository(), null);
        // Now it should return the label
        Assert.assertTrue(description3.isPresent());

        final Optional<Literal> label3_1 =
                labelCache.getLabel(BOB, repositoryRule.getRepository(), null);
        // it still shouldn't return the label
        Assert.assertFalse(label3_1.isPresent());

        final Optional<Literal> description3_1 =
                descriptionCache.getDescription(BOB, repositoryRule.getRepository(), null);
        // it still shouldn't return the description
        Assert.assertFalse(description3_1.isPresent());
    }
    
    @Test
    public void testCheckExtractingMultipleLabelsAndDescriptionBeforeAndAfterUsingLookupService() throws Exception {
        setPreferredLabelRdfsLabel(); // only rdfs:label considered as label

        final Optional<Literal> label1 =
            labelCache.getLabel(IRI_1, repositoryRule.getRepository(), null);
        // whatever the default will be, it should return the label
        Assert.assertTrue(label1.isPresent());
        Assert.assertEquals(IRI1_LABEL_NO_LANG.stringValue(), label1.get().stringValue());

        final Optional<Literal> description1 =
                descriptionCache.getDescription(IRI_1, repositoryRule.getRepository(), null);
        // whatever the default will be, it should return the description
        Assert.assertTrue(description1.isPresent());
        Assert.assertEquals(IRI1_DESCRIPTION_NO_LANG.stringValue(), description1.get().stringValue());

        final Optional<Literal> label2 =
                labelCache.getLabel(ALICE, repositoryRule.getRepository(), null);
        // whatever the default will be, it shouldn't return the label
        Assert.assertFalse(label2.isPresent());

        final Optional<Literal> description2 =
                descriptionCache.getDescription(ALICE, repositoryRule.getRepository(), null);
        // whatever the default will be, it shouldn't return the description
        Assert.assertFalse(description2.isPresent());

        final Optional<Literal> label2_1 =
                labelCache.getLabel(BOB, repositoryRule.getRepository(), null);
        // whatever the default will be, it shouldn't return the label
        Assert.assertFalse(label2_1.isPresent());

        final Optional<Literal> description2_1 =
                descriptionCache.getDescription(BOB, repositoryRule.getRepository(), null);
        // whatever the default will be, it shouldn't return the description
        Assert.assertFalse(description2_1.isPresent());

        // perform lookup request and the response should be cached as descriptions and labels
        Optional<LookupService> lookupService = setupMockLookupService();
        LookupRequest request = new LookupRequest("test-query", new LookupQuery(
            ALICE_NAME.stringValue(), 3, FOAF.AGENT.stringValue(), null, null, null));
        LookupResponse response = lookupService.get().lookup(request);

        Assert.assertEquals(1, response.getResult().size());
        LookupCandidate candidate1 = response.getResult().get(0);
        Assert.assertEquals(ALICE.stringValue(), candidate1.getId());
        Assert.assertEquals(ALICE_NAME.stringValue(), candidate1.getName());

        // get multiple labels and descriptions
        Map<IRI, Optional<Literal>> labels = labelCache.getLabels(Arrays.asList(IRI_1, ALICE, BOB), repositoryRule.getRepository(), null);
        long availableLabels = labels.values().stream().filter(l -> l.isPresent()).count();
        Assert.assertEquals("Should have labels for IRI_1 and Alice, but not for Bob", 2, availableLabels);
        
        
        Map<IRI, Optional<Literal>> descriptions = descriptionCache.getDescriptions(Arrays.asList(IRI_1, ALICE, BOB), repositoryRule.getRepository(), null);
        long availableDescriptions = descriptions.values().stream().filter(l -> l.isPresent()).count();
        Assert.assertEquals("Should have descriptions for IRI_1 and Alice, but not for Bob", 2, availableDescriptions);
    }

    @Test
    public void testCheckExtractingLabelsAndDescriptionBeforeAndAfterUsingLookupServiceWithMultipleQuerying() throws Exception {
        setPreferredLabelRdfsLabel(); // only rdfs:label considered as label

        final Map<IRI, Optional<Literal>> labels =
                labelCache.getLabels(Arrays.asList(IRI_1, ALICE, BOB), repositoryRule.getRepository(), null);
        // whatever the default will be, it should return the label
        Assert.assertEquals(labels.size(), 3);
        Assert.assertEquals(labels.values().stream().filter(v -> v.isPresent()).count(), 1);

        final Map<IRI, Optional<Literal>> descriptions =
                descriptionCache.getDescriptions(Arrays.asList(IRI_1, ALICE, BOB), repositoryRule.getRepository(), null);
        // whatever the default will be, it should return the label
        Assert.assertEquals(3, descriptions.size());
        Assert.assertEquals(1, descriptions.values().stream().filter(v -> v.isPresent()).count());

        // perform lookup request and the response should be cached as descriptions and labels
        Optional<LookupService> lookupService = setupMockLookupService();
        LookupRequest request = new LookupRequest("test-query", new LookupQuery(
                ALICE_NAME.stringValue(), 3, FOAF.AGENT.stringValue(), null, null, null));
        LookupResponse response = lookupService.get().lookup(request);

        Assert.assertEquals(1, response.getResult().size());
        LookupCandidate candidate1 = response.getResult().get(0);
        Assert.assertEquals(ALICE.stringValue(), candidate1.getId());
        Assert.assertEquals(ALICE_NAME.stringValue(), candidate1.getName());

        final Map<IRI, Optional<Literal>> labels1 =
                labelCache.getLabels(Arrays.asList(IRI_1, ALICE, BOB), repositoryRule.getRepository(), null);
        // whatever the default will be, it should return the label
        Assert.assertEquals(3, labels1.size());
        Assert.assertEquals(2, labels1.values().stream().filter(v -> v.isPresent()).count());

        final Map<IRI, Optional<Literal>> descriptions1 =
                descriptionCache.getDescriptions(Arrays.asList(IRI_1, ALICE, BOB), repositoryRule.getRepository(), null);
        // whatever the default will be, it should return the label
        Assert.assertEquals(3, descriptions1.size());
        Assert.assertEquals(2, descriptions1.values().stream().filter(v -> v.isPresent()).count());
    }

    void setPreferredLabelRdfsLabel() {
        String preferredLabel = QueryUtil.toSPARQL(RDFS.LABEL);
        setUIConfigurationParameter("preferredLabels", preferredLabel);
    }

    private void setUIConfigurationParameter(String name, String value) {
        setUIConfigurationParameter(name, Collections.singletonList(value));
    }

    private void setUIConfigurationParameter(String name, List<String> values) {
        try {
            config.getUiConfig().setParameter(name, values, TestPlatformStorage.STORAGE_ID);
        } catch (UnknownConfigurationException e) {
            throw new RuntimeException(e);
        }
    }

    protected Optional<LookupService> setupMockLookupService() {
        CommonLookupConfig config = new CommonLookupConfig();
        String repositoryId = "test-repository";
        repositoryRule.addRepoWithLookupService(repositoryId, new AbstractLookupService<CommonLookupConfig>(config) {
            @Override
            protected LookupResponse doLookup(LookupRequest request) throws LookupProcessingException {
                List<LookupCandidate> candidates = new ArrayList<>();

                candidates.add(
                    new LookupCandidate(
                        ALICE.stringValue(),
                        ALICE_NAME.stringValue(),
                        null, 0.8, true, null,
                        ALICE_DESCRIPTION.stringValue()
                    )
                );

                return new LookupResponse(request.getQueryId(), candidates);
            }
        });

        Optional<LookupService> lookupService = lookupServiceManager.getLookupServiceByName(repositoryId);
        return lookupService;
    }
}
