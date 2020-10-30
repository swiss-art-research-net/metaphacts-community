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
package com.metaphacts.cache;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.eclipse.rdf4j.model.BNode;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.model.vocabulary.RDFS;
import org.eclipse.rdf4j.model.vocabulary.SKOS;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;

import com.google.common.collect.Lists;
import com.google.inject.Inject;
import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.config.PropertyPattern;
import com.metaphacts.config.UnknownConfigurationException;
import com.metaphacts.junit.AbstractRepositoryBackedIntegrationTest;
import com.metaphacts.junit.NamespaceRule;
import com.metaphacts.junit.PlatformStorageRule;
import com.metaphacts.junit.TestPlatformStorage;
import com.metaphacts.util.QueryUtil;

/**
 * Test cases for {@link DescriptionCache} functionality
 * in the part of description cache.
 *
 * @author Daniil Razdiakonov <dr@metaphacts.com>
 */
public class DescriptionCacheTest extends AbstractRepositoryBackedIntegrationTest {
    ValueFactory vf = SimpleValueFactory.getInstance();

    private final static String CUSTOM_NAMESPACE = "http://my.custom.namespace/";

    private final static String IRI1 = CUSTOM_NAMESPACE + "s1";
    private final static String IRI1_DESCRIPTION_NOLANG = "Description s1 (no language tag)";
    private final static String IRI1_DESCRIPTION_EN = "Description s1 (en)";
    private final static String IRI1_DESCRIPTION_DE = "Description s1 (de)";
    private final static String IRI1_DESCRIPTION_RU = "Description s1 (ru)";
    private final static String IRI1_DESCRIPTION_FR = "Description s1 (fr)";

    private final static String IRI2 = CUSTOM_NAMESPACE + "s2";
    private final static String IRI2_DESCRIPTION_NOLANG = "Description s2 (no language tag)";
    private final static String IRI2_DESCRIPTION_EN = "Description s2 (en)";
    private final static String IRI2_DESCRIPTION_DE = "Description s2 (de)";
    private final static String IRI2_DESCRIPTION_RU = "Description s2 (ru)";
    private final static String IRI2_DESCRIPTION_FR = "Description s2 (fr)";

    private final static String IRI3 = CUSTOM_NAMESPACE + "s3";
    private final static String IRI3_DESCRIPTION_EN = "Description s3 (en)";
    private final static String IRI3_DESCRIPTION_DE = "Description s3 (de)";
    private final static String IRI3_DESCRIPTION_FR = "Description s3 (fr)";

    private final static String CUSTOM_DESCRIPTION = CUSTOM_NAMESPACE + "description";

    private final static String LANGUAGE_TAG_DE = "de";
    private final static String LANGUAGE_TAG_EN = "en";
    private final static String LANGUAGE_TAG_RU = "ru";
    private final static String LANGUAGE_TAG_FR = "fr";

    @Inject
    @Rule
    public NamespaceRule namespaceRule;

    @Inject
    @Rule
    public PlatformStorageRule storageRule;

    @Inject
    DescriptionCache descriptionCache;


    @Before
    public void setup() throws Exception {
        namespaceRule.set("rdfs",RDFS.NAMESPACE);
        namespaceRule.set("skos",SKOS.NAMESPACE);
        namespaceRule.set("myns",CUSTOM_NAMESPACE);
    }

    @After
    public void tearDown() throws Exception {

        repositoryRule.delete();
    }

    @Test
    public void testExtractUnknownDescriptionEmptyDB() throws Exception {
        setPreferredDescriptionRdfsComment(); // only rdfs:comment considered as description
        final Optional<Literal> description =
            descriptionCache.getDescription(asIRI(IRI1), repositoryRule.getRepository(), null);

        Assert.assertFalse(description.isPresent());
    }

