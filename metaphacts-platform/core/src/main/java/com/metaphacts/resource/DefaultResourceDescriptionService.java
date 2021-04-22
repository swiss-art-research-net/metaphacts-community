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
package com.metaphacts.resource;

import static org.eclipse.rdf4j.model.util.Values.literal;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.apache.commons.lang3.StringUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.query.TupleQuery;
import org.eclipse.rdf4j.query.TupleQueryResult;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.RepositoryConnection;

import com.google.inject.Inject;
import com.metaphacts.api.sparql.SparqlOperationBuilder;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.cache.LabelService;
import com.metaphacts.cache.LiteralCacheKey;
import com.metaphacts.cache.ResourceDescriptionCacheHolder;
import com.metaphacts.cache.ResourcePropertyCache;
import com.metaphacts.config.Configuration;
import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.config.PropertyPattern;
import com.metaphacts.services.fields.FieldDefinition;
import com.metaphacts.services.fields.FieldDefinitionGeneratorChain;
import com.metaphacts.services.storage.api.PlatformStorage;
import com.metaphacts.vocabulary.DASH;

/**
 * Default implementation of the ResourceDescriptionService.
 * 
 * <p>
 * The services fetches a type description from a SHACL {@code NodeShape} and
 * uses this to derive description properties for a type.
 * </p>
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public class DefaultResourceDescriptionService extends AbstractCachingDescriptionService {
    private static final Logger logger = LogManager.getLogger(DefaultResourceDescriptionService.class);

    protected static final String TYPEDESCRIPTION_CACHE_ID = "repository.typeDescriptionCaches";
    protected static final String INSTANCEDESCRIPTION_CACHE_ID = "repository.instanceDescriptionCaches";
    protected static final String INSTANCETYPES_CACHE_ID = "repository.instanceTypesCaches";

    protected final NamespaceRegistry namespaceRegistry;
    protected final LabelService labelService;
    protected final DescriptionRenderer descriptionRenderer;

    protected final FieldDefinitionGeneratorChain fieldDefinitionGeneratorChain;


    @Inject
    public DefaultResourceDescriptionService(Configuration config, CacheManager cacheManager,
            PlatformStorage platformStorage, NamespaceRegistry namespaceRegistry,
            FieldDefinitionGeneratorChain fieldDefinitionGeneratorChain,
            DescriptionRenderer descriptionRenderer,
            ResourceDescriptionCacheHolder labelService, ModelService modelService) {
        super(config, cacheManager, modelService);
        this.namespaceRegistry = namespaceRegistry;
        this.fieldDefinitionGeneratorChain = fieldDefinitionGeneratorChain;
        // note: as upstream LabelCache we only want the one fetching data from
        // preferredLabels config property, not the generic, delegating one, as that
        // would lead to initialization loops!
        this.labelService = labelService;
        this.descriptionRenderer = descriptionRenderer;
    }

    @Override
    protected Optional<ResourceDescription> lookupResourceDescription(Repository repository, LiteralCacheKey cacheKey) {
        IRI instanceIRI = cacheKey.getIri();
        return modelService.getTypeDescriptionForInstance(repository, instanceIRI).flatMap(
                typeDescription -> createResourceDescription(repository, typeDescription, instanceIRI, cacheKey));
    }

    protected Optional<ResourceDescription> createResourceDescription(Repository repository,
            TypeDescription typeDescription, IRI resource, LiteralCacheKey cacheKey) {
        // return early if we do not have a template to create the description string
        if (!descriptionRenderer.canRenderDescription(typeDescription.getTypeIRI())) {
            return Optional.empty();
        }

        logger.trace("Creating resource description for {} (type {})", resource, typeDescription.getTypeIRI());

        // we express the first specified language in the description but use all
        // preferred languages for resolving the actual label/literals
        Literal languageTag = literal(cacheKey.getLanguageTag());
        String preferredLanguage = StringUtils.join(cacheKey.getPreferredLanguages(), ",");

        // @formatter:off
        return Optional.of(new DefaultResourceDescription(resource)
                            .withTypeDescription(typeDescription)
                            .withLanguageTag(languageTag.stringValue()))
                // fetch label
                .map(instanceDescription -> instanceDescription
                        .withLabel(LabelService.resolveLabelWithFallback(labelService.getLabel(resource, repository, preferredLanguage), resource)))
                // fetch description properties
                .map(instanceDescription -> instanceDescription
                        .withDescriptionProperties(getDescriptionProperties(repository, 
                                instanceDescription.getTypeDescription(), instanceDescription.getResource(), languageTag)))
                // create composite description
                .map(instanceDescription -> instanceDescription
                        .withDescription(createCompositeDescription(repository, instanceDescription, preferredLanguage).orElse(null)))
                ;
        // @formatter:on
    }

    protected Optional<String> createCompositeDescription(Repository repository,
            ResourceDescription instanceDescription, String preferredLanguage) {
        return descriptionRenderer.renderTemplate(instanceDescription, repository, preferredLanguage);
    }

    protected List<PropertyValue> getDescriptionProperties(Repository repository, TypeDescription typeDescription,
            Resource resource, Literal languageTag) {
        if (!(resource instanceof IRI)) {
            return Collections.emptyList();
        }
        IRI instanceIRI = (IRI) resource;
        List<PropertyValue> propertyValues = new ArrayList<>();
        // fetch data for all description properties
        List<PropertyDescription> descriptionProperties = typeDescription.getPropertiesForRole(DASH.DescriptionRole)
                .orElse(Collections.emptyList());
        for (PropertyDescription property : descriptionProperties) {
            logger.trace("Get or create a FieldDefinition for the property {}", property);
            // get or create a FieldDefinition for the property
            Optional<List<Value>> values = getFieldDefinition(property.getPropertyIRI())
                    .flatMap(fieldDefinition -> fetchValues(instanceIRI, repository, fieldDefinition, languageTag));
            // TODO support for default values as specified by
            // FieldDefinition.defaultValues:
            // would an empty list be enough to use the default values?
            propertyValues.add(new DefaultPropertyValue(instanceIRI, property, values.orElse(Collections.emptyList())));
        }

        return propertyValues;
    }

    /**
     * Get a FieldDefinition for the specified property.
     * 
     * <p>
     * This implementation delegates to the {@link FieldDefinitionGeneratorChain}.
     * </p>
     * 
     * @param property property for which to get a FieldDefinition
     * @return FieldDefinition or empty if not available
     */
    protected Optional<FieldDefinition> getFieldDefinition(IRI property) {
        return fieldDefinitionGeneratorChain.handle(property);
    }

    /**
     * Fetch data based from the provided field definition.
     * 
     * @param iri             subject iri of the entity to fetch values from. This
     *                        is injected into the query using a variable
     *                        {@code subject}.
     * @param repository      repository from which to fetch data
     * @param fieldDefinition FieldDefinition which defines a select pattern to
     *                        fetch the data. If <code>null</code> no query is
     *                        executed and an empty result returned
     * @param languageTag     (single) language tag to use for filtering when
     *                        fetching data. This is injected into the query using a
     *                        variable {@code languageTag}.
     * @return list of values or empty if there were no result or no query specified
     */
    protected Optional<List<Value>> fetchValues(IRI iri, Repository repository, FieldDefinition fieldDefinition,
            Literal languageTag) {
        String selectPattern = Optional.ofNullable(fieldDefinition).map(field -> field.getSelectPattern()).orElse(null);
        return fetchValues(iri, repository, selectPattern, languageTag);
    }

    /**
     * Fetch data based from the provided selectPattern
     * 
     * @param iri           subject iri of the entity to fetch values from. This is
     *                      injected into the query using a variable
     *                      {@code subject}.
     * @param repository    repository from which to fetch data
     * @param selectPattern query to fetch the data. If <code>null</code> no query
     *                      is executed and an empty result returned. The query is
     *                      expected to have a {@code ?value} project variable.
     * @param languageTag   (single) language tag to use for filtering when fetching
     *                      data. This is injected into the query using a variable
     *                      {@code languageTag}.
     * @return list of values or empty if there were no result or no query specified
     */
    protected Optional<List<Value>> fetchValues(IRI iri, Repository repository, String selectPattern,
            Literal languageTag) {
        return Optional.ofNullable(selectPattern).map(query -> {
            logger.trace("Fetching description property values for resource {}", iri);

            try (RepositoryConnection connection = repository.getConnection()) {
                SparqlOperationBuilder<TupleQuery> builder = SparqlOperationBuilder
                        .<TupleQuery>create(query, TupleQuery.class).setBinding("subject", iri)
                        .setBinding("languageTag", languageTag);
                try (TupleQueryResult result = builder.build(connection).evaluate()) {
                    List<Value> values = result.stream()
                            .filter(bindingSet -> {
                                if (bindingSet.hasBinding("value")) {
                                    return true;
                                }
                                logger.trace("BindingSet for pattern {} does not contain a ?value projection", selectPattern);
                                return false;
                            })
                            .map(bindingSet -> {
                                Value value = bindingSet.getValue("value");
                                logger.trace("Found description property value {}", value.stringValue());
                                return value;
                            })
                            .filter(value -> value != null)
                            .collect(Collectors.toList());
                    return values;
                }
                catch (Exception e) {
                    logger.warn("Failed to fetch description properties for resource {}: {}", iri, e.getMessage());
                    logger.debug("Details: ", e);
                    return null;
                }
            }
        });
    }

    @Override
    protected boolean canProvideDescription(IRI resourceIri, Repository repository) {
        // check whether we have a description template for this resource's primary type
        return modelService.getPrimaryInstanceType(repository, resourceIri)
                .map(typeIRI -> descriptionRenderer.canRenderDescription(typeIRI)).orElse(false);
    }

    /**
     * Helper class to get access to protected helper methods of class
     * ResourcePropertyCache
     */
    static abstract class Helper<Key, Property> extends ResourcePropertyCache<Key, Property> {
        public Helper(String cacheId) {
            super(cacheId);
        }

        public static String constructPropertyQuery(Iterable<? extends IRI> iris, List<PropertyPattern> properties) {
            return ResourcePropertyCache.constructPropertyQuery(iris, properties);
        }

        public static <Property> List<Property> flattenProperties(List<List<Property>> properties) {
            return ResourcePropertyCache.flattenProperties(properties);
        }

        public static <Property> Map<IRI, List<List<Property>>> queryAndExtractProperties(Repository repository,
                String queryString, int propertyCount, Function<Value, Optional<Property>> extractProperty) {
            return ResourcePropertyCache.queryAndExtractProperties(repository, queryString, propertyCount,
                    extractProperty);
        }
    }
}
