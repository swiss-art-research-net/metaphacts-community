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

import com.metaphacts.rest.endpoint.ResourceUtilsEndpoint;
import net.minidev.json.JSONArray;
import org.apache.commons.collections.CollectionUtils;
import org.apache.http.HttpException;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.repository.Repository;

import javax.ws.rs.HttpMethod;
import javax.ws.rs.client.Entity;
import javax.ws.rs.core.GenericType;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status.Family;
import javax.ws.rs.core.Response.StatusType;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * This abstract class directs all IRI requests to a remote instance of the
 * platform. The remote service url is fetched from the lookup service manifest.
 *
 * <p>
 * The remote endpoint currently requires authentication but no specific
 * permissions, see {@link ResourceUtilsEndpoint} for details.
 * </p>
 *
 * @author Daniil Razdiakonov <dr@metaphacts.com>
 */
public class RemoteValueCache extends ResourcePropertyCache<IRI, Iterable<IRI>> {
    private static final ValueFactory vf = SimpleValueFactory.getInstance();
    private RemoteServiceConfiguration config;

    public RemoteValueCache(String cacheId, RemoteServiceConfiguration config) {
        super(cacheId);
        this.config = config;
    }

    public Iterable<IRI> getValuesFor(IRI iri, Repository repository) {
        Map<IRI, Optional<Iterable<IRI>>> result = this.getAll(repository, Arrays.asList(iri));
        return result.getOrDefault(iri, Optional.empty()).orElse(new ArrayList<>());
    }

    public Optional<IRI> getFirstValueFor(IRI iri, Repository repository) {
        return Optional.of(
            this.getValuesFor(iri, repository).iterator().next()
        );
    }

    @Override
    protected IRI keyToIri(IRI iri) {
        return iri;
    }

    @Override
    protected Map<IRI, Optional<Iterable<IRI>>> queryAll(
        Repository repository, Iterable<? extends IRI> iris
    ) {
        JSONArray jsonArray = new JSONArray();
        for (var iri : iris) {
            jsonArray.add(iri.stringValue());
        }
        logger.trace("Fetching {} types from {}",
            jsonArray.size(), config.getRemoteUrl());

        try {
            Entity<String> entity = Entity.entity(jsonArray.toJSONString(), MediaType.APPLICATION_JSON);
            Response response = this.config.getTarget()
                .queryParam("repository", this.config.getTargetRepository())
                .request()
                .header("Accept", MediaType.APPLICATION_JSON)
                .build(HttpMethod.POST, entity).invoke();

            final StatusType status = response.getStatusInfo();
            if (!Family.SUCCESSFUL.equals(status.getFamily())) {
                String reason = response.getStatusInfo().getReasonPhrase();
                logger.warn("Failed to fetch types for " + jsonArray.size() + "IRIs from " +
                    this.config.getRemoteUrl() + ": HTTP " + status.getStatusCode()
                    + ": " + reason);
                throw new HttpException(reason);
            }

            Map<IRI, Optional<Iterable<IRI>>> resultMap = new HashMap<>();
            Map<String, List<String>> remoteResult = response.readEntity(new GenericType<>() {});
            if (remoteResult != null) {
                logger.trace("Successfully fetched {} values", remoteResult.size());
                for (IRI iri : iris) {
                    List<String> stringIris = remoteResult.get(iri.stringValue());
                    Optional<Iterable<IRI>> values = Optional.ofNullable(
                        CollectionUtils.isNotEmpty(stringIris) ?
                            stringIris.stream().map(stringIri -> vf.createIRI(stringIri)).collect(Collectors.toList()) :
                            null
                    );
                    resultMap.put(iri, values);
                }
            }
            return resultMap;
        } catch (Exception e) {
            logger.warn("Failed to fetch values from remote service {}: {}", config.getRemoteUrl(), e.getMessage());
            logger.debug("Details:", e);
            Map<IRI, Optional<Iterable<IRI>>> emptyMap = new HashMap<>();
            iris.forEach(iri -> emptyMap.put(iri, Optional.empty()));
            return emptyMap;
        }
    }
}
