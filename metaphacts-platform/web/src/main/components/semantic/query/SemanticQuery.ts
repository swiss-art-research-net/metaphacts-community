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
import { ReactElement, CSSProperties, ClassAttributes, createElement } from 'react';
import * as maybe from 'data.maybe';
import * as _ from 'lodash';

import { Cancellation } from 'platform/api/async';
import { Rdf } from 'platform/api/rdf';
import { SparqlClient, SparqlUtil } from 'platform/api/sparql';
import { Component, ComponentContext } from 'platform/api/components';
import { ErrorNotification } from 'platform/components/ui/notification';

import { Spinner } from 'platform/components/ui/spinner';
import { TemplateItem } from 'platform/components/ui/template';

/**
 * Component to render SPARQL SELECT results in a fully customizable way using templates.
 *
 * **Example** (with default template):
 * ```
 * <semantic-query
 *   query='
 *     SELECT ?person ?name WHERE {}
 *   	 VALUES (?person ?name) { (foaf:Joe "Joe") (foaf:Mike "Mike") }
 *   '>
 * </semantic-query>
 * ```
 *
 * **Example** (with custom template):
 * ```
 * <semantic-query
 *   query='
 *     SELECT ?person ?name WHERE {}
 *     VALUES (?person ?name) { (foaf:Joe "Joe") (foaf:Mike "Mike") }
 *   '>
 *   template='{{> results}}'>
 *   <template id='results'>
 *     <ul>
 *       {{#each bindings}}
 *       <li><semantic-link iri='{{person.value}}'>{{name.value}}</semantic-link></li>
 *       {{/each}}
 *     </ul>
 *   </template>
 * </semantic-query>
 * ```
 */
export interface SemanticQueryConfig {
  /**
   * SPARQL SELECT query string.
   */
  query: string;

  /**
   * Template that gets a [bindings](https://www.w3.org/TR/sparql11-results-json/#select-results)
   * object injected as template context i.e. the result binding to iterate over.
   *
   * [each helper](http://handlebarsjs.com/builtin_helpers.html#iteration) can be used to iterate
   * over the bindings.
   *
   * The template will only be rendered if and only if the result is not empty, so that one
   * does not need to have additional if expressions around the component in order to hide it,
   * for example, a list header if actually no result are to be displayed.
   *
   * **Example:** `My Result: {{#each bindings}}{{bindingName.value}}{{/each}}`
   *
   * **Default:** If no template is provided, all tuples for the first projection variable will be
   * rendered as a comma-separated list of semantic-link (if IRI) or plain text items.
   *
   * @mpSeeResource {
   *   "name": "Client-side templating",
   *   "iri": "http://help.metaphacts.com/resource/FrontendTemplating"
   * }
   */
  template?: string;

  /**
   * Template which is applied when query returns no results.
   *
   * @mpSeeResource {
   *   "name": "Client-side templating",
   *   "iri": "http://help.metaphacts.com/resource/FrontendTemplating"
   * }
   */
  noResultTemplate?: string;

  /**
   * CSS classes for component holder element.
   *
   * Note that if the template does not have a single HTML root element,
   * the CSS class is not applied.
   */
  className?: string;

  /**
   * CSS styles for component holder element.
   *
   * Note that if the template does not have a single HTML root element,
   * the CSS styles are not applied.
   */
  style?: CSSProperties;
}

interface SemanticQueryTemplateData {
  bindings: ReadonlyArray<SemanticQueryBinding>;
  distinct: boolean;
  ordered: boolean;
}

/**
 * JSON object which maps binding names to RDF terms.
 */
interface SemanticQueryBinding {
  readonly [bindingName: string]: Rdf.Node | Rdf.Quad;
}

export type SemanticQueryProps = SemanticQueryConfig & ClassAttributes<SemanticQuery>;

interface SemanticQueryState {
  result?: Data.Maybe<SparqlClient.SparqlStarSelectResult>;
  isLoading?: boolean;
  error?: any;
}

export class SemanticQuery extends Component<SemanticQueryProps, SemanticQueryState>  {
  private querying = Cancellation.cancelled;

  constructor(props: SemanticQueryConfig, context: ComponentContext) {
    super(props, context);
    this.state = {
      result: maybe.Nothing<SparqlClient.SparqlSelectResult>(),
      isLoading: true,
    };
  }

  public componentDidMount() {
    this.executeQuery(this.props, this.context);
  }

  componentWillUnmount() {
    this.querying.cancelAll();
  }

  public shouldComponentUpdate(nextProps: SemanticQueryProps, nextState: SemanticQueryState) {
    return nextState.isLoading !== this.state.isLoading || !_.isEqual(nextProps, this.props);
  }

  public componentWillReceiveProps(nextProps: SemanticQueryProps, context: ComponentContext) {
    if (nextProps.query !== this.props.query) {
      this.executeQuery(nextProps, context);
    }
  }

  public render() {
    if (this.state.isLoading) {
      return createElement(Spinner);
    } else if (this.state.error) {
      return createElement(ErrorNotification, {errorMessage: this.state.error});
    } else {
      return this.state.result.map(this.renderResult(this.props.template)).getOrElse(null);
    }
  }

  /**
   * Returns a ReactElement by compiling the (optional) handlebars.js templateString
   * (or using a defaultTemplate otherwise). The bindings from the SparqlSelectResult
   * will be passed into the template as context.
   */
  private renderResult =
  (templateString?: string) => (res: SparqlClient.SparqlStarSelectResult)
    : ReactElement<any> => {
    if (SparqlUtil.isSelectResultEmpty(res)) {
      return createElement(TemplateItem, {template: {source: this.props.noResultTemplate}});
    }

    const firstBindingVar = res.head.vars[0];
    const templateData: SemanticQueryTemplateData = res.results;

    return createElement(TemplateItem, {
      template: {
        source: this.getTemplateString(templateString, firstBindingVar),
        options: templateData,
      },
      componentProps: {
        style: this.props.style,
        className: this.props.className,
      },
    });
  }

  /**
   * Returns a default handlbars.js template string to render the first binding
   * of a SPARQL Select result into a (default) list if no custom template
   * is specified by the user.
   *
   * @param res SparqlSelectResult to extract the first binding variable from
   * @returns {string}
   */
  private getTemplateString = (
    template: string, bindingVar: string
  ): string => {

    if (template) {
      return template;
    }
    return '<div>{{#each bindings}}' +
                '{{#if (isIri ' + bindingVar + ')}}' +
                  '<semantic-link uri=\"{{' + bindingVar + '.value}}\"></semantic-link>' +
                '{{else}}' +
                    '{{' + bindingVar + '.value}}' +
                '{{/if}}' +
                '{{#if @last}}{{else}},&nbsp;{{/if}}' +
              '{{/each}}</div>';
  }

  /**
   * Executes the SPARQL Select query and pushes results to state on value.
   */
  private executeQuery = (props: SemanticQueryProps, ctx: ComponentContext): void => {
    this.querying.cancelAll();
    this.querying = new Cancellation();

    this.setState({isLoading: true, error: undefined});
    const context = ctx.semanticContext;
    this.querying.map(
      SparqlClient.selectStar(props.query, {context})
    ).observe({
      value: result => this.setState({
        result: maybe.Just(result),
        isLoading: false,
      }),
      error: error => this.setState({
        error,
        isLoading: false,
      }),
    });
  }
}
export default SemanticQuery;
