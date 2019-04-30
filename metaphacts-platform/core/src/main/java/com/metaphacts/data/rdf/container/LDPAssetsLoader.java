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

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import javax.inject.Inject;
import javax.inject.Singleton;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.model.Statement;
import org.eclipse.rdf4j.model.impl.LinkedHashModel;
import org.eclipse.rdf4j.model.util.Models;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.repository.RepositoryResult;
import org.eclipse.rdf4j.rio.RDFFormat;
import org.eclipse.rdf4j.rio.Rio;

import com.metaphacts.repository.RepositoryManager;
import com.metaphacts.config.Configuration;
import com.metaphacts.repository.MpRepositoryProvider;
import com.metaphacts.services.storage.api.ObjectKind;
import com.metaphacts.services.storage.api.ObjectRecord;
import com.metaphacts.services.storage.api.PathMapping;
import com.metaphacts.services.storage.api.PlatformStorage;
import com.metaphacts.services.storage.api.PlatformStorage.FindResult;
import com.metaphacts.services.storage.api.StorageException;
import com.metaphacts.vocabulary.LDP;

import com.google.common.collect.Maps;
import com.google.common.collect.Lists;
import com.google.common.collect.Sets;

/**
 * A singleton responsible for loading LDP assets saved in storages into the corresponding repositories at startup 
 * 
 * @author Andriy Nikolov an@metaphacts.com
 *
 */
@Singleton
public class LDPAssetsLoader {
    
    private static final Logger logger = LogManager.getLogger(LDPAssetsLoader.class);
    
    @Inject
    RepositoryManager repositoryManager;
    
    @Inject
    private PlatformStorage platformStorage;
    
    @Inject
    private Configuration configuration;
    
    @Inject
    private LDPImplManager ldpImplManager;

    public LDPAssetsLoader() {

    }
    
    private String getRepositoryIdFromObjectId(String objectId) {
        int pos = objectId.indexOf(PathMapping.SEPARATOR);
        if (pos != -1) {
            return objectId.substring(0, pos);
        } else {
            throw new IllegalArgumentException(
                    "All LDP assets must be stored under the path {repositoryId}/{objectId}. "
                            + "This object does not follow this pattern: " + objectId);
        }
    }
    
    private boolean isLoadableFromStorage(String repositoryId) {
        return configuration.getGlobalConfig().getRepositoriesLDPLoad()
                .contains(repositoryId);
    }
    
    public void load() throws StorageException, IOException {
        Map<String, FindResult> mapResults = platformStorage.findAll(ObjectKind.LDP, "");
        Map<String, Map<String, FindResult>> mapResultsByRepositoryId = Maps.newHashMap();
        logger.info("Loading LDP assets...");
        // Distribute the results by target repository
        for (Entry<String, FindResult> entry : mapResults.entrySet()) {
            String repositoryId = getRepositoryIdFromObjectId(entry.getKey());
            Map<String, FindResult> currentMap = mapResultsByRepositoryId.get(repositoryId);
            if (currentMap == null) {
                currentMap = Maps.newHashMap();
                mapResultsByRepositoryId.put(repositoryId, currentMap);
            }
            currentMap.put(entry.getKey(), entry.getValue());
        }
        
        // Load each batch separately into the corresponding repository
        for (Entry<String, Map<String, FindResult>> entry : mapResultsByRepositoryId.entrySet()) {
            if (isLoadableFromStorage(entry.getKey())) {
                loadAllToRepository(entry.getKey(), entry.getValue());
            } else {
                logger.info("Skipping loading LDP assets into the \"" + entry.getKey()
                        + "\" repository: the repository is not listed in "
                        + "\"repositoriesLDPLoad\" property in \"global.prop\"");
            }
        }
        logger.info("All LDP assets loading finished");
        
    }
    
    private void loadAllToRepository(String repositoryId, Map<String, FindResult> mapResults) throws IOException {
        logger.info("Loading " + mapResults.size() + " LDP assets into the \"" + repositoryId + "\" repository");
        Repository repository = repositoryManager.getRepository(repositoryId);
        LinkedHashModel loadedAssetsModel = new LinkedHashModel();
        for (Entry<String, FindResult> entry : mapResults.entrySet()) {
            if (!(entry.getKey().endsWith(".trig")
                    || (entry.getKey().endsWith(".nq") || (entry.getKey().endsWith(".trix"))))) {
                continue;
            }
            Optional<RDFFormat> optFormat = Rio.getParserFormatForFileName(entry.getKey());
            if (!optFormat.isPresent()) {
                logger.error("Unknown assets format: " + entry.getKey());
                continue;
            }
            RDFFormat format = optFormat.get();
            if (!format.equals(RDFFormat.NQUADS) && !format.equals(RDFFormat.TRIG)
                    && !format.equals(RDFFormat.TRIX)) {
                logger.error("Unsupported assets format " + format.toString()
                        + " for the object " + entry.getKey());
            }
            ObjectRecord record = entry.getValue().getRecord();
            try (InputStream in = record.getLocation().readContent()) {
                Model model = Rio.parse(in, "", format);
                loadedAssetsModel.addAll(model);
            }
        }
        logger.info("Read " + mapResults.size() + " assets. Loading into the repository...");
        
        try (RepositoryConnection conn = repository.getConnection()) {
            // We only load the contexts, which are not present in the assets repository
            // If present with different content, an error is thrown.
            List<Resource> toLoad = selectContentToLoad(repositoryId, loadedAssetsModel, conn);
            ldpContainersConsistencyCheck(repositoryId, loadedAssetsModel, conn);
            for (Resource ctx : toLoad) {
                logger.trace("Loading LDP asset context: " + ctx.stringValue());
                Model currentAsset = loadedAssetsModel.filter(null, null, null, ctx);
                conn.add(currentAsset);
            }
        } 
        logger.info("Loading finished.");
    }
    
