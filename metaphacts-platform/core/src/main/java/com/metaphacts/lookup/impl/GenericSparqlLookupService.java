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
package com.metaphacts.lookup.impl;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.query.TupleQuery;
import org.eclipse.rdf4j.repository.RepositoryConnection;

import com.metaphacts.api.sparql.SparqlOperationBuilder;
import com.metaphacts.lookup.api.LookupService;
import com.metaphacts.lookup.model.LookupQuery;
import com.metaphacts.lookup.util.LookupSparqlQueryBuilder;

/**
 * Generic implementation for {@link LookupService} for SPARQL repositories.
 * This implementation allows users to customize the query generated from LookupRequest
 * by changing some block or the whole query. Customization is performed using
 * specific configuration provided as {@link SparqlQueryLookupConfig}:
 * <ol>
 *      <li>queryTemplate</li>
 *      <li>searchBlockTemplate</li>
 *      <li>typeBlockTemplate</li>
 *      <li>objectPropertyBlockTemplate</li>
 *      <li>dataPropertyBlockTemplate</li>
 * <ol/>
 * <p>
 *     Best way to configure all variables for this service is to use <code>config/lookup.prop</code>
 *     file to set all variables.
 * </p>
 *
 * <br><br><!-- =========================================================== -->
 *
 * <h3>1) queryTemplate</h3>
 * Defines a layout of the result query. It's possible to use following placeholders in this template:
 * <b>{{static_uuid}}</b>, <b>{{search_block}}</b>, <b>{{properties_block}}</b>,
 * <b>{{limit_block}}</b>, <b>{{type_block}}</b> .
 * It is expected to have following variables as a result: ?candidate, ?types, ?score
 * (?label - is optional and should only be used for the cases when you don't want to use label service).
 * In the default configuration it's expected to have following variables as input from inner blocks:
 * ?type and ?score_private (from <b>{{search_block}}</b>).
 *
 * <h4>Example</h4>
 * <h5>Default value:</h5>
 * <code>
 * SELECT
 *     ?candidate
 *     (GROUP_CONCAT(DISTINCT ?type ; separator=",") as ?types)
 *     (MAX(?score_private) as ?score)
 * WHERE {
 *     {{type_block}}
 *     {{search_block}}
 *     {{properties_block}}
 * } GROUP BY ?candidate ORDER BY DESC(?score) {{limit_block}}
 * </code>
 *
 * <br><br><!-- =========================================================== -->
 *
 * <h3>2) searchBlockTemplate</h3>
 *
 * Defines custom template for <b>{{search_block}}</b> part in the queryTemplate. This part in general
 * performs filtration by token, but also returns ?score_private and ?type variables (In the default implementation).
 * Available placeholders: <b>{{static_uuid}}</b> .
 * Available bindings: <b>?__token__</b>, <b>?__language__</b>.
 * In the default configuration it is expected to have following variables as a result: ?type, ?score_private
 *
 * <h4>Example</h4>
 * <h5>Default value:</h5>
 * <code>
 * ?candidate a ?type.
 * ?candidate ?keyProp ?key.
 * FILTER ISLITERAL(?key)
 * BIND(IF(
 *      STRLEN(?key) > STRLEN(?__token__),
 *      STRLEN(?__token__) - STRLEN(?key),
 *      IF(
 *          STRLEN(?key) < STRLEN(?__token__),
 *          STRLEN(?key) - STRLEN(?__token__),
 *          "0"
 *      )
 * )  as ?score_private)
 * FILTER REGEX(LCASE(?key), LCASE(?__token__), "i").
 * </code>
 *
 * <h5>Blazegraph value:</h5>
 * <code>
 * ?candidate a ?type.
 * ?candidate ?keyProp ?key.
 * FILTER ISLITERAL(?key)
 * SERVICE <http://www.bigdata.com/rdf/search#search> {
 *      ?key <http://www.bigdata.com/rdf/search#search> ?__token__;
 *      <http://www.bigdata.com/rdf/search#relevance> ?score_private ;
 *      <http://www.bigdata.com/rdf/search#minRelevance> "0.1";
 *      <http://www.bigdata.com/rdf/search#matchAllTerms> "true".
 * }
 * </code>
 *
 * <br><br><!-- =========================================================== -->
 *
 * <h3>3) typeBlockTemplate</h3>
 * Defines custom template for <b>{{type_block}}</b> part in the queryTemplate.
 * Performs filtering by selected type. Depending on lookup request can be skipped by builder.
 * Available placeholders: <b>{{static_uuid}}</b>. Available bindings: <b>?__type__</b>.
 *
 * <h4>Example</h4>
 * <h5>Default value:</h5>
 * <code>
 * ?candidate a ?__type__.
 * </code>
 *
 * <br><br><!-- =========================================================== -->
 *
 * <h3>4) objectPropertyBlockTemplate</h3>
 * Defines custom template for all object property blocks from the <b>{{properties_block}}</b>
 * part in the queryTemplate.
 * Available placeholders: <b>{{static_uuid}}</b>.
 * Available bindings: <b>?__property__</b>, <b>?__object__</b>.
 *
 * <h4>Example</h4>
 * <h5>Default value:</h5>
 * <code>
 * ?candidate ?__property__ ?__object__.
 * </code>
 *
 * <br><br><!-- =========================================================== -->
 *
 * <h3>5) dataPropertyBlockTemplate</h3>
 * Defines custom template for all data property blocks from the <b>{{properties_block}}</b> part in
 * the queryTemplate.Available placeholders: <b>{{static_uuid}}</b>.
 * Available bindings: <b>?__property__</b>, <b>?__literal__</b>.
 *
 * <h4>Example</h4>
 * <h5>Default value:</h5>
 * <code>
 * ?candidate ?__property__ ?value{{static_uuid}}.
 * FILTER ISLITERAL(?value{{static_uuid}})
 * FILTER (STR(?value{{static_uuid}}) = STR(?__literal__))
 * </code>
 *
 * </ol>
*/
public class GenericSparqlLookupService extends AbstractSPARQLSearchLookupService {
    private static final Logger logger = LogManager.getLogger(GenericSparqlLookupService.class);

