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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import javax.inject.Inject;
import javax.lang.model.SourceVersion;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.query.BindingSet;
import org.eclipse.rdf4j.query.TupleQuery;
import org.eclipse.rdf4j.query.TupleQueryResult;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.RepositoryConnection;

import com.metaphacts.api.sparql.SparqlOperationBuilder;
import com.metaphacts.lookup.spi.TargetRepositoryAware;
import com.metaphacts.repository.RepositoryManagerInterface;
import com.metaphacts.util.Orderable;
import com.metaphacts.util.OrderableComparator;
import com.metaphacts.vocabulary.DASH;
import com.metaphacts.vocabulary.PLATFORM;

/**
 * DescriptionPropertiesProvider fetching the type description using SPARQL from
 * the ontology and SHACL.
 * 
 * <p>
 * The properties are identified by a shacl:NodeShape relating to the desired
 * type. From this node shape all referenced properties marked as description
 * properties are used. This is expected to be done using a statement with the
 * predicate {@value PLATFORM#HAS_DESCRIPTION_PROPERTY} and the name of a
 * projection variable as object value. </p
 * 
 * <p>
 * The description properties are fetched using this SPARQL query (the type's
 * IRI will be injected as {@code ?targetClass}):
 * 
 * <pre>
 * PREFIX rdf: &lt;http://www.w3.org/1999/02/22-rdf-syntax-ns#&gt;
 * PREFIX rdfs: &lt;http://www.w3.org/2000/01/rdf-schema#&gt;
 * PREFIX sh: &lt;http://www.w3.org/ns/shacl#&gt;
 * PREFIX ex: &lt;http://example.org/&gt;
 * PREFIX Platform: &lt;http://www.metaphacts.com/ontologies/platform#&gt;
 * 
 * SELECT ?property ?projectionVariableName ?propertyRole WHERE {
 *     {
 *       ?nodeShape sh:targetClass ?targetClass .
 *       ?nodeShape sh:property ?propShape .
 *     } UNION {
 *       ?targetClass sh:property ?propShape .
 *     }
 *     ?propShape sh:path ?property .
 *     OPTIONAL { ?propShape Platform:projectionVariableName ?projectionVariableName . }  
 *     OPTIONAL { ?propShape dash:propertyRole ?propertyRole . }
 * }
 * </pre>
 * </p>
 * 
 * <p>
 * Example snippet of the corresponding ontology:
 * 
 * <pre>
 * ex:PersonShape
 *     a sh:NodeShape ;
 *     sh:targetClass ex:Person ;
 *     sh:property [
 *         sh:path ex:hasProject ;
 *     ], [
 *         sh:path ex:dateOfBirth ;
 *         Platform:projectionVariableName "dateOfBirth" ;
 *         dash:propertyRole dash:DescriptionRole ;
 *     ], [
 *         sh:path ex:dateOfDeath ;
 *         Platform:projectionVariableName "dateOfDeath" ;
 *         sh:datatype xsd:date ;
 *         dash:propertyRole dash:DescriptionRole ;
 *     ], [
 *         sh:path ex:occupation ;
 *         Platform:projectionVariableName "occupation" ;
 *         dash:propertyRole dash:DescriptionRole ;
 *     ] .
 * </pre>
 * </p>
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public class SHACLNodeShapePropertiesProvider implements TypePropertyProvider, Orderable, TargetRepositoryAware {
    private static final Logger logger = LogManager.getLogger(SHACLNodeShapePropertiesProvider.class);

    public static final String TARGET_CLASS = "targetClass";

    // we need to use the interface here in case this is resolved from an app which
    // does not "see" the class RepositoryManager
    protected RepositoryManagerInterface repositoryManager;

    protected String repositoryId = "default";

    // query to catch all properties
    private final String propertyQuery;

    public SHACLNodeShapePropertiesProvider() {
        this.propertyQuery = getPropertyQuery();
        logger.trace("Property query: {}", propertyQuery);
    }

    @Inject
    public void setRepositoryManager(RepositoryManagerInterface repositoryManager) {
        this.repositoryManager = repositoryManager;
    }

    public RepositoryManagerInterface getRepositoryManager() {
        return repositoryManager;
    }

    protected Optional<Repository> getRepository() {
        return Optional.ofNullable(repositoryManager)
                .map(repoManager -> repoManager.getRepository(getTargetRepository()));
    }

    @Override
    public void setTargetRepository(String repositoryId) {
        this.repositoryId = repositoryId;
    }

    @Override
    public String getTargetRepository() {
        return repositoryId;
    }

    @Override
    public Optional<List<PropertyDescription>> getProperties(Repository repository, IRI typeIRI) {
        Optional<Repository> repo = getRepository();
        if (repo.isEmpty()) {
            return Optional.empty();
        }
        // query to execute. The provided typeIRI will be injected as ?targetClass

        logger.trace("Fetching properties for type {}", typeIRI);

        try (RepositoryConnection con = repo.get().getConnection()) {
            SparqlOperationBuilder<TupleQuery> builder = SparqlOperationBuilder
                    .<TupleQuery>create(propertyQuery, TupleQuery.class)
                    .setBinding(TARGET_CLASS, typeIRI);
            try (TupleQueryResult result = builder.build(con).evaluate()) {
                Map<IRI, DefaultPropertyDescription> props = new HashMap<>();
                Set<String> projectionVariableNames = new HashSet<>();
                for (BindingSet bindingSet : result) {
                    Value property = bindingSet.getValue("property");
                    Value projectionVariableName = bindingSet.getValue("projectionVariableName");
                    Value propertyRole = bindingSet.getValue("propertyRole");
                    if (property instanceof IRI) {
                        IRI propertyIRI = (IRI) property;
                        String propertyProjectionName = (projectionVariableName instanceof Literal
                                ? projectionVariableName.stringValue()
                                : propertyIRI.getLocalName());
                        // ensure that there are no duplicates for projection variables
                        if ((propertyProjectionName != null)
                                && projectionVariableNames.contains(propertyProjectionName)) {
                            logger.debug("Property {} for type {}: ignoring duplicate projection variable name {}",
                                    propertyIRI.stringValue(), typeIRI, propertyProjectionName);
                            propertyProjectionName = null;
                        }
                        // ensure that the projection variable name is a proper identifier
                        // (this is based on Java rules, but this should also suffice for SPARQL)
                        if ((propertyProjectionName != null) && !SourceVersion.isIdentifier(propertyProjectionName)) {
                            logger.debug("Property {} for type {}: ignoring invalid projection variable name {}",
                                    propertyIRI.stringValue(), typeIRI, propertyProjectionName);
                            propertyProjectionName = null;
                        }
                        if (propertyProjectionName != null) {
                            projectionVariableNames.add(propertyProjectionName);
                        }
                        DefaultPropertyDescription propertyDescription = props.get(propertyIRI);
                        if (propertyDescription == null) {
                            propertyDescription = new DefaultPropertyDescription(propertyIRI, propertyProjectionName);
                            props.put(propertyIRI, propertyDescription);
                        }
                        // store property role
                        if (propertyRole instanceof IRI) {
                            propertyDescription.addPropertyRole((IRI) propertyRole);
                        }
                        logger.trace("Found property {} ({}) for type {} with role {}", propertyIRI.stringValue(),
                                propertyProjectionName, typeIRI, propertyRole);
                    }
                }

                List<PropertyDescription> propsList = new ArrayList<>(props.values());
                // only return a non-empty result if we actually have some properties
                return Optional.of(propsList).filter(list -> !list.isEmpty());
            }
        }
        catch (Exception e) {
            logger.warn("Failed to fetch description properties for type {}: {}", typeIRI, e.getMessage());
            logger.debug("Details: ", e);
        }

        return Optional.empty();
    }

    /**
     * Get the SPARQL query to use for fetching information from the model.
     * 
     * <p>
     * The query will get the target class injected using variable
     * {@value #TARGET_CLASS}.
     * </p>
     * <p>
     * The query should return the following projection:
     * <ul>
     * <li><code>?property</code>: IRI of the property</li>
     * <li><code>?projectionVariableName</code>: (optional) name of a projection
     * variable for the property (e.g. to be used in description templates)</li>
     * <li><code>?propertyRole</code>: IRI of a property role (e.g. as defined in
     * Datashapes)</li>
     * </ul>
     * </p>
     * 
     * @return SPARQL query
     */
    protected String getPropertyQuery() {
        final String query = "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n"
                + "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n"
                + "PREFIX sh: <http://www.w3.org/ns/shacl#>\n"
                + "PREFIX ex: <http://example.org/>\n"
                + "PREFIX Platform: <http://www.metaphacts.com/ontologies/platform#>\n"
                + "\n"
                + "SELECT ?property ?projectionVariableName ?propertyRole WHERE {\n"
                + "    {\n"
                + "       ?nodeShape sh:targetClass/^rdfs:subClassOf* ?targetClass .\n"
                + "       ?nodeShape sh:property ?propShape .\n"
                + "    } UNION {\n"
                + "       ?targetClass ^rdfs:subClassOf*/sh:property ?propShape .\n"
                + "    }\n"
                + "    ?propShape sh:path ?property .\n"
                + "    OPTIONAL { ?propShape <" + PLATFORM.PROJECTION_VARIABLE_NAME.stringValue()
                + "> ?projectionVariableName . } \n"
                + "    OPTIONAL { ?propShape <" + DASH.propertyRole.stringValue() + "> ?propertyRole . }  \n"
                + "}";
        return query;
    }

    @Override
    public int getOrder() {
        return OrderableComparator.MIDDLE;
    }
}
