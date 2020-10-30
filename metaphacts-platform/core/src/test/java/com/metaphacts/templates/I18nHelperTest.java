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
package com.metaphacts.templates;

import java.io.IOException;
import java.net.URI;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

import javax.annotation.Nullable;
import javax.ws.rs.HttpMethod;
import javax.ws.rs.core.Application;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.glassfish.jersey.internal.MapPropertiesDelegate;
import org.glassfish.jersey.server.ContainerRequest;
import org.glassfish.jersey.server.ResourceConfig;
import org.glassfish.jersey.test.JerseyTest;
import org.jukito.JukitoRunner;
import org.jukito.UseModules;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

import com.google.common.base.Throwables;
import com.google.common.collect.Lists;
import com.google.inject.Inject;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.cache.LabelCache;
import com.metaphacts.cache.QueryTemplateCache;
import com.metaphacts.config.Configuration;
import com.metaphacts.junit.MetaphactsGuiceTestModule;
import com.metaphacts.junit.NamespaceRule;
import com.metaphacts.junit.PlatformStorageRule;
import com.metaphacts.junit.RepositoryRule;
import com.metaphacts.junit.TestPlatformStorage;
import com.metaphacts.repository.RepositoryManager;
import com.metaphacts.services.fields.FieldDefinitionGeneratorChain;
import com.metaphacts.services.fields.FieldsBasedSearch;
import com.metaphacts.services.storage.api.ObjectKind;
import com.metaphacts.services.storage.api.StorageException;
import com.metaphacts.services.storage.api.StoragePath;

@RunWith(JukitoRunner.class)
@UseModules(MetaphactsGuiceTestModule.class)
public class I18nHelperTest extends JerseyTest {
    private final String thisIriString = "http://www.metaphacts.com/handlebars";
    private final ValueFactory vf = SimpleValueFactory.getInstance();
    final ContainerRequest containerRequest = new ContainerRequest( URI.create(""),
            URI.create("/?testParam=test123"), HttpMethod.GET,
            null, new MapPropertiesDelegate());
    
    @Inject
    @Rule
    public RepositoryRule repositoryRule;

    @Inject
    @Rule
    public NamespaceRule namespaceRule;
    
    @Inject
    @Rule
    public PlatformStorageRule platformStorageRule;

    @Inject
    private LabelCache labelCache;
    
    @Inject
    private CacheManager cacheManager;
    
    @Inject
    private QueryTemplateCache queryTemplateCache;
    
    @Inject
    private Configuration config;

    @Inject
    private FieldDefinitionGeneratorChain fieldDefinitionGeneratorChain;

    private MetaphactsHandlebars handlebars;
    private Locale defLocale;
    private List<String> preferredLanguages;
    
    @Before
    public void setup() throws Exception {
        cacheManager.deregisterAllCaches();

        RepositoryManager repositoryManager = repositoryRule.getRepositoryManager();
        handlebars = new MetaphactsHandlebars(null, new HandlebarsHelperRegistry(
            config,
            platformStorageRule.getPlatformStorage(),
            cacheManager,
            repositoryManager,
                fieldDefinitionGeneratorChain,
            new FieldsBasedSearch(namespaceRule.getNamespaceRegistry(), repositoryManager, labelCache),
            queryTemplateCache,
            labelCache
        ));
        defLocale = Locale.getDefault();
        preferredLanguages = config.getUiConfig().getPreferredLanguages();
        
        // predefine some locale for which we do not have any bundles as default locale
        // so we actually use the default bundle as fall back
        Locale.setDefault(Locale.CHINESE);
        
        // copy files from resources to "runtime" storage to test loading resource bundles from app storage (data/i18n/mybundle.properties)
        TestPlatformStorage platformStorage = platformStorageRule.getPlatformStorage();
        List<String> files = Lists.newArrayList(
                "messages.properties",
                "messages_de.properties",
                "messages_en.properties",
                "messages_en_US.properties",
                "messages_ru.properties",
                "messages_fr_CA.properties",
                "messages_fr.properties",
                "messages_it.properties",
                "mybundle.properties"
                );
        files.forEach(file -> {
            try {
                writeToStorage(platformStorage, ObjectKind.I18N, file, file);
            } catch (Exception e) {
                Throwables.throwIfUnchecked(e);
                throw new RuntimeException(e);
            }
        });
    }
    
    @After
    public void tearDown() throws Exception {
        repositoryRule.delete();
        // reset locale
        Locale.setDefault(defLocale);
        // reset preferred languages
        config.getUiConfig().setParameter("preferredLanguages", preferredLanguages, TestPlatformStorage.STORAGE_ID);
    }

    @Override
    protected Application configure() {
        return new ResourceConfig();
    }
    
    @Test
    public void locale_en() throws Exception {
        // English locale
        Assert.assertEquals("Hello world (en).",
            handlebars.compileInline("[[i18n \"greetings\" \"world\"]]")
                .apply(context(vf.createIRI(thisIriString), "en")));
    }
    
    @Test
    public void locale_DE() throws Exception {
        // German locale
        Assert.assertEquals("Hallo world (de).",
                handlebars.compileInline("[[i18n \"greetings\" \"world\"]]")
                    .apply(context(vf.createIRI(thisIriString), "de")));
    }
    