    public GenericSparqlLookupService(SparqlQueryLookupConfig config) {
        super(config);
    }

    @Override
    protected TupleQuery createQuery(LookupQuery query, RepositoryConnection con) {
        String queryTemplate = config.getQueryTemplate();
        if (queryTemplate == null) { queryTemplate = LookupSparqlQueryBuilder.DEFAULT_QUERY_TEMPLATE.queryTemplate; }

        String searchBlockTemplate = config.getSearchBlockTemplate();
        if (searchBlockTemplate == null) { searchBlockTemplate = LookupSparqlQueryBuilder.DEFAULT_QUERY_TEMPLATE.searchBlockTemplate; }

        String typeBlockTemplate = config.getTypeBlockTemplate();
        if (typeBlockTemplate == null) { typeBlockTemplate = LookupSparqlQueryBuilder.DEFAULT_QUERY_TEMPLATE.typeBlockTemplate; }

        String objectPropertyBlockTemplate = config.getObjectPropertyBlockTemplate();
        if (objectPropertyBlockTemplate == null) { objectPropertyBlockTemplate = LookupSparqlQueryBuilder.DEFAULT_QUERY_TEMPLATE.objectPropertyBlockTemplate; }

        String dataPropertyBlockTemplate = config.getDataPropertyBlockTemplate();
        if (dataPropertyBlockTemplate == null) { dataPropertyBlockTemplate = LookupSparqlQueryBuilder.DEFAULT_QUERY_TEMPLATE.dataPropertyBlockTemplate; }

        LookupSparqlQueryBuilder.QueryPart parsedQuery = LookupSparqlQueryBuilder.parseQuery(
            query,
            new LookupSparqlQueryBuilder.SparqlQueryTemplate(
                queryTemplate,
                searchBlockTemplate,
                typeBlockTemplate,
                objectPropertyBlockTemplate,
                dataPropertyBlockTemplate
            )
        );

        String resolvedQuery = parsedQuery.getAsString();
        logger.trace("Prepared lookup query:\n{}\nBindings: {}", resolvedQuery, parsedQuery.getBindings());

        SparqlOperationBuilder<TupleQuery> builder = SparqlOperationBuilder.create(resolvedQuery, TupleQuery.class);

        builder.setBindings(parsedQuery.getBindings());
        builder.setNamespaces(namespaceRegistry.getPrefixMap());
        return builder.build(con);
    }

    @Override
    protected boolean isRelevantScore(double score) {
        return score >= -3;
    }
}