    /** 
     * Check if the loaded data references includes some not available containers.
     * Those containers we would need to add to the assets repository.
     * 
     * @param repositoryId
     * @param loadedAssetsModel
     * @param conn
     */
    private void ldpContainersConsistencyCheck(String repositoryId, Model loadedAssetsModel,
            RepositoryConnection conn) throws IllegalStateException {
        // Select all containers mentioned in the loaded data
        Set<IRI> mentioned = loadedAssetsModel.filter(null, LDP.contains, null).stream()
                .map(stmt -> stmt.getSubject())
                .filter(subj -> subj instanceof IRI)
                .map(subj -> (IRI)subj)
                .collect(Collectors.toSet());
        // Select all containers already defined in the loaded data
        Set<Resource> defined = loadedAssetsModel.filter(null, RDF.TYPE, LDP.Container).stream()
                .map(stmt -> stmt.getSubject())
                .collect(Collectors.toSet());
        // get resources that mention an unknown container
        mentioned.removeAll(defined);
        // check containers that are defined in the repository
        mentioned = mentioned.stream()
                .filter(containerIri -> !conn.hasStatement(containerIri, RDF.TYPE, LDP.Container, false))
                .collect(Collectors.toSet());
        Set<IRI> types = Sets.newHashSet();
        // check standard containers defined in the platform 
        Set<IRI> knownContainers = mentioned.stream()
                .filter(containerIri -> LDPImplManager.isKnownContainer(containerIri))
                .collect(Collectors.toSet());
        mentioned.removeAll(knownContainers);
        
        if (!mentioned.isEmpty()) {
            String msg = "Loaded LDP data references unknown containers: " + mentioned.toString();
            logger.error(msg);
            throw new IllegalStateException(msg);
        }
        
        // for the standard containers mentioned in the loaded data: 
        // initialize them and add to the assets repository
        knownContainers.stream()
                .forEach(containerIri -> LDPImplManager.getLDPImplementation(containerIri, types,
                        new MpRepositoryProvider(this.repositoryManager, repositoryId)));
    }
    
    /**
     * Check whether the content of loaded assets data is consistent with the content of the assets repository,
     *  i.e., if the same named graph is contained in both the loaded data and the assets repository, their content
     *  must be equivalent. 
     * 
     * @param repositoryId
     * @param loadedAssetsModel
     * @param conn
     * @throws IllegalStateException
     */
    private List<Resource> selectContentToLoad(String repositoryId, Model loadedAssetsModel, RepositoryConnection conn) throws IllegalStateException {
        Set<Resource> contextsLoaded = loadedAssetsModel.contexts();
        LinkedHashModel modelExisting;
        Set<Resource> inconsistentContexts = Sets.newHashSet();
        List<Resource> toLoad = Lists.newArrayList();
        for (Resource ctx : contextsLoaded) {
            Model modelLoaded = loadedAssetsModel.filter(null, null, null, ctx);
            modelExisting = new LinkedHashModel();
            try (RepositoryResult<Statement> res = conn.getStatements(null, null, null, ctx)) {
                while (res.hasNext()) {
                    modelExisting.add(res.next());
                }
            }
            if (modelExisting.isEmpty()) {
                toLoad.add(ctx);
            } else if (!Models.isomorphic(modelExisting, modelLoaded)) {
                inconsistentContexts.add(ctx);
            }
        }
        
        if (!inconsistentContexts.isEmpty()) {
            String msg = "Inconsistent state of the LDP assets storage: the content of named graphs "
                    + inconsistentContexts.toString()
                    + " in the \"" + repositoryId + "\" repository does not correspond to the content loaded from storage";
            logger.error(msg);
            throw new IllegalStateException(msg);
        }
        logger.info("Selected to load: " + toLoad.size());
        return toLoad;
    }
    
}
