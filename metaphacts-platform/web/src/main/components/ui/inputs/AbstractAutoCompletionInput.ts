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
import {
  Component, ComponentClass, Props as ReactProps, CSSProperties, KeyboardEvent, createElement,
} from 'react';
import * as PropTypes from 'prop-types';
import * as Kefir from 'kefir';
import * as lambda from 'core.lambda';
import * as assign from 'object-assign';
import * as classNames from 'classnames';
import ReactSelect, { Async, Options } from 'react-select';
import * as _ from 'lodash';

import { SparqlClient } from 'platform/api/sparql';
import { Rdf } from 'platform/api/rdf';
import * as LabelsService from 'platform/api/services/resource-label';
import { Cancellation } from 'platform/api/async';

import { TemplateItem } from 'platform/components/ui/template';

declare module 'react-select' {
  interface ReactSelectProps {
    /** Should only be applicable for Async? */
    autoload?: boolean;
    /** Missing from typings */
    onCloseResetsInput?: boolean;
    /** ?? */
    'data-datatype'?: string;
  }
}

export const DEFAULT_VALUE_BINDING_NAME = 'value';
export const DEFAULT_SEARCH_TERM_VARIABLE = 'token';

export interface BaseProps {
  disabled?: boolean
  className?: string
  autofocus?: boolean
  style?: CSSProperties
  onClick?: any
  datatype?: string
  searchTermVariable?: string
  minimumInput?: number
  allowForceSuggestion?: boolean
  valueBindingName?: string
  labelBindingName?: string
  name?: string
  placeholder?: string
  multi?: boolean
  templates?: {
    empty?: string
    suggestion?: string
    displayKey?: (obj: SparqlClient.Binding) => string;
  }
  actions?: {
    onSelected?:
      ((selected: SparqlClient.Binding) => void) |
      ((selected: SparqlClient.Binding[]) => void);
  }
  value?: SparqlClient.Binding | ReadonlyArray<SparqlClient.Binding>
}

export interface AbstractAutoCompletionInputProps extends ReactProps<AbstractAutoCompletionInput>, BaseProps {
  queryFn: (x: string, tokenVariable: string) => Kefir.Property<SparqlClient.Bindings>
  /**
   * default query is used to show autosuggestion when input size is 0
   * e.g. it is useful to show latest items added to clipboard immediately when input is focused
   */
  defaultQueryFn?: (x: string, tokenVariable: string) => Kefir.Property<SparqlClient.Bindings>
}

interface State extends BaseProps {
  options?: Options
  loading?: boolean
  error?: any
  query?: string
}

export class AbstractAutoCompletionInput extends Component<AbstractAutoCompletionInputProps, State> {
  static defaultProps: Required<Pick<AbstractAutoCompletionInputProps, 'autofocus'>> = {
    autofocus: true,
  };

  private static MIN_LENGTH = 3;

  refs: {
    input: ReactSelect,
    [key: string]: any
  };

  private cancellation = new Cancellation();

  private keyPressStream = Kefir.pool<string>();
  private initStream = Kefir.pool<string>();
  private forceSuggestionStream = Kefir.pool<any>();

  constructor(props: AbstractAutoCompletionInputProps) {
    super(props);
    this.state = {
      value: undefined,
      options: undefined,
      loading: false,
    };
  }

