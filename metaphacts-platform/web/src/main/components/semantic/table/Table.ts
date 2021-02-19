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
  createElement, ReactElement, ComponentClass, ClassAttributes,
} from 'react';
import * as Griddle from 'griddle-react';
import { GriddleConfig, ColumnMetadata } from 'griddle-react';
import * as _ from 'lodash';
import * as Immutable from 'immutable';

import { Cancellation } from 'platform/api/async';
import { Component } from 'platform/api/components';
import { SparqlClient } from 'platform/api/sparql';
import { Rdf } from 'platform/api/rdf';
import { getLabels } from 'platform/api/services/resource-label';

import { TemplateItem } from 'platform/components/ui/template';
import { Spinner } from 'platform/components/ui/spinner';
import { ErrorNotification } from 'platform/components/ui/notification';

import { Pagination, CustomPaginationProps } from './Pagination';
import { RdfValueDisplay } from './RdfValueDisplay';

import './Table.scss';
import {
  makeUniqueColumnNameGenerator,
  isPrimitiveDatatype,
  makeCellComparator,
  KeyedBufferPool,
  prepareCellMatchQuery,
  doesCellMatchText,
} from './tableutils';

export interface TableLayout {
  options?: Griddle.GriddleConfig;
  tupleTemplate?: string;

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
}

/**
 * Table column configuration which allows to override column header or cell visualization template.
 * Either `variableName` or `cellTemplate` is required to properly display column content.
 */
export interface ColumnConfiguration {
  /**
   * Cell heading label override.
   */
  displayName: string;
  /**
   * SPARQL projection variable name that this column is bind to.
   */
  variableName?: string;
  /**
   * Custom cell visualization template.
   *
   * Template has access to all projection variables for a single result tuple.
   *
   * @mpSeeResource {
   *   "name": "Client-side templating",
   *   "iri": "http://help.metaphacts.com/resource/FrontendTemplating"
   * }
   */
  cellTemplate?: string;
}

export interface TableColumnConfiguration extends ColumnConfiguration {
  cellComponent?: ComponentClass<CellRendererProps>;
}

export interface CellRendererProps {
  data: any;
  rowData: any;
}

export interface TableConfig {
  columnConfiguration?: ReadonlyArray<TableColumnConfiguration>;
  numberOfDisplayedRows?: number;
  layout?: TableLayout;
  data: TableData;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  showLiteralDatatype?: boolean;
  linkParams?: {};
  showCopyToClipboardButton?: boolean;
}

export type TableData = ReadonlyArray<any> | SparqlClient.SparqlStarSelectResult;

export type TableProps = TableConfig & ClassAttributes<Table>;

const DEFAULT_ROWS_PER_PAGE = 10;

interface State {
  readonly version: number;
  readonly buffer: KeyedBufferPool<Rdf.Iri, string>;
  readonly sourceData?: TableConfig['data'];
  readonly griddleConfig?: ExtendedGriddleConfig;
}

interface ExtendedGriddleConfig extends GriddleConfig {
  columnMetadata: ReadonlyArray<ExtendedColumnMetadata>;
}

interface ExtendedColumnMetadata extends ColumnMetadata {
  readonly variableName: string | undefined;
}

interface RenderingState {
  readonly showLabels: boolean;
  readonly preferchLabels: boolean;
  getLabel(resource: Rdf.Iri): string | undefined;
}

export class Table extends Component<TableProps, State> {
  private readonly cancellation = new Cancellation();

  constructor(props: TableProps, context: any) {
    super(props, context);
    this.state = {
      version: 1,
      buffer: new KeyedBufferPool(
        Immutable.Map(),
        this.cancellation,
        keys => getLabels(keys.toArray(), {context: this.context.semanticContext}),
        () => this.forceUpdate()
      )
    };
  }

  componentDidMount() {
    this.setState(state => this.updateStateFromProps(this.props, state));
  }

