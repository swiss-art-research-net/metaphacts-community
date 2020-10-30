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
import * as React from 'react';
import * as PropTypes from 'prop-types';
import * as _ from 'lodash';

import { SparqlClient, SparqlUtil } from 'platform/api/sparql';
import { ComponentContext, Component } from 'platform/api/components';
import { TableLayout, ColumnConfiguration } from '../table';
import { Spinner } from 'platform/components/ui/spinner';
import { ErrorNotification } from 'platform/components/ui/notification';
import { Cancellation } from 'platform/api/async';
import { trigger, BuiltInEvents } from 'platform/api/events';
import {
  CompContext,
  DataTable,
  DataTableOptions,
  DataTableProps,
  ColumnConfigurationExtensions,
} from './DataTable';
import {
  isRowConfig,
  SemanticTableProps,
  BaseConfig as PreviousBaseConfig,
} from '../table/SemanticTable';
import { TemplateItem } from 'platform/components/ui/template';

export type SemanticDataTableConfig = TableBaseConfig | TableColumnConfig | TableRowConfig;

/**
 * The simplest table configuration can be used to show all SPARQL result set projection variables.
 * The SPARQL projection variable name is used as column header. IRIs will be rendered as resolvable links using the `<semantic-link>` component or as a simple string otherwise.
 */
export interface TableBaseConfig extends PreviousBaseConfig {
  options: SemanticDataTableOptions;
}
/**
 * More advanced configuration that can be used to restrict the set of columns to be visualized, to modify the column headings or to provide custom cell visualization templates
 */
export interface TableColumnConfig extends TableBaseConfig {
  /**
   * List of columns to display. If specified table shows only columns explicitly specified in the configuration
   */
  columnConfiguration?: Array<SemanticColumnConfiguration>;
}
/**
 * The most advanced table configuration that provides the ability to customize the rendering of an entire table row via tuple templates.
 */
export interface TableRowConfig extends TableBaseConfig {
  /**
   * <semantic-link uri='http://help.metaphacts.com/resource/FrontendTemplating'>Template</semantic-link> for the whole table row. Can be used to have visualizations different from the standard, e.g grid of thumbnails.
   * The template has access to all projection variables for a single result tuple.
   */
  tupleTemplate: string
}

export type SemanticDataTableProps = SemanticTableProps & {
  options: SemanticDataTableOptions;
  columnConfiguration?: Array<SemanticColumnConfiguration>;
};

export interface SemanticDataTableOptions extends DataTableOptions { }
export interface SemanticColumnConfiguration extends
  ColumnConfiguration, ColumnConfigurationExtensions { }


// wrapper component that converts the context to new API
export class SemanticDataTableWithContext extends Component<SemanticDataTableProps, {}> {
  static propTypes: Partial<Record<keyof SemanticDataTableProps, any>> = {
    ...Component.propTypes,
    onControlledPropChange: PropTypes.func,
  };

  constructor(props: SemanticDataTableProps, context: ComponentContext) {
    super(props, context);
  }

  shouldComponentUpdate(nextProps: SemanticDataTableProps) {
    return !_.isEqual(this.props, nextProps);
  }

  render() {
    return <CompContext.Provider value={this.context}>
      <SemanticDataTable {...this.props}></SemanticDataTable>
    </CompContext.Provider>;
  }
}

export function SemanticDataTable(props: SemanticDataTableProps) {
  const ctx = React.useContext(CompContext);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(undefined);
  const [data, setData] = React.useState<SparqlClient.SparqlStarSelectResult>(undefined);

  React.useEffect(() => prepareConfigAndExecuteQuery(props, ctx, setLoading, setError, setData),
    [props.query, ctx.semanticContext.repository]);

  const {
    options, showLabels, prefetchLabels, numberOfDisplayedRows,
    onControlledPropChange,
    ...restProps
  } = props;

  // convert props to table props
  let layout: TableLayout = {
    tupleTemplate: isRowConfig(props) ? props.tupleTemplate : undefined,
    showLabels,
    prefetchLabels,
  };

  if (loading) {
    return <Spinner></Spinner>;
  }
  if (error) {
    return <ErrorNotification errorMessage={error}></ErrorNotification>;
  }
  if (!data || SparqlUtil.isSelectResultEmpty(data)) {
    return <div className='table-no-result'>
      <TemplateItem template={{ source: props.noResultTemplate }}></TemplateItem>
    </div>;
  }

  const controlledProps: Partial<DataTableProps> = {
    onPageChange: onControlledPropChange
      ? page => onControlledPropChange(props.id, { currentPage: page }) : undefined,
  };

  const tableProps: DataTableProps = {
    data,
    layout,
    options,
    numberOfDisplayedRows,
    ...controlledProps,
    ...restProps
  };

  return <DataTable {...tableProps}></DataTable>;
}

function prepareConfigAndExecuteQuery(
  props: SemanticDataTableProps,
  context: ComponentContext,
  setLoading: (loading: boolean) => void,
  setError: (error: any) => void,
  setData: (data: SparqlClient.SparqlStarSelectResult) => void
): () => void {
  const cancellation = new Cancellation();
  const loading = cancellation.map(
    SparqlClient.selectStar(props.query, { context: context.semanticContext })
  );
  loading.observe({
    value: res => {
      setData(res);
      setLoading(false);
    },
    error: error => {
      setError(error);
      setLoading(false);
    },
    end: () => {
      if (props.id) {
        trigger({ eventType: BuiltInEvents.ComponentLoaded, source: props.id });
      }
    }
  });
  if (props.id) {
    trigger({
      eventType: BuiltInEvents.ComponentLoading,
      source: props.id,
      data: loading,
    });
  }

  return () => cancellation.cancelAll();
}

export default SemanticDataTableWithContext;
