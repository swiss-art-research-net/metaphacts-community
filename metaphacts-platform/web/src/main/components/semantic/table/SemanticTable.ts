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
import { ClassAttributes, createElement } from 'react';
import * as D from 'react-dom-factories';
import * as PropTypes from 'prop-types';
import * as _ from 'lodash';

import { Cancellation } from 'platform/api/async';
import { SparqlClient, SparqlUtil } from 'platform/api/sparql';
import { Component, ComponentProps, ComponentContext } from 'platform/api/components';
import { BuiltInEvents, trigger } from 'platform/api/events';

import { Spinner } from 'platform/components/ui/spinner';
import { TemplateItem } from 'platform/components/ui/template';
import { ControlledPropsHandler } from 'platform/components/utils';
import { ErrorNotification } from 'platform/components/ui/notification';

import { ColumnConfiguration, Table, TableConfig, TableLayout } from './Table';

interface ControlledProps {
  /**
   * In controlled mode sets current page in the table;
   * in uncontrolled mode only sets initial page.
   */
  readonly currentPage?: number;
}

interface TableState {
  data?: SparqlClient.SparqlStarSelectResult;
  isLoading?: boolean;
  error?: any;
}

export interface Options {
    /**
     * Whether or not to display table filter
     *
     * @default true
     */
    showFilter?: boolean

    /**
     * Determines if the table heading should be displayed
     *
     * @default true
     */
    showTableHeading?: boolean

    /**
     * Determines if sorting is enabled
     *
     * @default true
     */
    enableSort?: boolean
}

/**
 * The simplest table configuration can be used to show all SPARQL result set projection variables.
 * The SPARQL projection variable name is used as column header. IRIs will be rendered as resolvable links using the `<semantic-link>` component or as a simple string otherwise.
 */
export interface BaseConfig extends ControlledProps {
  /**
   * SPARQL Select query.
   */
  query: string

  /**
   * Number of rows to show on the one page
   *
   * @default 10
   */
  numberOfDisplayedRows?: number

  /**
   * <semantic-link uri='http://help.metaphacts.com/resource/FrontendTemplating'>Template</semantic-link> which is applied when the query returns no results.
   */
  noResultTemplate?: string

  /**
   * various ui options.
   */
  options?: Options

  /**
   * ID for issuing component events.
   */
  id?: string;

  /**
   * Determines if the table should automatically fetch and display labels for resource IRIs.
   *
   * @default true
   */
  showLabels?: boolean;

  /**
   * Prefetches labels for all resource IRIs in the data to support sorting and filtering
   * by resource labels.
   *
   * @default true
   */
  prefetchLabels?: boolean;

  /**
   * Enable displaying datatypes of literals. This option is applicable only to default cell templates.
   * @default false
   */
  showLiteralDatatype?: boolean;

  /**
   * Add parameters to URLs. This option is applicable only to default cell templates.
   */
  linkParams?: {};
}

/**
 * More advanced configuration that can be used to restrict the set of columns to be visualized, to modify the column headings or to provide custom cell visualization templates
 */
export interface ColumnConfig extends BaseConfig {
  /**
   * List of columns to display. If specified table shows only columns explicitly specified in the configuration
   */
  columnConfiguration: Array<ColumnConfiguration>
}

/**
 * The most advanced table configuration that provides the ability to customize the rendering of an entire table row via tuple templates.
 */
export interface RowConfig extends BaseConfig {
  /**
   * <semantic-link uri='http://help.metaphacts.com/resource/FrontendTemplating'>Template</semantic-link> for the whole table row. Can be used to have visualizations different from the standard, e.g grid of thumbnails.
   * The template has access to all projection variables for a single result tuple.
   */
  tupleTemplate: string
}
export function isRowConfig(config: SemanticTableConfig): config is RowConfig {
  return _.has(config, 'tupleTemplate');
}