  componentWillReceiveProps(nextProps: TableProps) {
    this.setState(state => this.updateStateFromProps(nextProps, state));
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  private updateStateFromProps(props: TableProps, state: State): State {
    // set default values for `showLabels` and `prefetchLabels`
    let showLabels = true;
    let prefetchLabels = true;

    if (props.layout) {
      const {layout} = props;
      if (layout.showLabels !== undefined) {
        showLabels = layout.showLabels;
      }
      if (layout.prefetchLabels !== undefined) {
        prefetchLabels = layout.prefetchLabels;
      }
    }

    const renderingState: RenderingState = {
      get showLabels() {
        return showLabels;
      },
      get preferchLabels() {
        return prefetchLabels;
      },
      getLabel: resourceIri => {
        return (showLabels && prefetchLabels) ? state.buffer.result.get(resourceIri) : undefined;
      }
    };

    const griddleConfig = this.buildConfig(props, renderingState);

    const sameDataAndMetadata = Boolean(
      state.griddleConfig &&
      sameColumnMetadata(state.griddleConfig.columnMetadata, griddleConfig.columnMetadata) &&
      state.sourceData &&
      state.sourceData === props.data
    );
    if (sameDataAndMetadata) {
      // keep the same prepared results if source data and columns are the same
      // to prevent resetting current page to zero on every external update
      griddleConfig.results = state.griddleConfig.results;
    } else {
      griddleConfig.results = prepareTableData(props.data, griddleConfig.columnMetadata);
    }

    if (prefetchLabels) {
      const newTargets = findReferencedResources(griddleConfig, state.buffer.targets);
      state.buffer.load(newTargets);
    }

    const metadataChanged = state.griddleConfig && !sameColumnMetadata(
      state.griddleConfig.columnMetadata, griddleConfig.columnMetadata
    );
    return {
      version: metadataChanged ? (state.version + 1) : state.version,
      buffer: state.buffer,
      sourceData: props.data,
      griddleConfig,
    };
  }

  private buildConfig(config: TableProps, renderingState: RenderingState): ExtendedGriddleConfig {
    const {currentPage, onPageChange} = config;
    const paginationProps: CustomPaginationProps = {
      // Griddle uses page indexing from 0:
      // https://griddlegriddle.github.io/v0-docs/customization.html#custom-paging-component
      externalCurrentPage: currentPage - 1,
      onPageChange: onPageChange ? page => onPageChange(page + 1) : undefined,
    };

    const baseConfig: Partial<GriddleConfig> = {
      resultsPerPage: config.numberOfDisplayedRows ?? DEFAULT_ROWS_PER_PAGE,
      showFilter: true,
      useGriddleStyles: false,
      tableClassName: 'table',
      sortAscendingComponent: createElement('span', {className: 'fa fa-sort-alpha-asc'}),
      sortDescendingComponent: createElement('span', {className: 'fa fa-sort-alpha-desc'}),
      useCustomPagerComponent: true,
      customPagerComponent: Pagination,
      customPagerComponentOptions: paginationProps,
      useCustomFilterer: true,
      customFilterer: makeCellFilterer(renderingState),
    };

    let griddleConfig = isArrayTableData(config.data)
      ? this.getGriddlePropsForFlatDataArray(baseConfig, config.data, config, renderingState)
      : this.getGriddlePropsForSparqlResult(baseConfig, config.data, config, renderingState);

    if (config.layout) {
      const {options, tupleTemplate} = config.layout;
      griddleConfig = {...griddleConfig, ...(options as ExtendedColumnMetadata)};
      if (typeof tupleTemplate === 'string') {
        griddleConfig = this.useCustomLayout(griddleConfig, tupleTemplate, renderingState);
      }
    }

    return griddleConfig;
  }

  public render() {
    return createElement('div',
      {
        className: 'metaphacts-table-widget-holder',
      },
      this.renderTableData()
    );
  }

  private renderTableData() {
    const {version, buffer, griddleConfig} = this.state;
    if (buffer.error) {
      return createElement(ErrorNotification, {errorMessage: buffer.error as any});
    } else if (buffer.loading || !griddleConfig) {
      return createElement(Spinner, {});
    } else {
      return createElement(Griddle, {key: version, ...griddleConfig});
    }
  }

  private getGriddlePropsForSparqlResult(
    baseConfig: GriddleConfig,
    data: SparqlClient.SparqlStarSelectResult,
    props: TableProps,
    renderingState: RenderingState
  ): ExtendedGriddleConfig {
    const columnsMetadata = this.buildColumnsMetadata(data.head.vars, props, renderingState);
    return {
      ...baseConfig,
      results: [],
      // workaround for https://github.com/GriddleGriddle/Griddle/issues/114
      columns: _(columnsMetadata).filter('visible').map('columnName').value(),
      columnMetadata: columnsMetadata,
    };
  }

  private getGriddlePropsForFlatDataArray(
    baseConfig: GriddleConfig,
    data: readonly any[],
    props: TableProps,
    renderingState: RenderingState
  ): ExtendedGriddleConfig {
    const heads = _.reduce(data, (union, obj) => _.union(union, Object.keys(obj)), []);
    const columnsMetadata = this.buildColumnsMetadata(heads, props, renderingState);
    return {
      ...baseConfig,
      results: [],
      // workaround for https://github.com/GriddleGriddle/Griddle/issues/114
      columns: _(columnsMetadata).filter('visible').map('columnName').value(),
      columnMetadata: columnsMetadata,
    };
  }

  private useCustomLayout(
    baseConfig: ExtendedGriddleConfig,
    tupleTemplate: string | undefined,
    renderingState: RenderingState
  ): ExtendedGriddleConfig {
    interface CustomRowProps {
      data: SparqlClient.Binding;
      metadataColumns: any[];
    }
    const customRowComponent = class extends Component<CustomRowProps, {}> {
      render() {
        return createElement(TemplateItem, {
          template: {
            source: tupleTemplate !== undefined ? tupleTemplate : 'No Template defined',
            options: this.props.data,
          },
        });
      }
    };
    return {
      ...baseConfig,
      useCustomRowComponent: true,
      customRowComponentClassName: 'griddle-custom-row',
      customRowComponent,
    };
  }



  private buildColumnsMetadata(
    vars: string[], config: TableProps, renderingState: RenderingState
  ): ExtendedColumnMetadata[] {
    // we show all columns from bindings only when we don't specify any column
    //  configuration in the config
    if (_.isEmpty(config.columnConfiguration)) {
      return this.defaultColumnsMetadata(vars, config, renderingState);
    } else {
      return this.customColumnsMetadata(config, renderingState);
    }
  }

  private defaultColumnsMetadata(
    vars: string[], config: TableProps, renderingState: RenderingState
  ): ExtendedColumnMetadata[] {
    return vars.map((varName: string, index: number): ExtendedColumnMetadata => {
      return {
        displayName: varName,
        columnName: varName,
        variableName: varName,
        visible: true,
        order: index,
        customComponent: this.makeCellTemplateComponent(undefined, renderingState),
        customCompareFn: makeNullableLastComparator(makeCellComparator(renderingState)),
      };
    });
  }

  private customColumnsMetadata(
    config: TableProps, renderingState: RenderingState
  ): ExtendedColumnMetadata[] {
    const ensureUniqueColumnName = makeUniqueColumnNameGenerator();
    return _.map(config.columnConfiguration, (columnConfig, i): ExtendedColumnMetadata => {
      const columnName = columnConfig.variableName === undefined
        ? 'mp-custom-column' : columnConfig.variableName;

      return {
        // generate unique column name if a column with same name already exists,
        // otherwise Griddle won't render this column
        columnName: ensureUniqueColumnName(columnName),
        displayName: columnConfig.displayName,
        variableName: columnConfig.variableName,
        customComponent: this.makeCellComponentClass(columnConfig, renderingState),
        visible: true,
        order: i,
        customCompareFn: makeNullableLastComparator(makeCellComparator(renderingState)),
      };
    });
  }

  private makeCellComponentClass(
    columnConfig: TableColumnConfiguration,
    renderingState: RenderingState
  ) {
    if (columnConfig.cellComponent) {
      return columnConfig.cellComponent;
    } else {
      return this.makeCellTemplateComponent(
        columnConfig.cellTemplate !== undefined ? columnConfig.cellTemplate : undefined,
        renderingState
      );
    }
  }

  private makeCellTemplateComponent(
    template: string | undefined,
    renderingState: RenderingState
  ): ComponentClass<any> {
    const {showLiteralDatatype, linkParams, showCopyToClipboardButton} = this.props;
    const templateSource = _.isString(template) ? String(template) : undefined;
    return class extends Component<CellRendererProps, {}> {
      render(): ReactElement<any> {
        if (_.isUndefined(templateSource) === false) {
          return createElement(TemplateItem, {
            template: {
              source: templateSource,
              options: this.props.rowData,
            },
          });
        } else if (isPrimitiveDatatype(this.props.data)) {
          return createElement('span', {}, this.props.data);
        } else {
          const {showLabels, preferchLabels} = renderingState;
          return createElement(RdfValueDisplay, {
            data: this.props.data,
            getLabel: renderingState.getLabel,
            fetchLabel: showLabels && !preferchLabels,
            fetchContext: this.context.semanticContext,
            showLiteralDatatype,
            linkParams,
            showCopyToClipboardButton,
          });
        }
      }
    };
  }
}

/**
 * Creates table row filterer based on whether any own object property
 * of a row data item includes query as a substring ignoring case.
 */
function makeCellFilterer(state: { getLabel(resource: Rdf.Iri): string }) {
  return <T = unknown>(items: ReadonlyArray<T>, query: string): T[] => {
    const textQuery = prepareCellMatchQuery(query);
    return items.filter(item => doesCellMatchText(item, textQuery, state));
  };
}

/**
 * **This function is exported for tests only**
 */
export const _makeCellFilterer = makeCellFilterer;


function makeNullableLastComparator(base: <T>(a: T, b: T) => number) {
  return (a: unknown, b: unknown) => {
    const aNull = a === null || a === undefined;
    const bNull = b === null || b === undefined;
    return (
      aNull && bNull ? 0 :
      aNull ? -1 :
      bNull ? 1 :
      base(a, b)
    );
  };
}

/**
 * **This function is exported for tests only**
 */
export const _makeCellComparator = makeCellComparator;


const NON_MUTATING_ARRAY_SORT = function <T>(
  this: Array<T>,
  comparator: (a: T, b: T) => number
): Array<T> {
  const clone = [...this];
  clone.sort(comparator);
  makeSortNonMutating(clone);
  return clone;
};

function makeSortNonMutating<T>(arr: Array<T>): void {
  const sort: Array<T>['sort'] = NON_MUTATING_ARRAY_SORT;
  Object.defineProperty(arr, 'sort', {
    enumerable: false,
    value: sort,
  });
}

function findReferencedResources(
  builtConfig: ExtendedGriddleConfig,
  alreadyFetching: Immutable.Set<Rdf.Iri>
) {
  return Immutable.Set<Rdf.Iri>().withMutations(set => {
    const visit = (t: Rdf.TermLike) => {
      if (Rdf.isIri(t)) {
        if (!alreadyFetching.has(t)) {
          set.add(t);
        }
      } else if (Rdf.isQuad(t)) {
        visit(t.subject);
        visit(t.predicate);
        visit(t.object);
        visit(t.graph);
      }
    };
    for (const item of builtConfig.results) {
      for (const column of builtConfig.columnMetadata) {
        if (!column.variableName) { continue; }
        const columnValue = item[column.variableName];
        if (Rdf.looksLikeTerm(columnValue)) {
          visit(columnValue);
        }
      }
    }
  });
}


function prepareTableData(
  data: TableData,
  columns: ReadonlyArray<ExtendedColumnMetadata>
) {
  // push empty literals if binding variable does not exist in binding
  // entry i.e. missing values due to optional
  const results = isArrayTableData(data)
    ? prepareFlatData(data, columns)
    : prepareSparqlResultData(data, columns);
  // Fix erronous array mutation in Griddle v0.8.2 whn providing customCompareFn with 2 arguments:
  // https://github.com/GriddleGriddle/Griddle/blob/v0.8.2/scripts/griddle.jsx#L578
  makeSortNonMutating(results as Array<unknown>);
  return results;
}

function prepareFlatData(
  data: ReadonlyArray<any>,
  columns: ReadonlyArray<ExtendedColumnMetadata>
): ReadonlyArray<unknown> {
  const additionalColumns = getAdditionalColumns(columns);
  return data.map(item => {
    for (const column of additionalColumns) {
      defineAdditionalColumnProperty(column, item, '');
    }
    return item;
  });
}

function prepareSparqlResultData(
  data: SparqlClient.SparqlStarSelectResult,
  columns: ReadonlyArray<ExtendedColumnMetadata>
): ReadonlyArray<unknown> {
  const additionalColumns = getAdditionalColumns(columns);
  return data.results.bindings.map(binding => {
    for (const column of additionalColumns) {
      defineAdditionalColumnProperty(column, binding, undefined);
    }
    return binding;
  });
}

function getAdditionalColumns(columns: ReadonlyArray<ExtendedColumnMetadata>) {
  return columns.filter(c => c.columnName !== c.variableName);
}

function defineAdditionalColumnProperty(
  column: ExtendedColumnMetadata, item: any, emptyValue: any
) {
  if (column.columnName !== column.variableName) {
    if (column.variableName === undefined) {
      item[column.columnName] = emptyValue;
    } else {
      // define a property to return original value for column even
      // if columnName differs from variableName
      Object.defineProperty(item, column.columnName, {
        enumerable: true,
        get: () => item[column.variableName],
      });
    }
  }
}

export function isArrayTableData(data: TableData): data is ReadonlyArray<any> {
  return Array.isArray(data);
}

function sameColumnMetadata(
  left: readonly ColumnMetadata[],
  right: readonly ColumnMetadata[]
): boolean {
  if (left.length !== right.length) { return false; }
  for (let i = 0; i < left.length; i++) {
    const a = left[i];
    const b = right[i];
    if (!(
      a.columnName === b.columnName ||
      a.displayName === b.displayName ||
      a.visible === b.visible
    )) {
      return false;
    }
  }
  return true;
}

export default Table;
