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
import { ClassAttributes, createElement } from 'react';
import * as assign from 'object-assign';

import { Component, ComponentContext } from 'platform/api/components';
import { DataQuery, DataClient } from 'platform/api/dataClient';
import { Rdf } from 'platform/api/rdf';
import { Droppable } from 'platform/components/dnd';
import { ErrorNotification } from 'platform/components/ui/notification';

// legacy dependencies
import { SparqlUtil, VariableRenameBinder, QueryVisitor } from 'platform/api/sparql';
import * as SparqlJs from 'sparqljs';

import {
  BaseProps,
  AbstractAutoCompletionInput,
  DEFAULT_VALUE_BINDING_NAME,
  DEFAULT_SEARCH_TERM_VARIABLE as LEGACY_DEFAULT_INPUT_VARIABLE,
} from './AbstractAutoCompletionInput';

export interface AutoCompletionInputProps extends ClassAttributes<AutoCompletionInput>, BaseProps {
  query: string | DataQuery
  /**
   * @deprecated Escaping will be applied automatically based on SPARQL query.
   */
  escapeLuceneSyntax?: boolean;
  /**
   * @deprecated Tokenization will be applied automatically based on SPARQL query.
   */
  tokenizeLuceneQuery?: boolean;
  droppable?: {
    query: string
    styles?: {
      enabled: any
      disabled: any
    }
    components?: {
      disabledHover?: any
    }
  }
  defaultQuery?: string | DataQuery;
  multi?: boolean
}

interface State {
  error?: Error;
}

const SEARCH_INPUT_VARIABLE = '__token__';
export class AutoCompletionInput extends Component<AutoCompletionInputProps, State> {
  private autoCompletion: AbstractAutoCompletionInput;

  constructor(props: AutoCompletionInputProps, context: ComponentContext) {
    super(props, context);
    this.state = {};
  }

  componentDidMount() {
    this.validateConfiguration();
  }

  componentDidUpdate(prevProps: AutoCompletionInputProps) {
    if (this.props.query !== prevProps.query) {
      this.validateConfiguration();
    }
  }

  private validateConfiguration() {
    if (typeof this.props.query === 'string') { return; }

    const error = DataClient.validateQuery(
      this.props.query, [this.props.valueBindingName || DEFAULT_VALUE_BINDING_NAME]
    );
    if (error) {
      this.setState({error});
    }
  }

  render() {
    const {error: errorMessage} = this.state;
    if (errorMessage) {
      return createElement(ErrorNotification, {errorMessage});
    }

    const result = createElement(AbstractAutoCompletionInput,
      assign({
        ref: (comp: AbstractAutoCompletionInput) => { this.autoCompletion = comp; },
        searchTermVariable: this.props.searchTermVariable || SEARCH_INPUT_VARIABLE,
      }, this.props, {
        queryFn: this.executeQuery(this.props.query),
        defaultQueryFn: this.props.defaultQuery
          ? this.executeQuery(this.props.defaultQuery)
          : undefined,
        templates: this.props.templates || undefined,
        actions: this.props.actions && this.props.actions.onSelected ? {
          onSelected: this.props.actions.onSelected,
        } : undefined,
      })
    );
    if (this.props.droppable) {
      return createElement(Droppable,
        {
          query: this.props.droppable.query,
          dropStyles: this.props.droppable.styles,
          dropComponents: this.props.droppable.components,
          onDrop: (drop: Rdf.Iri) => {
            this.autoCompletion.setValue(drop);
          },
        },
        result
      );
    } else {
      return result;
  }
  }

  getValue() {
    return this.autoCompletion.getValue();
  }

  focus(): null {
    return null; // this.refs.input.focus();
  }

  private executeQuery =
      (query: string | DataQuery) =>
      (token: string, tokenVariable: string) => {
        const clientQuery = typeof query === 'string' ?
          fromLegacyQuery(query, {
            tokenVariable,
            // tslint:disable-next-line: deprecation
            tokenizeLuceneQuery: this.props.tokenizeLuceneQuery,
            // tslint:disable-next-line: deprecation
            escapeLuceneSyntax: this.props.escapeLuceneSyntax,
          }) : query;

        if (tokenVariable !== SEARCH_INPUT_VARIABLE) {
          console.warn('Please use new $__token__ variable in autocomplete search.');
        }
        const args: { [arg: string]: Rdf.Node } = {};
        if (tokenVariable) { args[tokenVariable] = Rdf.literal(token); }
        args[SEARCH_INPUT_VARIABLE] = Rdf.literal(token);

        return DataClient
          .fetchData(clientQuery, args, this.context.semanticContext)
          .onError(error => { this.setState({error}); });
      }
}

function fromLegacyQuery(
  query: string,
  params: {
    tokenVariable: string;
    escapeLuceneSyntax?: boolean;
    tokenizeLuceneQuery?: boolean;
  }
) {
  const parsedQuery = SparqlUtil.parseQuerySync(query);
  new VariableRenameBinder(
    LEGACY_DEFAULT_INPUT_VARIABLE, params.tokenVariable
  ).sparqlQuery(parsedQuery);
  new LegacyQueryTransformer(
    LEGACY_DEFAULT_INPUT_VARIABLE, params.tokenVariable
  ).sparqlQuery(parsedQuery);

  const sparqlQuery = SparqlUtil.serializeQuery(parsedQuery);

  return DataClient.createClientQuery(sparqlQuery, {
      [params.tokenVariable]: {
        type: 'token',
        required: true,
        escapeLuceneSyntax: params.escapeLuceneSyntax,
        tokenizeLuceneQuery: params.tokenizeLuceneQuery
      }
    });
}

class LegacyQueryTransformer extends QueryVisitor {
  private legacyTokenVariable: string;
  private tokenVariable: SparqlJs.VariableTerm;
  constructor(legacyVariable: string, tokenVariable: string) {
    super();
    this.legacyTokenVariable = `?${legacyVariable}`;
    this.tokenVariable = Rdf.DATA_FACTORY.variable(tokenVariable);
   }

  literal(literal: SparqlJs.LiteralTerm) {
    /*
      Here we translate legacy query to a relevant one,
      but now it's deprecated behavior to use token in literals:
        ?subj ?pred "?token" will be translated to: ?subj ?pred ?__token__
      Example (?token = "Germany")
      The old behavior:
        ?subj ?pred "Metaphacts in ?token*" => ?subj ?pred "Metaphacts in Germany*"
      The new behavior:
        ?subj ?pred "Metaphacts in ?token*" => ?subj ?pred ?__token__ =>
          ?subj ?pred "Germany""^^<http://www.w3.org/2001/XMLSchema#string>"
    */
    if (literal.value.indexOf(this.legacyTokenVariable) !== -1) {
      return this.tokenVariable;
    }
  }
}