    @Test
    public void testExtractUnknownDescriptionNonEmptyDB() throws Exception {
        setPreferredDescriptionRdfsComment(); // only rdfs:comment considered as description
        // add a non-description statement for the given IRI
        addStatement(vf.createStatement(asIRI(IRI1), RDF.TYPE, asIRI(IRI2)));

        final Optional<Literal> description =
            descriptionCache.getDescription(asIRI(IRI1), repositoryRule.getRepository(), null);

        Assert.assertFalse(description.isPresent());
    }

    @Test
    public void testExtractKnownDescriptionWithDefaultLanguageTag() throws Exception {
        setPreferredDescriptionRdfsComment(); // only rdfs:comment considered as description
        addIri1NoLangTypeLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_NOLANG);

        final Optional<Literal> description =
            descriptionCache.getDescription(asIRI(IRI1), repositoryRule.getRepository(), null);

        // whatever the default will be, it should return the description
        Assert.assertTrue(description.isPresent());
        Assert.assertEquals(IRI1_DESCRIPTION_NOLANG, description.get().stringValue());
    }

    @Test
    public void testExtractKnownDescriptionWithNonMatchingLanguageTag01() throws Exception {
        setPreferredDescriptionRdfsComment(); // only rdfs:comment considered as description
        setPreferredLanguageEn();

        addIri1NoLangTypeLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_DE);

        final Optional<Literal> description =
            descriptionCache.getDescription(asIRI(IRI1), repositoryRule.getRepository(), null);

        // although not matching the language tag, the "de" description is better
        // than nothing, so it should be returned
        Assert.assertTrue(description.isPresent());
        Assert.assertEquals(IRI1_DESCRIPTION_DE, description.get().stringValue());
    }

    @Test
    public void testExtractKnownDescriptionWithNonMatchingLanguageTag02() throws Exception {
        setPreferredDescriptionRdfsComment(); // only rdfs:comment considered as description
        setPreferredLanguageEn();

        addIri1NoLangTypeLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_NOLANG);

        final Optional<Literal> description =
            descriptionCache.getDescription(asIRI(IRI1), repositoryRule.getRepository(), null);

        // although not matching the language tag, the none language tag
        // description is better than nothing, so it should be returned
        Assert.assertTrue(description.isPresent());
        Assert.assertEquals(IRI1_DESCRIPTION_NOLANG, description.get().stringValue());
    }

    @Test
    public void testSingleDescriptionSingleLanguageSingleResource01() throws Exception {
        setPreferredDescriptionRdfsComment(); // only rdfs:comment considered as description
        setPreferredLanguageEn();

        addIri1NoLangTypeLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_NOLANG);
        addIri1DeLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_DE);
        addIri1EnLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_EN);
        addIri1RuLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_RU);

        final Optional<Literal> description =
            descriptionCache.getDescription(asIRI(IRI1), repositoryRule.getRepository(), null);

        Assert.assertTrue(description.isPresent());
        Assert.assertEquals(IRI1_DESCRIPTION_EN, description.get().stringValue());
    }

    @Test
    public void testSingleDescriptionSingleLanguageSingleResource02() throws Exception {
        setPreferredDescriptionRdfsComment(); // only rdfs:comment considered as description
        setPreferredLanguageDe();

        addIri1NoLangTypeLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_NOLANG);
        addIri1DeLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_DE);
        addIri1EnLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_EN);
        addIri1RuLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_RU);

        final Optional<Literal> description =
            descriptionCache.getDescription(asIRI(IRI1), repositoryRule.getRepository(), null);

        Assert.assertTrue(description.isPresent());
        Assert.assertEquals(IRI1_DESCRIPTION_DE, description.get().stringValue());
    }

    @Test
    public void testSingleDescriptionSingleLanguageSingleResource03() throws Exception {
        setPreferredDescriptionRdfsComment(); // only rdfs:comment considered as description
        setPreferredLanguageRu();

        addIri1NoLangTypeLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_NOLANG);
        addIri1DeLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_DE);
        addIri1EnLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_EN);
        addIri1RuLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_RU);

        final Optional<Literal> description =
            descriptionCache.getDescription(asIRI(IRI1), repositoryRule.getRepository(), null);

        Assert.assertTrue(description.isPresent());
        Assert.assertEquals(IRI1_DESCRIPTION_RU, description.get().stringValue());
    }


    @Test
    public void testSingleDescriptionMultipleLanguagesSingleResource01() throws Exception {
        setPreferredDescriptionRdfsComment(); // only rdfs:comment considered as description
        setPreferredLanguageEnNoneDe();

        addIri1NoLangTypeLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_NOLANG);
        addIri1DeLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_DE);
        addIri1EnLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_EN);
        addIri1RuLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_RU);

        final Optional<Literal> description =
            descriptionCache.getDescription(asIRI(IRI1), repositoryRule.getRepository(), null);

        Assert.assertTrue(description.isPresent());
        Assert.assertEquals(IRI1_DESCRIPTION_EN, description.get().stringValue());
    }

    @Test
    public void testSingleDescriptionMultipleLanguagesSingleResource02() throws Exception {
        setPreferredDescriptionRdfsComment(); // only rdfs:comment considered as description
        setPreferredLanguageEnNoneDe();

        addIri1NoLangTypeLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_NOLANG);
        addIri1DeLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_DE);
        addIri1RuLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_RU);

        final Optional<Literal> description =
            descriptionCache.getDescription(asIRI(IRI1), repositoryRule.getRepository(), null);

        Assert.assertTrue(description.isPresent());
        Assert.assertEquals(IRI1_DESCRIPTION_NOLANG, description.get().stringValue());
    }

    @Test
    public void testSingleDescriptionMultipleLanguagesSingleResource03() throws Exception {
        setPreferredDescriptionRdfsComment(); // only rdfs:comment considered as description
        setPreferredLanguageEnNoneDe();

        addIri1FrLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_FR);
        addIri1DeLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_DE);

        final Optional<Literal> description =
            descriptionCache.getDescription(asIRI(IRI1), repositoryRule.getRepository(), null);

        Assert.assertTrue(description.isPresent());
        Assert.assertEquals(IRI1_DESCRIPTION_DE, description.get().stringValue());
    }

    @Test
    public void testSingleDescriptionMultipleLanguagesSingleResource04() throws Exception {
        setPreferredDescriptionRdfsComment(); // only rdfs:comment considered as description
        setPreferredLanguageEnNoneDe();

        addIri1NoLangTypeLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_NOLANG);
        addIri1FrLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_FR);

        final Optional<Literal> description =
            descriptionCache.getDescription(asIRI(IRI1), repositoryRule.getRepository(), null);

        Assert.assertTrue(description.isPresent());
        Assert.assertEquals(IRI1_DESCRIPTION_NOLANG, description.get().stringValue());
    }

    @Test
    public void testSingleDescriptionSingeLanguageMultipleResources01() throws Exception {
        setPreferredDescriptionRdfsComment(); // only rdfs:comment considered as description
        setPreferredLanguageEnNoneDe();

        addIri1FrLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_FR);

        final Optional<Literal> description =
            descriptionCache.getDescription(asIRI(IRI1), repositoryRule.getRepository(), null);

        Assert.assertTrue(description.isPresent());
        Assert.assertEquals(IRI1_DESCRIPTION_FR, description.get().stringValue());
    }

    @Test
    public void testSingleDescriptionSingeLanguageMultipleResources02() throws Exception {
        setPreferredDescriptionRdfsComment(); // only rdfs:comment considered as description
        setPreferredLanguageEn();

        addIri1EnLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_EN);

        addIri2FrLiteral(RDFS.COMMENT, IRI2_DESCRIPTION_FR);
        addIri2RuLiteral(RDFS.COMMENT, IRI2_DESCRIPTION_RU);
        addIri2EnLiteral(RDFS.COMMENT, IRI2_DESCRIPTION_EN);
        addIri2NoLangTypeLiteral(RDFS.COMMENT, IRI2_DESCRIPTION_NOLANG);

        addIri3FrLiteral(RDFS.COMMENT, IRI3_DESCRIPTION_FR);

        final Map<IRI,Optional<Literal>> resultMap =
            descriptionCache.getDescriptions(asIRIList(IRI1,IRI2,IRI3), repositoryRule.getRepository(), null);

        Assert.assertEquals(3, resultMap.size());
        Assert.assertEquals(IRI1_DESCRIPTION_EN, resultMap.get(asIRI(IRI1)).get().stringValue());
        Assert.assertEquals(IRI2_DESCRIPTION_EN, resultMap.get(asIRI(IRI2)).get().stringValue());
        Assert.assertEquals(IRI3_DESCRIPTION_FR, resultMap.get(asIRI(IRI3)).get().stringValue());
    }

    @Test
    public void testSingleDescriptionSingeLanguageMultipleResources03() throws Exception {
        setPreferredDescriptionRdfsComment(); // only rdfs:comment considered as description
        setPreferredLanguageEn();

        addIri1EnLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_EN);

        // IRI2 and IRI3 missing

        final Map<IRI,Optional<Literal>> resultMap =
            descriptionCache.getDescriptions(asIRIList(IRI1,IRI2,IRI3), repositoryRule.getRepository(), null);

        Assert.assertEquals(3, resultMap.size());
        Assert.assertEquals(IRI1_DESCRIPTION_EN, resultMap.get(asIRI(IRI1)).get().stringValue());
        Assert.assertFalse(resultMap.get(asIRI(IRI2)).isPresent());
        Assert.assertFalse(resultMap.get(asIRI(IRI3)).isPresent());
    }

    @Test
    public void testMultipleDescriptionsSingleLanguageSingleResource01() throws Exception {
        setPreferredDescriptionRdfsDescriptionSkosDescriptionCustomDescription(); // rdfs, custom, skos
        setPreferredLanguageDe();

        addIri1EnLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_EN + "-rdfs");
        addIri1EnLiteral(SKOS.EDITORIAL_NOTE, IRI1_DESCRIPTION_EN + "-skos");
        addIri1EnLiteral((IRI)asIRI(CUSTOM_DESCRIPTION), IRI1_DESCRIPTION_EN + "-cust");

        addIri1DeLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_DE + "-rdfs");
        addIri1DeLiteral(SKOS.EDITORIAL_NOTE, IRI1_DESCRIPTION_DE + "-skos");
        addIri1DeLiteral((IRI)asIRI(CUSTOM_DESCRIPTION), IRI1_DESCRIPTION_DE + "-cust");

        addIri1RuLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_RU + "-rdfs");
        addIri1RuLiteral(SKOS.EDITORIAL_NOTE, IRI1_DESCRIPTION_RU + "-skos");
        addIri1RuLiteral((IRI)asIRI(CUSTOM_DESCRIPTION), IRI1_DESCRIPTION_RU + "-cust");

        addIri1NoLangTypeLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_NOLANG + "-rdfs");
        addIri1NoLangTypeLiteral(SKOS.EDITORIAL_NOTE, IRI1_DESCRIPTION_NOLANG + "-skos");
        addIri1NoLangTypeLiteral((IRI)asIRI(CUSTOM_DESCRIPTION), IRI1_DESCRIPTION_NOLANG + "-cust");

        final Optional<Literal> description =
            descriptionCache.getDescription(asIRI(IRI1), repositoryRule.getRepository(), null);

        Assert.assertTrue(description.isPresent());
        Assert.assertEquals(IRI1_DESCRIPTION_DE + "-rdfs", description.get().stringValue());
    }

    @Test
    public void testMultipleDescriptionsSingleLanguageSingleResource02() throws Exception {
        setPreferredDescriptionRdfsDescriptionSkosDescriptionCustomDescription(); // rdfs, custom, skos
        setPreferredLanguageDe();

        // SKOS description to be preferred because of better language tag
        addIri1EnLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_EN + "-rdfs");
        addIri1DeLiteral(SKOS.EDITORIAL_NOTE, IRI1_DESCRIPTION_DE + "-skos");

        final Optional<Literal> description =
            descriptionCache.getDescription(asIRI(IRI1), repositoryRule.getRepository(), null);

        Assert.assertTrue(description.isPresent());
        Assert.assertEquals(IRI1_DESCRIPTION_DE + "-skos", description.get().stringValue());
    }

    @Test
    public void testMultipleDescriptionsSingleLanguageSingleResource03() throws Exception {
        setPreferredDescriptionRdfsDescriptionSkosDescriptionCustomDescription(); // rdfs > skos > custom
        setPreferredLanguageDe();

        addIri1EnLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_EN + "-rdfs");
        addIri1DeLiteral(SKOS.EDITORIAL_NOTE, IRI1_DESCRIPTION_DE + "-skos");
        addIri1DeLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_DE + "-rdfs");

        final Optional<Literal> description =
            descriptionCache.getDescription(asIRI(IRI1), repositoryRule.getRepository(), null);

        Assert.assertTrue(description.isPresent());
        Assert.assertEquals(IRI1_DESCRIPTION_DE + "-rdfs", description.get().stringValue());
    }

    @Test
    public void testGetDescription() throws Exception{
        setPreferredDescriptionRdfsComment(); // only rdfs:comment considered as description

        addIri1NoLangTypeLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_NOLANG);

        final Optional<Literal> description =
            descriptionCache.getDescription(asIRI(IRI1), repositoryRule.getRepository(), null);

        // whatever the default will be, it should return the description
        Assert.assertTrue(description.isPresent());
        Assert.assertEquals(IRI1_DESCRIPTION_NOLANG, description.get().stringValue());

        // no description
        final Optional<Literal> description2 =
                descriptionCache.getDescription(asIRI(IRI2), repositoryRule.getRepository(), null);

        // => optional not present
        Assert.assertFalse(description2.isPresent());
        // resolveDescription should return null
        Assert.assertEquals(null, description2.orElse(null));

        // no description
        final Optional<Literal> description3 =
                descriptionCache.getDescription(asIRI(CUSTOM_NAMESPACE), repositoryRule.getRepository(), null);

        // => optional not present
        Assert.assertFalse(description3.isPresent());
        // no local name
        Assert.assertEquals("",asIRI(CUSTOM_NAMESPACE).getLocalName());
        // resolveDescription should return null
        Assert.assertEquals(null, description3.orElse(null));
    }

    @Test
    public void testMultipleDescriptionsMultipleLanguageMultipleResource() throws Exception {
        setPreferredDescriptionRdfsDescriptionSkosDescriptionCustomDescription(); // rdfs > skos > custom
        setPreferredLanguageEnNoneDe();                   // en > none > de

        addIri1RuLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_RU + "-rdfs");
        addIri1DeLiteral(SKOS.EDITORIAL_NOTE, IRI1_DESCRIPTION_DE + "-skos");
        addIri1DeLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_DE + "-rdfs");
        addIri1NoLangTypeLiteral(SKOS.EDITORIAL_NOTE, IRI1_DESCRIPTION_NOLANG); // best match due to language tag

        addIri2EnLiteral(asIRI("http://p"), IRI2_DESCRIPTION_EN);
        addIri2DeLiteral(asIRI("http://p"), IRI2_DESCRIPTION_DE);
        addIri2RuLiteral(asIRI(CUSTOM_DESCRIPTION), IRI2_DESCRIPTION_RU); // only one matching ant of the descriptions

        addIri3EnLiteral(asIRI("http://p"), IRI3_DESCRIPTION_EN);
        addIri3DeLiteral(asIRI("http://p"), IRI3_DESCRIPTION_DE);


        final Map<IRI,Optional<Literal>> resultMap =
                descriptionCache.getDescriptions(asIRIList(IRI1,IRI2,IRI3), repositoryRule.getRepository(), null);

        Assert.assertEquals(3, resultMap.size());
        Assert.assertEquals(IRI1_DESCRIPTION_NOLANG, resultMap.get(asIRI(IRI1)).get().stringValue());
        Assert.assertEquals(IRI2_DESCRIPTION_RU, resultMap.get(asIRI(IRI2)).get().stringValue());
        Assert.assertFalse(resultMap.get(asIRI(IRI3)).isPresent());
    }

    @Test
    public void testConstructDescriptionQuery() {
        List<IRI> iris = Lists.newArrayList(asIRI(IRI1), asIRI(IRI2));

        NamespaceRegistry namespaceRegistry = namespaceRule.getNamespaceRegistry();

        List<PropertyPattern> preferredDescriptions = Lists
            .newArrayList(RDFS.COMMENT, SKOS.EDITORIAL_NOTE).stream()
                .map(description -> PropertyPattern.parse(QueryUtil.toSPARQL(description),
                        namespaceRegistry))
            .collect(Collectors.toList());

        final String query = ResourcePropertyCache.constructPropertyQuery(iris, preferredDescriptions);

        final String expectedQuery =
            "SELECT ?subject ?p0 ?p1 WHERE {"
            + "{{?subject <http://www.w3.org/2000/01/rdf-schema#comment> ?p0 .}"
            + "  VALUES (?subject) { (<http://my.custom.namespace/s1>)(<http://my.custom.namespace/s2>) } } "
            + "UNION"
            + "{{?subject <http://www.w3.org/2004/02/skos/core#editorialNote> ?p1.}"
            + "  VALUES (?subject) { (<http://my.custom.namespace/s1>)(<http://my.custom.namespace/s2>) } } "
            + "}";

        Assert.assertEquals(
            expectedQuery.replace(" ", ""),
            query.replaceAll("[\t\n ]", "")
        );
    }

    @Test
    public void testAssetRepositoryQuery() throws Exception {
        setPreferredDescriptionRdfsComment(); // only rdfs:comment considered as description
        setPreferredLanguageEn();

        addIri1NoLangTypeLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_NOLANG);
        addIri2NoLangTypeLiteral(RDFS.COMMENT, IRI2_DESCRIPTION_NOLANG);
        addAssetStatements(
            vf.createStatement(asIRI(IRI2), RDFS.COMMENT, vf.createLiteral(IRI2_DESCRIPTION_EN)),
            vf.createStatement(asIRI(IRI3), RDFS.COMMENT, vf.createLiteral(IRI3_DESCRIPTION_EN))
        );

        Optional<Literal> description1 = descriptionCache.getDescription(asIRI(IRI1), repositoryRule.getAssetRepository(), null);
        Optional<Literal> description2 = descriptionCache.getDescription(asIRI(IRI2), repositoryRule.getAssetRepository(), null);
        Optional<Literal> description3 = descriptionCache.getDescription(asIRI(IRI3), repositoryRule.getAssetRepository(), null);

        Assert.assertFalse(description1.isPresent());

        Assert.assertTrue(description2.isPresent());
        Assert.assertEquals(IRI2_DESCRIPTION_EN, description2.get().stringValue());

        Assert.assertTrue(description3.isPresent());
        Assert.assertEquals(IRI3_DESCRIPTION_EN, description3.get().stringValue());
    }

    @Test
    public void testOverrideByUserPreferredLanguage() throws Exception {
        setPreferredDescriptionRdfsComment();
        setPreferredLanguageEn();

        addIri1DeLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_DE);
        addIri1EnLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_EN);
        addIri1RuLiteral(RDFS.COMMENT, IRI1_DESCRIPTION_RU);

        // language priority: de > en
        Optional<Literal> description = descriptionCache.getDescription(asIRI(IRI1), repositoryRule.getRepository(), "de");

        Assert.assertTrue(description.isPresent());
        Assert.assertEquals(IRI1_DESCRIPTION_DE, description.get().stringValue());
    }

    @Test
    public void testPropertyPath() throws Exception {
        BNode intermediate1 = vf.createBNode();
        BNode intermediate2 = vf.createBNode();
        addStatement(vf.createStatement(vf.createIRI(IRI1), RDFS.COMMENT, intermediate1));
        addStatement(vf.createStatement(intermediate1, SKOS.EDITORIAL_NOTE, intermediate2));
        addStatement(vf.createStatement(intermediate2, SKOS.EDITORIAL_NOTE, vf.createLiteral(IRI1_DESCRIPTION_NOLANG)));

        String propertyPath = QueryUtil.toSPARQL(RDFS.COMMENT) + "/" + QueryUtil.toSPARQL(SKOS.EDITORIAL_NOTE) + "+";
        setUIConfigurationParameter("preferredDescriptions", propertyPath);

        Optional<Literal> description = descriptionCache.getDescription(asIRI(IRI1), repositoryRule.getRepository(), null);
        Assert.assertTrue(description.isPresent());
        Assert.assertEquals(IRI1_DESCRIPTION_NOLANG, description.get().stringValue());
    }

    @Test
    public void testPropertyPattern() throws Exception {
        BNode intermediate1 = vf.createBNode();
        BNode intermediate2 = vf.createBNode();
        addStatement(vf.createStatement(vf.createIRI(IRI1), RDFS.COMMENT, intermediate1));
        addStatement(vf.createStatement(intermediate1, SKOS.EDITORIAL_NOTE, intermediate2));
        addStatement(vf.createStatement(intermediate2, SKOS.EDITORIAL_NOTE, vf.createLiteral(IRI1_DESCRIPTION_NOLANG)));

        String propertyPattern =
                "{?subject " + QueryUtil.toSPARQL(RDFS.COMMENT) + "?some ." +
                        "?some " + QueryUtil.toSPARQL(SKOS.EDITORIAL_NOTE) + "+ ?value .}";
        setUIConfigurationParameter("preferredDescriptions", propertyPattern);

        Optional<Literal> description = descriptionCache.getDescription(asIRI(IRI1), repositoryRule.getRepository(), null);
        Assert.assertTrue(description.isPresent());
        Assert.assertEquals(IRI1_DESCRIPTION_NOLANG, description.get().stringValue());
    }

    void setPreferredDescriptionRdfsComment() {
        String preferredDescriptions = QueryUtil.toSPARQL(RDFS.COMMENT);
        setUIConfigurationParameter("preferredDescriptions", preferredDescriptions);
    }

    void setPreferredDescriptionRdfsDescriptionSkosDescriptionCustomDescription() {
        IRI mynsDescription = vf.createIRI(CUSTOM_DESCRIPTION);
        List<String> preferredDescriptions = Stream.of(RDFS.COMMENT, SKOS.EDITORIAL_NOTE, mynsDescription)
                .map(QueryUtil::toSPARQL)
            .collect(Collectors.toList());
        setUIConfigurationParameter("preferredDescriptions", preferredDescriptions);
    }

    void setPreferredLanguageEn() {
        setUIConfigurationParameter("preferredLanguages", "en");
    }

    void setPreferredLanguageDe() {
        setUIConfigurationParameter("preferredLanguages", "de");
    }

    void setPreferredLanguageRu() {
        setUIConfigurationParameter("preferredLanguages", "ru");
    }

    void setPreferredLanguageEnNoneDe() {
        setUIConfigurationParameter("preferredLanguages", Lists.newArrayList("en", "", "de"));
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

    void addIri1EnLiteral(final IRI prop, final String literalValue) throws Exception {
        addStatement(vf.createStatement(vf.createIRI(IRI1), prop, vf.createLiteral(literalValue, LANGUAGE_TAG_EN)));
    }

    void addIri1DeLiteral(final IRI prop, final String literalValue) throws Exception {
        addStatement(vf.createStatement(vf.createIRI(IRI1), prop, vf.createLiteral(literalValue, LANGUAGE_TAG_DE)));
    }

    void addIri1RuLiteral(final IRI prop, final String literalValue) throws Exception {
        addStatement(vf.createStatement(vf.createIRI(IRI1), prop, vf.createLiteral(literalValue, LANGUAGE_TAG_RU)));
    }

    void addIri1FrLiteral(final IRI prop, final String literalValue) throws Exception {
        addStatement(vf.createStatement(vf.createIRI(IRI1), prop, vf.createLiteral(literalValue, LANGUAGE_TAG_FR)));
    }

    void addIri1NoLangTypeLiteral(final IRI prop, final String literalValue) throws Exception {
        addStatement(vf.createStatement(vf.createIRI(IRI1), prop, vf.createLiteral(literalValue)));
    }

    void addIri2EnLiteral(final IRI prop, final String literalValue) throws Exception {
        addStatement(vf.createStatement(vf.createIRI(IRI2), prop, vf.createLiteral(literalValue, LANGUAGE_TAG_EN)));
    }

    void addIri2DeLiteral(final IRI prop, final String literalValue) throws Exception {
        addStatement(vf.createStatement(vf.createIRI(IRI2), prop, vf.createLiteral(literalValue, LANGUAGE_TAG_DE)));
    }

    void addIri2RuLiteral(final IRI prop, final String literalValue) throws Exception {
        addStatement(vf.createStatement(vf.createIRI(IRI2), prop, vf.createLiteral(literalValue, LANGUAGE_TAG_RU)));
    }

    void addIri2FrLiteral(final IRI prop, final String literalValue) throws Exception {
        addStatement(vf.createStatement(vf.createIRI(IRI2), prop, vf.createLiteral(literalValue, LANGUAGE_TAG_FR)));
    }

    void addIri2NoLangTypeLiteral(final IRI prop, final String literalValue) throws Exception {
        addStatement(vf.createStatement(vf.createIRI(IRI2), prop, vf.createLiteral(literalValue)));
    }

    void addIri3EnLiteral(final IRI prop, final String literalValue) throws Exception {
        addStatement(vf.createStatement(vf.createIRI(IRI3), prop, vf.createLiteral(literalValue, LANGUAGE_TAG_EN)));
    }

    void addIri3DeLiteral(final IRI prop, final String literalValue) throws Exception {
        addStatement(vf.createStatement(vf.createIRI(IRI3), prop, vf.createLiteral(literalValue, LANGUAGE_TAG_DE)));
    }

    void addIri3RuLiteral(final IRI prop, final String literalValue) throws Exception {
        addStatement(vf.createStatement(vf.createIRI(IRI3), prop, vf.createLiteral(literalValue, LANGUAGE_TAG_RU)));
    }

    void addIri3FrLiteral(final IRI prop, final String literalValue) throws Exception {
        addStatement(vf.createStatement(vf.createIRI(IRI3), prop, vf.createLiteral(literalValue, LANGUAGE_TAG_FR)));
    }

    void addIri3NoLangTypeLiteral(final IRI prop, final String literalValue) throws Exception {
        addStatement(vf.createStatement(vf.createIRI(IRI3), prop, vf.createLiteral(literalValue)));
    }

    IRI asIRI(String iri) {
        return vf.createIRI(iri);
    }

    List<IRI> asIRIList(final String... strings) {

        final List<IRI> ret = new ArrayList<IRI>(strings.length);
        for (int i=0; i<strings.length; i++) {
            ret.add(asIRI(strings[i]));
        }

        return ret;
    }

}