  componentWillMount() {
    this.setState(
      assign(
        this.applyDefaultProps(this.props)
      )
    );
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  componentDidMount() {
    const requestProperty =
      Kefir.merge([
        this.initStream
          .map(query => {
            this.setState({loading: true});
            return query;
          }),
        this.forceSuggestionStream
          .map((event) => {
            const {query} = this.state;
            if (query.length < this.state.minimumInput) {
              this.setState({loading: true});
            } else {
              this.setState({loading: false, options: undefined});
            }
            return query;
          })
          .filter(query => query.length < this.state.minimumInput),
        this.keyPressStream
          .map(query => {
            this.setState({query: query});
            if (query.length >= this.state.minimumInput) {
              this.setState({loading: true});
            } else {
              this.setState({loading: false, options: undefined});
            }
            return query;
          })
          .filter(query => query.length >= this.state.minimumInput)
          .debounce(300),
      ])
      .flatMapLatest(
        this.executeSuggestionQuery
      );

    this.cancellation.map(requestProperty)
      .onValue(
        vals => this.setState(state => {
          return {options: vals as SparqlClient.Binding[], loading: false};
        })
      );
  }

  componentWillReceiveProps(nextProps: AbstractAutoCompletionInputProps) {
    this.setState(this.applyDefaultProps(nextProps));
  }

  render() {
    const valueRenderer =
        this.customSuggestionRenderer(this.state.templates.suggestion);
    return createElement(ReactSelect, {
      multi: this.state.multi,
      autofocus: this.props.autofocus,
      onCloseResetsInput: true,
      filterOptions: lambda.identity,
      isLoading: this.state.loading,
      autoload: false,
      disabled: this.state.disabled,
      className: classNames(this.state.className),
      style: this.props.style,
      ref: 'input',
      name: this.state.name,
      placeholder:  this.state.placeholder,
      value: this.state.value,
      onChange: this.onChange,
      onInputChange: this.loadOptions,
      onInputKeyDown: this.onKeyDown,
      onOpen: this.props.defaultQueryFn
        ? () => this.initStream.plug(Kefir.constant(''))
        : undefined,
      noResultsText: this.state.loading ? 'Loading ...' : (
        _.isUndefined(this.state.options) ? `Minimum ${this.state.minimumInput} characters to search` :
        this.customSuggestionRenderer(this.state.templates.empty)({})
      ),
      optionRenderer: valueRenderer,
      valueRenderer: valueRenderer,
      labelKey: this.state.labelBindingName,
      valueKey: this.state.valueBindingName,
      options: this.state.options,
      'data-datatype': this.state.datatype,
    });
  }

  getValue(): SparqlClient.Binding | ReadonlyArray<SparqlClient.Binding> {
    return this.state.value;
  }

  setValue(iri: Rdf.Iri) {
    LabelsService.getLabel(iri).onValue(label => {
      const newValue: SparqlClient.Binding = {
        [this.state.labelBindingName]: Rdf.literal(label),
        [this.state.valueBindingName]: iri,
      };
      this.onChange(newValue);
    });
  }

  focus() {
    return this.refs.input.focus();
  }

  private loadOptions = (query: string) => {
    this.keyPressStream.plug(Kefir.constant(query));
  }

  private onChange =
    (x: SparqlClient.Binding | SparqlClient.Binding[]) => {
      this.setState({value: x});
      this.props.actions.onSelected(x as SparqlClient.Binding & SparqlClient.Binding[]);
    }

  private onKeyDown = (event: KeyboardEvent) => {
    if (this.props.allowForceSuggestion) {
      if (event.keyCode === 13) {
        this.forceSuggestionStream.plug(Kefir.constant(event.keyCode));
      }
    }
  }

  private customSuggestionRenderer =
      (template: string) => (option: any) => {
        return createElement(TemplateItem, {
          template: {
            source: template,
            options: option,
          },
        });
      }

  private executeSuggestionQuery = (token: string) => {
    // if token is empty use default query to get suggestions
    const { defaultQueryFn, queryFn } = this.props;
    const queryToUse = _.isEmpty(token) && defaultQueryFn ? defaultQueryFn : queryFn;
    return queryToUse(token, this.state.searchTermVariable);
  }

  private applyDefaultProps(props: AbstractAutoCompletionInputProps) {
    const actions = assign({
      onSelected: (token: unknown) => {/**/},
    }, props.actions);

    const templates = assign({
      empty: 'No matches for your query.',
      suggestion: '<span title="{{value.value}}">{{label.value}}</span>',
      displayKey: (x: SparqlClient.Binding) => x.label.value,
    }, props.templates);

    return assign({
      multi: false,
      placeholder: 'search',
      valueBindingName: DEFAULT_VALUE_BINDING_NAME,
      labelBindingName: 'label',
      searchTermVariable: DEFAULT_SEARCH_TERM_VARIABLE,
      name: 'search-input',
      minimumInput: AbstractAutoCompletionInput.MIN_LENGTH,
      datatype: 'xsd:string',
    }, props, {
      actions: actions,
      templates: templates,
    });
  }
}

// override incorrect noResultsText to make ReactSelect work
// in debug mode (when warnings are errors)
(Async as ComponentClass<any>).propTypes['noResultsText'] = PropTypes.oneOfType([
  PropTypes.node,
  PropTypes.string,
]);
