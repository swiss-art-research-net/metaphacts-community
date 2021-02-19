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
package com.metaphacts.services.fields.property;

import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import javax.inject.Inject;
import javax.inject.Provider;

import org.apache.commons.lang3.StringUtils;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.Statement;
import org.eclipse.rdf4j.model.datatypes.XMLDatatypeUtil;
import org.eclipse.rdf4j.model.vocabulary.OWL;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.model.vocabulary.RDFS;
import org.eclipse.rdf4j.model.vocabulary.XSD;
import org.eclipse.rdf4j.query.BooleanQuery;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.repository.RepositoryResolver;

import com.metaphacts.repository.RepositoryManager;
import com.metaphacts.services.fields.AbstractFieldDefinitionGenerator;
import com.metaphacts.services.fields.FieldDefinition;
import com.metaphacts.util.Orderable;
import com.metaphacts.util.OrderableComparator;

/**
 *
 * Creates a field definition for an IRI if the IRI denotes a property known in the default repository.
 *
 * The generator produces a field definition for any property IRI that is either:
 * <ol>
 * <li>defined to be of type {@code rdf:Property}, {@code owl:DatatypeProperty}, or {@code owl:ObjectProperty}</li>
 * <li>used as a predicate in any statement.
 * </ol>
 *
 * The resulting {@link FieldDefinition} will include the following attributes:
 * <ul>
 * <li>an IRI to identify the field definition</li>
 * <li>an {@code insertPattern}</li>
 * <li>a set of domains, if found</li>
 * <li>a set of ranges, if found</li>
 * <li>a XSD datatype, if found</li>
 * </ul>
 *
 * @author Jeen Broekstra <jb@metaphacts.com>
 *
 */
public class PropertyBasedGenerator extends AbstractFieldDefinitionGenerator implements Orderable {

// TODO not yet working
//    @Inject
//    private Configuration config;
//
//    @Inject
//    private NamespaceRegistry ns;

    Provider<RepositoryResolver> repositoryResolver;

    private final String askQuery = "ASK WHERE { { [] ?iri [] } "
            + " UNION { ?iri a <" + RDF.PROPERTY + "> . } "
            + " UNION { ?iri a <" + OWL.DATATYPEPROPERTY + "> . } "
            + " UNION { ?iri a <" + OWL.OBJECTPROPERTY + "> . } "
            + "}";

    @Inject
    public void setRepositoryResolver(Provider<RepositoryResolver> repositoryResolver) {
        this.repositoryResolver = repositoryResolver;
    }

