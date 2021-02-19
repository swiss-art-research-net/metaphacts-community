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
package com.metaphacts.querycatalog;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

import org.apache.commons.configuration2.ex.ConfigurationException;
import org.apache.commons.io.FilenameUtils;
import org.junit.Rule;
import org.junit.rules.TemporaryFolder;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.metaphacts.api.rest.client.QueryCatalogAPIClient;
import com.metaphacts.api.rest.client.QueryCatalogAPIClientImpl;
import com.metaphacts.api.rest.client.QueryTemplateCatalogAPIClientImpl;
import com.metaphacts.data.rdf.container.LDPApiInternal;
import com.metaphacts.data.rdf.container.LocalLDPAPIClient;
import com.metaphacts.data.rdf.container.QueryTemplateContainer;
import com.metaphacts.junit.NamespaceRule;
import com.metaphacts.junit.TestPlatformStorage;
import com.metaphacts.repository.MpRepositoryProvider;
import com.metaphacts.repository.RepositoryManager;

@Singleton
public class QueryCatalogRESTServiceRegistryRule extends TemporaryFolder {
    @Inject
    public TestPlatformStorage platformStorage;

    @Inject
    public QueryCatalogRESTServiceRegistry registry;
    
    @Inject
    public RepositoryManager repositoryManager;

    @Inject
    @Rule
    public NamespaceRule namespaceRule;

    public QueryCatalogRESTServiceRegistry getRegistry() {
        return registry;
    }
    
    public void registerServiceFromPropertiesFile(File propFile) throws ConfigurationException {
        String serviceId = FilenameUtils.getBaseName(propFile.getName());
        try (FileInputStream content = new FileInputStream(propFile)) {
            long contentLength = content.getChannel().size();
            platformStorage.getMainStorage().appendObject(
                QueryCatalogRESTServiceRegistry.objectIdFromServiceId(serviceId),
                platformStorage.getDefaultMetadata(),
                content,
                contentLength
            );
            registry.syncServices();
        } catch (IOException e) {
            throw new ConfigurationException(e);
        }
    }

    public void setServiceParameter(
        String serviceId, QaasField field, String value
    ) throws ConfigurationException {
        Map<QaasField, String> parameters = new HashMap<>();
        parameters.put(field, value);
        registry.addOrUpdateService(serviceId, parameters, TestPlatformStorage.STORAGE_ID);
    }
    
    public void setLDPRepository(String repositoryId) {
        LDPApiInternal assetsApi = new LDPApiInternal(new MpRepositoryProvider(repositoryManager, repositoryId), namespaceRule.getNamespaceRegistry());
        LocalLDPAPIClient ldpAPIClient = new LocalLDPAPIClient(
                assetsApi, QueryTemplateContainer.IRI);
        
        QueryCatalogAPIClient queryCatalogApi = new QueryCatalogAPIClientImpl(ldpAPIClient);
                
        registry.queryTemplateCatalogApiClient = new QueryTemplateCatalogAPIClientImpl(
                                                    ldpAPIClient, 
                                                    queryCatalogApi);
    }
    
    public void deleteAll() throws ConfigurationException {
        for (String serviceId : registry.listServiceIds()) {
            registry.deleteService(serviceId, TestPlatformStorage.STORAGE_ID);
        }
    }
}