    @Test
    public void locale_de_DE() throws Exception {
        // German (Germany) locale, no specific bundle, should use general de bundle
        Assert.assertEquals("Hallo world (de).",
                handlebars.compileInline("[[i18n \"greetings\" \"world\"]]")
                    .apply(context(vf.createIRI(thisIriString), "de_DE")));
    }
    
    @Test
    public void locale_fr() throws Exception {
        // French (France) locale
        Assert.assertEquals("Bonjour world (fr_FR).",
                handlebars.compileInline("[[i18n \"greetings\" \"world\"]]")
                    .apply(context(vf.createIRI(thisIriString), "fr_FR")));
    }
    
    @Test
    public void locale_fr_CA() throws Exception {
        // French (Canadian) locale
        Assert.assertEquals("Bonjour world (fr_CA).",
                handlebars.compileInline("[[i18n \"greetings\" \"world\"]]")
                    .apply(context(vf.createIRI(thisIriString), "fr_CA")));
    }
    
    @Test
    public void locale_RU() throws Exception {
        // Russian locale (UTF-8!)
        Assert.assertEquals("Здравствуйте world (ru_RU).",
                handlebars.compileInline("[[i18n \"greetings\" \"world\"]]")
                    .apply(context(vf.createIRI(thisIriString), "ru_RU")));
    }
    
    @Test
    public void defaultBundle() throws Exception {
        // use default locale (en)
        Assert.assertEquals("Hello world (en).",
                handlebars.compileInline("[[i18n \"greetings\" \"world\"]]")
                    .apply(context(vf.createIRI(thisIriString))));
    }
    
    @Test
    public void differentLocale() throws Exception {
        // use different default locale (it)
        config.getUiConfig().setParameter("preferredLanguages", Collections.singletonList("it"), TestPlatformStorage.STORAGE_ID);
        Assert.assertEquals("Ciao world (it).",
                handlebars.compileInline("[[i18n \"greetings\" \"world\"]]")
                    .apply(context(vf.createIRI(thisIriString))));
    }
    
    @Test
    public void withAutoHTMLEscaping() throws Exception {
        // English locale
        Assert.assertEquals("Hello &lt;font color='red'&gt;metaphacts&lt;/font&gt; (en).",
                handlebars.compileInline("[[i18n \"greetings\" \"<font color='red'>metaphacts</font>\"]]")
                    .apply(context(vf.createIRI(thisIriString))));
    }
    
    @Test
    public void withExplicitHTMLEscaping() throws Exception {
        // English locale
        Assert.assertEquals("Hello &lt;font color='red'&gt;metaphacts&lt;/font&gt; (en).",
                handlebars.compileInline("[[i18n \"greetings\" \"<font color='red'>metaphacts</font>\" escapeHTML=true]]")
                    .apply(context(vf.createIRI(thisIriString))));
    }
    
    @Test
    public void withoutHTMLEscaping() throws Exception {
        // English locale
        Assert.assertEquals("Hello <font color='red'>metaphacts</font> (en).",
                handlebars.compileInline("[[i18n \"greetings\" \"<font color='red'>metaphacts</font>\" escapeHTML=false]]")
                    .apply(context(vf.createIRI(thisIriString))));
    }
    
    @Test
    public void differentBundle() throws Exception {
        // different bundle
        Assert.assertEquals("My Key (other bundle) world",
                handlebars.compileInline("[[i18n \"mykey\" \"world\" bundle=\"mybundle\"]]")
                    .apply(context(vf.createIRI(thisIriString), "pl")));
    }
    
    @Test
    public void differentBundleViaClassLoader() throws Exception {
        // different bundle (loaded via ClassLoader)
        Assert.assertEquals("My Key (other bundle via classloader) world",
                handlebars.compileInline("[[i18n \"mykey\" \"world\" bundle=\"classloadedbundle\"]]")
                .apply(context(vf.createIRI(thisIriString), "pl")));
    }
    
    @Test
    public void missingBundle() throws Exception {
        // missing bundle
        Assert.assertEquals("mykey (bundle not found)",
                handlebars.compileInline("[[i18n \"mykey\" \"world\" bundle=\"bundle-does-not-exist\"]]")
                    .apply(context(vf.createIRI(thisIriString), "pl")));
    }

    protected void writeToStorage(TestPlatformStorage platformStorage, StoragePath parent, String resourceName, String fileName)
            throws StorageException, IOException {
        StoragePath path = StoragePath.parse(fileName);
        if (parent != null) {
            path = parent.resolve(path);
        }
        platformStorageRule.storeContentFromResource(path, getClass(), resourceName);
    }
    
    private TemplateContext context(IRI iri) {
        return context(iri, null);
    }

    private TemplateContext context(IRI iri, @Nullable String preferredLanguage) {
        TemplateContext context = new TemplateContext(
            iri,
            this.repositoryRule.getRepository(),
            containerRequest.getUriInfo(),
            preferredLanguage
        );
        context.setNamespaceRegistry(namespaceRule.getNamespaceRegistry());
        Assert.assertTrue(context.getNamespaceRegistry().isPresent());
        return context;
    }
}
