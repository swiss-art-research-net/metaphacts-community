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
 * Copyright (C) 2015-2020, metaphacts GmbH
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
import { ReactElement, createElement } from 'react';
import * as D from 'react-dom-factories';
import * as _ from 'lodash';

import { DataQuery } from 'platform/api/dataClient';
import { SparqlClient } from 'platform/api/sparql';
import { Rdf } from 'platform/api/rdf';
import { navigateToResource } from 'platform/api/navigation';
import { Component, ComponentContext } from 'platform/api/components';
import { AutoCompletionInput, AutoCompletionInputProps } from 'platform/components/ui/inputs';

import { SemanticSimpleSearchConfig } from './Config';
export { SemanticSimpleSearchConfig } from './Config';
import './SimpleSearch.scss';

export interface SimpleSearchProps extends SemanticSimpleSearchConfig {
  onSelected?: (value: SparqlClient.Binding | SparqlClient.Binding[]) => void;
  multi?: boolean;
}

interface BackwardCompatibilityProps extends SimpleSearchProps {
  inputPlaceholder?: string;
  resourceSelection?: {resourceBindingName?: string; template: string};
}

interface SimpleSearchState {
  result?: Data.Maybe<SparqlClient.SparqlSelectResult>;
  isLoading?: boolean;
}

const DEFAULT_QUERY =
`PREFIX lookup: <http://www.metaphacts.com/ontologies/platform/repository/lookup#>
SELECT ?resource WHERE {
  SERVICE Repository:lookup {
    ?resource lookup:token ?__token__ .
  }
}`;

export class SimpleSearch extends Component<SimpleSearchProps, SimpleSearchState>  {
  constructor(props: SimpleSearchProps, context: ComponentContext) {
    super(props, context);
  }

  static defaultProps: Partial<SimpleSearchProps> = {
    placeholder: 'type to search, minimum 3 symbols ...',
    searchTermVariable: '__token__',
    minSearchTermLength: 3,
    resourceBindingName: 'resource',
    query: DEFAULT_QUERY,
    template: '<mp-label iri="{{resource.value}}"></mp-label>'
  };

  public render() {
    return D.div(
      {
        className: 'search-widget',
      },
      this.renderAutosuggestion()
    );
  }

  private renderAutosuggestion = (): ReactElement<AutoCompletionInputProps> => {
    const {
      minSearchTermLength, resourceBindingName, query, placeholder,
      searchTermVariable, multi, defaultQuery,
      // tslint:disable-next-line: deprecation
      escapeLuceneSyntax, tokenizeLuceneQuery,
    } = this.backwardCompatibleProps(this.props as BackwardCompatibilityProps);
    // use external onSelected function if any
    const onSelected = this.props.onSelected
      ? this.props.onSelected
      : (value: SparqlClient.Binding) => {
          navigateToResource(
            value[resourceBindingName] as Rdf.Iri
          ).onValue(x => x);
        };
    const autoSuggestionProps = {
      placeholder: placeholder,
      query: query,
      escapeLuceneSyntax: escapeLuceneSyntax,
      tokenizeLuceneQuery: tokenizeLuceneQuery,
      multi: multi,
      defaultQuery: defaultQuery,
      minimumInput: minSearchTermLength,
      valueBindingName: resourceBindingName,
      searchTermVariable: searchTermVariable,
      actions: {
        onSelected: onSelected,
      },
      templates: {
        suggestion: this.props.template,
      },
    };

    return createElement(
      AutoCompletionInput,
      // remove all undefined props so default values are properly picked
      _.omitBy<AutoCompletionInputProps, AutoCompletionInputProps>(
        autoSuggestionProps, _.isUndefined
      )
    );
  }

  private backwardCompatibleProps(props: BackwardCompatibilityProps): SimpleSearchProps {
    if (props.inputPlaceholder) {
      props = {
        ...props,
        placeholder: props.inputPlaceholder,
      };
    }
    if (props.resourceSelection) {
      props.resourceBindingName = props.resourceSelection.resourceBindingName;
      props.template = props.resourceSelection.template;
      props = {
        ...props,
        resourceBindingName: props.resourceSelection.resourceBindingName,
        template: props.resourceSelection.template,
      };
    }
    return props;
  }
}

export default SimpleSearch;
