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

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Optional;
import java.util.Set;

import javax.annotation.Nullable;

import com.metaphacts.resource.DelegatingTypeService;
import com.metaphacts.resource.TypeService;
import com.metaphacts.util.Orderable;
import com.metaphacts.util.OrderableComparator;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.repository.Repository;

import com.google.inject.Inject;
import com.metaphacts.lookup.api.LookupService;
import com.metaphacts.lookup.api.LookupServiceManager;

/**
 * Delegating LabelService and DescriptionService for LookupServices providing
 * either implementation.
 *
 * <p>
 * A typical use case would be a remote lookup service fetching labels and/or
 * descriptions from a remote system.
 * </p>
 *
 * <p>
 * Each LookupService is inspected whether it provides an implementing of either
 * a LabelService and/or DescriptionService. All discovered services are cached
 * and used in a delegation chain. The services can be updated and re-discovered
 * by calling {@link #reloadServices()} or invalidating all caches using
 * {@link CacheManager#invalidateAll()}.
 * </p>
 *
 * <p>
 * When a label or description is requested to a single IRI or a set of IRIs
 * each service is asked in the order of the LookupServices returned by the
 * {@link LookupServiceManager} until all labels or descriptions have been
 * resolved. Any non-resolvable labels or descriptions are marked with an empty
 * Optional.
 * </p>
 *
 * @author Daniil Razdiakonov <dr@metaphacts.com>
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public class LookupBasedResourceInformationService implements LabelService, DescriptionService, TypeService, Orderable {
    private static final Logger logger = LogManager.getLogger(LookupBasedResourceInformationService.class);

    public static final String CACHE_ID = "platform.LookupBasedResourceInformationService";

    @Nullable
    protected LookupServiceManager lookupServiceManager;
    protected PlatformCache cache;

    protected LabelService labelService;
    protected DescriptionService descriptionService;
    protected TypeService typeService;

    public LookupBasedResourceInformationService() {
        this.cache = new PlatformCache() {
            @Override
            public void invalidate() {
                invalidateServices();
            }

            @Override
            public void invalidate(Set<IRI> iris) {
                /* Do nothing */
            }

            @Override
            public String getId() {
                return CACHE_ID;
            }

        };
    }

    @Inject
    public void setLookupServiceManager(LookupServiceManager lookupServiceManager) {
        this.lookupServiceManager = lookupServiceManager;
        this.invalidateServices();
    }

    @Inject
    public void registerCache(CacheManager cacheManager) {
        try {
            // unregister cache
            if ( cacheManager.isRegistered(CACHE_ID)) {
                // avoid duplicate registration, e.g. when re-initializing the LookupServices
                cacheManager.deregister(CACHE_ID);
            }
            invalidateServices();

            cacheManager.register(this.cache);
        } catch (IllegalStateException e) {
            // this may happen when registration is performed multiple times, e.g.
            // because of multiple dependency injections
            // ignore
            logger.debug("Cache " + CACHE_ID + " is already registered: " + e.getMessage());
        }
    }

    /**
     * Re-discover label and description services from LookupServices.
     */
    public void reloadServices() {
        invalidateServices();
        ensureServicesInitialized();
    }

    @Override
    public Optional<Literal> getLabel(
        IRI resourceIri,
        Repository repository,
        @Nullable String preferredLanguage
    ) {
        // depending on whether and how many downstream services are discovered this
        // is either a no-op implementation, directly the one-and-only service or a
        // delegating service trying each actual implementation in turn.
        LabelService delegate = this.getLabelService();
        return delegate.getLabel(resourceIri, repository, preferredLanguage);
    }

    @Override
    public Map<IRI, Optional<Literal>> getLabels(
        Iterable<? extends IRI> resourceIris,
        Repository repository,
        @Nullable String preferredLanguage
    ) {
        // depending on whether and how many downstream services are discovered this
        // is either a no-op implementation, directly the one-and-only service or a
        // delegating service trying each actual implementation in turn.
        LabelService delegate = this.getLabelService();
        return delegate.getLabels(resourceIris, repository, preferredLanguage);
    }

    @Override
    public Optional<Literal> getDescription(
        IRI resourceIri,
        Repository repository,
        @Nullable String preferredLanguage
    ) {
        // depending on whether and how many downstream services are discovered this
        // is either a no-op implementation, directly the one-and-only service or a
        // delegating service trying each actual implementation in turn.
        DescriptionService delegate = this.getDescriptionService();
        return delegate.getDescription(resourceIri, repository, preferredLanguage);
    }

    @Override
    public Map<IRI, Optional<Literal>> getDescriptions(
        Iterable<? extends IRI> resourceIris,
        Repository repository,
        @Nullable String preferredLanguage
    ) {
        // depending on whether and how many downstream services are discovered this
        // is either a no-op implementation, directly the one-and-only service or a
        // delegating service trying each actual implementation in turn.
        DescriptionService delegate = this.getDescriptionService();
        return delegate.getDescriptions(resourceIris, repository, preferredLanguage);
    }

    @Override
    public Iterable<IRI> getTypes(IRI resource, Repository repository) {
        TypeService delegate = getTypeService();
        return delegate.getTypes(resource, repository);
    }

    @Override
    public Optional<IRI> getPrimaryType(IRI resource, Repository repository) {
        TypeService delegate = getTypeService();
        return delegate.getPrimaryType(resource, repository);
    }

    @Override
    public Map<IRI, Optional<Iterable<IRI>>> getAllTypes(Iterable<? extends IRI> resourceIris, Repository repository) {
        TypeService delegate = getTypeService();
        return delegate.getAllTypes(resourceIris, repository);
    }

    protected LabelService getLabelService() {
        ensureServicesInitialized();
        return labelService;
    }

    protected DescriptionService getDescriptionService() {
        ensureServicesInitialized();
        return descriptionService;
    }

    protected TypeService getTypeService() {
        ensureServicesInitialized();
        return typeService;
    }

    protected void invalidateServices() {
        synchronized (this) {
            labelService = null;
            descriptionService = null;
            typeService = null;
        }
    }

    protected void ensureServicesInitialized() {
        synchronized (this) {
            if (this.lookupServiceManager == null) {
                labelService = NoopLabelService.INSTANCE;
                descriptionService = NoopDescriptionService.INSTANCE;
                typeService = NoopTypeService.INSTANCE;
            } else {
                if (labelService == null) {
                    try {
                        labelService = buildLabelService();
                    } catch (Exception e) {
                        // catch-all safe guard
                        logger.warn("Failed to initialize a LabelService: {}", e.getMessage());
                        logger.debug("Details", e);
                        labelService = NoopLabelService.INSTANCE;
                    }
                }

                if (descriptionService == null) {
                    try {
                        descriptionService = buildDescriptionService();
                    } catch (Exception e) {
                        // catch-all safe guard
                        logger.warn("Failed to initialize a DescriptionService: {}", e.getMessage());
                        logger.debug("Details", e);
                        descriptionService = NoopDescriptionService.INSTANCE;
                    }
                }

                if (typeService == null) {
                    try {
                        typeService = buildTypeService();
                    } catch (Exception e) {
                        // catch-all safe guard
                        logger.warn("Failed to initialize a TypeService: {}", e.getMessage());
                        logger.debug("Details", e);
                        typeService = NoopTypeService.INSTANCE;
                    }
                }
            }
        }
    }

    protected LabelService buildLabelService() {
        // find LookupServices which implement LabelService.Provider
        Map<String, LookupService> services = lookupServiceManager.getLookupServices();
        List<LabelService> labelServices = new ArrayList<>();
        for (Entry<String, LookupService> entry : services.entrySet()) {
            String id = entry.getKey();
            LookupService s = entry.getValue();
            if (s instanceof LabelService.Provider)  {
                // get LabelService (if configured and available)
                LabelService.Provider serviceProvider = (LabelService.Provider) s;
                serviceProvider.getLabelService().ifPresent(service -> {
                    logger.info("Registering LookupService {} as LabelService", id);
                    labelServices.add(service);
                });
            }
        }
        if (labelServices.isEmpty()) {
            // no services, use no-op implementation
            return NoopLabelService.INSTANCE;
        }
        else if (labelServices.size() == 1) {
            // if there is only one instance, return it directly without wrapping it into a
            // delegating service
            return labelServices.get(0);
        }
        else {
            // multiple implementations, use delegating service
            return new DelegatingLabelService(labelServices);
        }
    }

    protected DescriptionService buildDescriptionService() {
        // find LookupServices which implement DescriptionService.Provider
        Map<String, LookupService> services = lookupServiceManager.getLookupServices();
        List<DescriptionService> descriptionServices  = new ArrayList<>();
        for (Entry<String, LookupService> entry : services.entrySet()) {
            String id = entry.getKey();
            LookupService s = entry.getValue();
            if (s instanceof DescriptionService.Provider)  {
                // get DescriptionService (if configured and available)
                DescriptionService.Provider serviceProvider = (DescriptionService.Provider) s;
                serviceProvider.getDescriptionService().ifPresent(service -> {
                    logger.info("Registering LookupService {} as DescriptionService", id);
                    descriptionServices.add(service);
                });
            }
        }
        if (descriptionServices.isEmpty()) {
            // no services, use no-op implementation
            return NoopDescriptionService.INSTANCE;
        }
        else if (descriptionServices.size() == 1) {
            // if there is only one instance, return it directly without wrapping it into a
            // delegating service
            return descriptionServices.get(0);
        }
        else {
            // multiple implementations, use delegating service
            return new DelegatingDescriptionService(descriptionServices);
        }
    }

    protected TypeService buildTypeService() {
        // find LookupServices which implement DescriptionService.Provider
        Map<String, LookupService> services = lookupServiceManager.getLookupServices();
        List<TypeService> typeServices  = new ArrayList<>();
        for (Entry<String, LookupService> entry : services.entrySet()) {
            String id = entry.getKey();
            LookupService s = entry.getValue();
            if (s instanceof TypeService.Provider)  {
                // get TypeService (if configured and available)
                TypeService.Provider serviceProvider = (TypeService.Provider) s;
                serviceProvider.getTypeService().ifPresent(service -> {
                    logger.info("Registering LookupService {} as TypeService", id);
                    typeServices.add(service);
                });
            }
        }
        if (typeServices.isEmpty()) {
            // no services, use no-op implementation
            return NoopTypeService.INSTANCE;
        }
        else if (typeServices.size() == 1) {
            // if there is only one instance, return it directly without wrapping it into a
            // delegating service
            return typeServices.get(0);
        }
        else {
            // multiple implementations, use delegating service
            return new DelegatingTypeService(typeServices);
        }
    }

    @Override
    public int getOrder() {
        return OrderableComparator.MIDDLE + 10;
    }
}