    @Override
    public Optional<FieldDefinition> generate(IRI iri) {

        if (iri == null) {
            throw new IllegalArgumentException("IRI must not be null");
        }

        Repository rep = repositoryResolver.get().getRepository(RepositoryManager.DEFAULT_REPOSITORY_ID);

        FieldDefinition fieldDefinition = null;
        try (RepositoryConnection conn = rep.getConnection()) {
            if (isKnownProperty(conn, iri)) {
                fieldDefinition = new FieldDefinition();

                // For practical reasons we use the original property identifier
                // as the identifier of the field definition itself, as well. See ID-1674.
                fieldDefinition.setIri(iri);
                fieldDefinition.setSelectPattern("SELECT ?value WHERE { $subject <" + iri.stringValue() + "> ?value. }");
                fieldDefinition.setInsertPattern("INSERT { $subject <" + iri.stringValue() + "> $value . } WHERE {}");
                fieldDefinition.setDeletePattern("DELETE { $subject <" + iri.stringValue() + "> $value . } WHERE {}");

                Optional<Literal> description = conn.getStatements(iri, RDFS.COMMENT, null).stream()
                        .filter(st -> st.getObject() instanceof Literal).map(st -> (Literal) st.getObject())
                        .findFirst();

                if (description.isPresent()) {
                    fieldDefinition.setDescription(description.get());
                }

                Set<IRI> domains = conn.getStatements(iri, RDFS.DOMAIN, null).stream()
                        .map(Statement::getObject).filter(v -> v instanceof IRI).map(v -> (IRI) v)
                        .collect(Collectors.toSet());

                if (!domains.isEmpty()) {
                    fieldDefinition.setDomain(domains);
                }

                Set<IRI> ranges = conn.getStatements(iri, RDFS.RANGE, null).stream()
                        .map(Statement::getObject).filter(v -> v instanceof IRI).map(v -> (IRI) v)
                        .collect(Collectors.toSet());

                if (!ranges.isEmpty()) {
                    fieldDefinition.setRange(ranges);
                }
                IRI dataType = determineDatatype(conn, iri, ranges);
                fieldDefinition.setXsdDatatype(dataType);

                if (dataType.equals(XSD.ANYURI)) {
                   StringBuilder queryString = new StringBuilder();
                   queryString.append("SELECT ?value ?label WHERE {");
                   queryString.append("?value rdfs:label|skos:prefLabel ?label. ");
                   queryString.append("?value a ?type. "); // restrict it to things of some type
                   if (!ranges.isEmpty()) {
                       String types =StringUtils.join(ranges.stream().map(r -> "<"+r.stringValue()+">").collect(Collectors.toList()), ",");
                       queryString.append("FILTER(?type in ("+types+") ) ");
                   }
                   queryString.append("FILTER REGEX(?label, \"?token\",\"i\")} LIMIT 10");
                   /* TODO injections not yet working here, but otherwise label patterns might be used to generate the lookup
                   queryString.append("SELECT ?value WHERE {");
                   List<String> preferredLabels = config.getUiConfig().getPreferredLabels();

                   // convert to IRI list (filtering out invalid IRIs)
                   List<PropertyPattern> labelPatterns = preferredLabels.stream()
                       .map(pattern -> PropertyPattern.parse(pattern, ns))
                       .collect(Collectors.toList());
                   int predicateIdx = 0;
                   for (PropertyPattern preferredProperty : labelPatterns) {
                       if (predicateIdx > 0) {
                           queryString.append("UNION");
                       }

                       // ?subject [PREDICATE] ?p[PREDICATE_IDX]
                       queryString.append("{")
                           .append(preferredProperty.format("value", "?label"))
                           .append("FILTER REGEX(?label, \"?token\",\"i\")} LIMIT 10")
                           .append("}");

                       predicateIdx++;
                   }
                   queryString.append("}");
                   */

                   fieldDefinition.setAutosuggestionPattern(queryString.toString());
                }
            }

        }
        return Optional.ofNullable(fieldDefinition);
    }

    private IRI determineDatatype(RepositoryConnection conn, IRI iri, Set<IRI> ranges) {
        final IRI singleRange = ranges.size() == 1 ? ranges.iterator().next() : null;
        if (singleRange != null) {
            if (XMLDatatypeUtil.isBuiltInDatatype(singleRange)) {
                return singleRange;
            } else if (!RDFS.LITERAL.equals(singleRange)) {
                return XSD.ANYURI;
            }
        }

        if (conn.hasStatement(iri, RDF.TYPE, OWL.OBJECTPROPERTY, true)) {
            return XSD.ANYURI;
        }

        // look at occurrence patterns: if any existing value of the property is not a literal, the type should be
        // anyURI
        BooleanQuery query = conn
                .prepareBooleanQuery("ASK WHERE { [] ?iri ?value. FILTER(!isLiteral(?value)) }");
        query.setBinding("iri", iri);
        if (query.evaluate()) {
            return XSD.ANYURI;
        }

        return XSD.STRING;
    }

    private boolean isKnownProperty(RepositoryConnection conn, IRI iri) {
        BooleanQuery query = conn.prepareBooleanQuery(askQuery);
        query.setBinding("iri", iri);

        return query.evaluate();
    }

    @Override
    public int getOrder() {
        // order quite early, but leave enough space for extensions
        return OrderableComparator.EARLY + 100;
    }

}