export type SemanticTableConfig = BaseConfig | ColumnConfig | RowConfig;
export type SemanticTableProps =
  SemanticTableConfig &
  ControlledPropsHandler<ControlledProps> &
  ComponentProps &
  ClassAttributes<SemanticTable>;

export class SemanticTable extends Component<SemanticTableProps, TableState> {
  static propTypes: Partial<Record<keyof SemanticTableProps, any>> = {
    ...Component.propTypes,
    onControlledPropChange: PropTypes.func,
  };

  private querying = Cancellation.cancelled;

  constructor(props: SemanticTableProps, context: ComponentContext) {
    super(props, context);
    this.state = {
      isLoading: true,
    };
  }

  private readonly TABLE_REF = 'table';
  refs: {table: Table};

  getSelected() {
    // TODO: there are no `getSelected()` method on Table?!
    return (this.refs[this.TABLE_REF] as any).getSelected();
  }

  public shouldComponentUpdate(nextProps: SemanticTableProps, nextState: TableState) {
    return nextState.isLoading !== this.state.isLoading || !_.isEqual(nextProps, this.props);
  }


  public componentWillReceiveProps(nextProps: SemanticTableProps, context: ComponentContext) {
    if (nextProps.query !== this.props.query) {
      this.prepareConfigAndExecuteQuery(nextProps, context);
    }
  }

  public componentDidMount() {
    this.prepareConfigAndExecuteQuery(this.props, this.context);
  }

  componentWillUnmount() {
    this.querying.cancelAll();
  }

  public render() {
    if (this.state.error) {
      return createElement(ErrorNotification, {errorMessage: this.state.error});
    } else {
      return D.div(
        {className: 'semantic-table-holder'},
        this.state.isLoading ? createElement(Spinner) :
          this.state.data && !SparqlUtil.isSelectResultEmpty(this.state.data) ?
          this.renderTable() : createElement(TemplateItem, {template: {source: this.props.noResultTemplate}})
      );
    }
  }

  private renderTable() {
    let layout: TableLayout = {
      tupleTemplate: isRowConfig(this.props) ? this.props.tupleTemplate : undefined,
      options: this.props.options,
      showLabels: this.props.showLabels,
      prefetchLabels: this.props.prefetchLabels,
    };
    layout = this.handleDeprecatedLayout(layout);
    const {currentPage, onControlledPropChange, ...otherProps} = this.props;
    const controlledProps: Partial<TableConfig> = {
      currentPage,
      onPageChange: onControlledPropChange
        ? page => onControlledPropChange(this.props.id, {currentPage: page}) : undefined,
    };
    return createElement(Table, {
      ...otherProps,
      ...controlledProps,
      layout: layout,
      numberOfDisplayedRows: this.props.numberOfDisplayedRows,
      data: this.state.data,
      ref: this.TABLE_REF,
    });
  }

  private prepareConfigAndExecuteQuery = (props: SemanticTableProps, context: ComponentContext) => {
    this.setState({
      isLoading: true,
      error: undefined,
    });
    this.querying.cancelAll();
    this.querying = new Cancellation();
    const loading = this.querying.map(
      SparqlClient.selectStar(props.query, {context: context.semanticContext})
    ).onValue(
      res => this.setState({data: res, isLoading: false})
    ).onError(
      error => this.setState({isLoading: false, error})
    ).onEnd(() => {
      if (this.props.id) {
        trigger({eventType: BuiltInEvents.ComponentLoaded, source: this.props.id});
      }
    });
    if (this.props.id) {
      trigger({
        eventType: BuiltInEvents.ComponentLoading,
        source: this.props.id,
        data: loading,
      });
    }
  }

  private handleDeprecatedLayout(layout: TableLayout): TableLayout {
    if (_.has(this.props, 'layout')) {
      console.warn(
        'layout property in semantic-table is deprecated, please use flat properties instead'
      );
      layout.tupleTemplate = (this.props as any)['layout']['tupleTemplate'];
      layout.options = (this.props as any)['layout']['options'];
    }
    return layout;
  }
}

export default SemanticTable;
