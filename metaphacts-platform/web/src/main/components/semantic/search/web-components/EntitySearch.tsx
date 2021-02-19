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
import * as Maybe from 'data.maybe';
import * as React from 'react';
import * as SparqlJs from 'sparqljs';

import { Component } from 'platform/api/components';
import { SparqlClient, SparqlUtil } from 'platform/api/sparql';

import { SimpleSearch } from 'platform/components/semantic/simple-search/SimpleSearch';
import { setSearchDomain } from '../commons/Utils';
import { SemanticSearchKeywordConfig } from './KeywordSearch';
import { SemanticSearchContext, InitialQueryContext } from './SemanticSearchApi';

export interface SemanticEntitySearchConfig extends SemanticSearchKeywordConfig {
    /**
     * SPARQL Select query string, which will be provided to the search framework as base query.
     * The query string will be parameterized through the values as selected by the user from
     * auto-suggestion list, which is generated through the `search-query`. Selected values will be
     * injected using the same binding variable name as specified by the `resource-binding-name`
     * attribute i.e. effectively using the same as variable name as returned by the `search-query`.
     */
    query: string;
    defaultQuery?: string;

    /**
     * SPARQL Select query string which is used to provide a auto-suggestion list of resources.
     * Needs to expose result using a projection variable equal to the `resource-binding-name`
     * attribute.
     *
     * @default `PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            PREFIX lookup: <http://www.metaphacts.com/ontologies/platform/repository/lookup#>
            SELECT ?resource WHERE {
              SERVICE Repository:lookup {
                ?resource lookup:token ?__token__ .
                ?resource lookup:name ?name .
                ?resoure lookup:score ?score .
              }
              BIND(STRLEN(?name) as ?length)
            } ORDER BY DESC(?score) ?length`
     */
    searchQuery?: string

    /**
     * Whether multi-selection of values should be allowed. If set to `true`,
     * VALUES clause will be used to inject the values into the base `query` for filtering.
     * If set to `false`, only a single value can be selected from the auto-suggestion.
     * The value will be injected by replacement of the binding variable.
     *
     * @default false
     */
    multi: boolean

    /**
     * Name of the bind variable (without question mark), which is returned
     * (a) as projection variable by the `search-query`
     * and
     * (b) used to inject the selected values into the base `query`.
     *
     * @default resource
     */
    resourceBindingName?: string;

    /**
     * Template for suggestion item.
     *
     * @mpSeeResource {
     *   "name": "Client-side templating",
     *   "iri": "http://help.metaphacts.com/resource/FrontendTemplating"
     * }
     */
    template?: string;
}

interface EntitySearchProps extends SemanticEntitySearchConfig {
  onSelected?: (value: SparqlClient.Binding | SparqlClient.Binding[]) => void;
}

/**
 * @example
 <semantic-search>
  <semantic-search-query-entities
        domain="<http://www.w3.org/2000/01/rdf-schema#Resource>"
        template='<span>
                <mp-label iri="{{resource.value}}"></mp-label> - ({{resource.value}})
            </span>'
    multi='true'
    query='SELECT DISTINCT ?subject WHERE {?subject a ?resource} LIMIT 10'
    default-query='SELECT DISTINCT ?resource WHERE {?resource a owl:Class} LIMIT 2'
     >
  </semantic-search-query-entities>

  <semantic-search-result-holder>
    <semantic-search-result>
      <semantic-table id="table" query="SELECT ?subject WHERE { }"></semantic-table>
    </semantic-search-result>
  </semantic-search-result-holder>
</semantic-search>
 */
class EntitySearch extends Component<EntitySearchProps, {}> {
  render() {
    return (
      <SemanticSearchContext.Consumer>
        {context => <EntitySearchInner {...this.props} context={context} />}
      </SemanticSearchContext.Consumer>
    );
  }
}

interface InnerProps extends EntitySearchProps {
  context: InitialQueryContext;
}

class EntitySearchInner extends React.Component<InnerProps, {}> {
    static defaultProps = {
        searchQuery: `
          PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
          PREFIX lookup: <http://www.metaphacts.com/ontologies/platform/repository/lookup#>
          SELECT ?resource WHERE {
            SERVICE Repository:lookup {
              ?resource lookup:token ?__token__ .
              ?resource lookup:name ?name .
              ?resource lookup:score ?score .
            }
            BIND(STRLEN(?name) as ?length)
          } ORDER BY DESC(?score) ?length`,
        template: '<span><mp-label iri="{{resource.value}}"></mp-label></span>' ,
        resourceBindingName: 'resource',
    };

    componentDidMount() {
        setSearchDomain(this.props.domain, this.props.context);
    }

    componentWillReceiveProps(props: InnerProps) {
      const {context} = props;
      if (context.searchProfileStore.isJust && context.domain.isNothing) {
        setSearchDomain(props.domain, context);
      }
    }

    render() {
        if (!this.props.query) {
            throw new Error(`The mandatory configuration attribute "query" is not set.`);
        }

        const {
            placeholder, style, className, multi, template,
            searchQuery, resourceBindingName, defaultQuery,
            // tslint:disable-next-line: deprecation
            escapeLuceneSyntax, tokenizeLuceneQuery
        } = this.props;
        return <SimpleSearch
                query={searchQuery}
                onSelected={this.onSelected}
                template={template}
                multi={multi}
                placeholder={placeholder}
                resourceBindingName={resourceBindingName}
                defaultQuery={defaultQuery}
                escapeLuceneSyntax={escapeLuceneSyntax}
                tokenizeLuceneQuery={tokenizeLuceneQuery}>
            </SimpleSearch>;
    }

    onSelected = (binding: SparqlClient.Binding | SparqlClient.Binding[]) => {
        // reset search if selection is emtpy e.g. after removal of initial selections
        if (this.isEmptySelection(binding)) {
            return this.props.context.setBaseQuery(Maybe.Nothing());
        }
        const variableName = this.props.resourceBindingName;
        const parsedQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(
            this.props.query
        );
        let query;

        if (this.props.multi) {
            // use values clause for multi value parameterization i.e. filtering
            const value = (binding as SparqlClient.Binding[])
              .map(node => ({[variableName] : node.resource}));
            query = SparqlClient.prepareParsedQuery(value)(parsedQuery);
        } else {
            // use setBinding i.e. replacement for single selection parameterization
            query = SparqlClient.setBindings(
                parsedQuery, {[variableName]: (binding as SparqlClient.Binding)[variableName]}
            );
        }

        this.props.context.setBaseQuery(Maybe.Just(query));
    }

    isEmptySelection(binding: SparqlClient.Binding | SparqlClient.Binding[]) {
        return (Array.isArray(binding) && !binding.length) || !binding;
    }
}

export default EntitySearch;
