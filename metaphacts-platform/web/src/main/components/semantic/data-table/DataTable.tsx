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
import * as React from 'react';
import * as _ from 'lodash';
import * as Immutable from 'immutable';
import {
  useTable,
  usePagination,
  TableInstance,
  TableState,
  Column,
  UsePaginationState,
  UsePaginationInstanceProps,
  useGlobalFilter,
  UseGlobalFiltersInstanceProps,
  UseGlobalFiltersState,
  Row,
  Renderer,
  CellProps,
  useSortBy,
  UseSortByColumnProps,
  HeaderGroup,
  useFilters,
  UseFiltersColumnProps,
  UseFiltersColumnOptions,
  useGroupBy,
  UseGroupByState,
  UseGroupByColumnProps,
  Cell,
  UseGroupByCellProps,
  UseExpandedRowProps,
  useExpanded,
  UseGroupByColumnOptions,
  UseExpandedInstanceProps,
  UseSortByColumnOptions,
  ColumnInstance,
  UseGlobalFiltersOptions,
  Hooks,
  TableOptions,
  SortingRule,
  UseSortByState,
} from 'react-table';

import { SparqlClient } from 'platform/api/sparql';
import { ComponentContext } from 'platform/api/components';

import {
  TableConfig as PreviousTableConfig, TableColumnConfiguration, isArrayTableData,
} from 'platform/components/semantic/table';
import { RdfValueDisplay } from 'platform/components/semantic/table/RdfValueDisplay';
import { Options as PreviousOptions } from 'platform/components/semantic/table/SemanticTable';

import { TemplateItem } from 'platform/components/ui/template';
import { Spinner } from 'platform/components/ui/spinner';
import { ErrorNotification } from 'platform/components/ui/notification';

import { Cancellation } from 'platform/api/async';
import {
  makeUniqueColumnNameGenerator,
  isPrimitiveDatatype,
  makeCellComparator,
  KeyedBufferPool,
} from '../table/tableutils';
import { Rdf } from 'platform/api/rdf';
import { getLabels } from 'platform/api/services/resource-label';
import {
  DefaultColumnFilter,
  GlobalFilter,
  makeFilterTypes,
  FILTER_TYPE_DEFAULT,
  applyColumnFilterOptions,
  renderFilterSidebar,
  renderInlineFilter,
  hasActiveFilterValue
} from './filters';
import { applyColumnAggregateOptions, rdfUniqueCount } from './aggregates';

import { OverlayTrigger, Button, Popover } from 'react-bootstrap';

import * as styles from './DataTable.scss';
import {
  TableAggregationExtension,
  TableFilterExtension,
} from './extensions';
import { useExtensionPoint } from 'platform/components/utils';

const GROUPING_ICON: string = require('./grouping-icon.svg');

const DEFAULT_ROWS_PER_PAGE = 10;

export interface DataTableProps extends PreviousTableConfig {
  options?: DataTableOptions;
  columnConfiguration?: Array<DataTableColumnConfiguration>;
}

/**
 * Contains a single key referring to the ID of the column to sort.
 * E.g. `{"subject": "asc"}`
 */
export interface SortDefinition {
  [key: string]: 'asc' | 'desc';
}

export interface DataTableOptions extends PreviousOptions {
  /**
   * Whether or not to enable interactive grouping of rows.
   *
   * @default false
   */
  enableGrouping?: boolean;

  groupingOptions?: GroupingOptions;

  // Can also be an array. As multi-sorting support is currently limited,
  // only document single configuration for now.
  /**
   * Default sorting to apply.
   */
  sorting?: SortDefinition;

  /**
   * Whether or not to use a styled table header pre-defined color scheme (true | false).
   * Can also specify the color to be used for the header, e.g. `gray` or `#DDDDDD`.
   *
   * @default false
   */
  styleHeader?: boolean | string;

  /**
   * Template applied to (non-aggregated) cells, unless there's a specific template
   * defined for the column.
   * In addition to all projection variables of the result tuple, the variable `cellValue`
   * contains the value of the respective column.
   */
  defaultCellTemplate?: string;

  /**
   * Whether or not to display column filters. Can also be configured in the individual
   * column configurations.
   *
   * @default false
   */
  showColumnFilters?: boolean
}

export interface GroupingOptions {
  /**
   * Groups rows by default by the provided column IDs.
   * The ID of a column is its `variableName` by default.
   * Can also be used if interactive grouping is disabled.
   */
  groupedBy?: string[];

  /**
   * Aggregation to use if no aggregation is specified for a column.
   */
  defaultAggregation?: ColumnAggregateConfigurationType;

  /**
   * Template for aggregated values to use, if no template is specified for a column.
   *
   * This is only applied if the `defaultAggregation` is used.
   * The aggregated value is available with the `value` variable.
   * Its type depends on the type of aggregation.
   *
   * The variable `rows` is an array containing the bindings of the aggregated rows.
   *
   * @default "aggregation specific default"
   *
   * @mpSeeResource {
   *   "name": "Client-side templating",
   *   "iri": "http://help.metaphacts.com/resource/FrontendTemplating"
   * }
   */
  defaultAggregationCellTemplate?: string;

  /**
   * Whether or not grouped rows configured with `groupedBy` should be expanded by default.
   *
   * @default false
   */
  expandByDefault?: boolean;

  /**
   * If this is enabled, only the aggregated values are shown for grouped rows.
   * Removes the ability for users to expand grouped rows.
   *
   * @default false
   */
  showOnlyAggregatedValue?: boolean;
}


// These are the predefined column filter and aggregate types. It can also be another value, in
// which case the filter is loaded as an extension (if available).
export type ColumnFilterConfigurationType =
  'default' | 'select' | 'multiselect' | 'number' | 'slider';
export type ColumnAggregateConfigurationType =
  'default' | 'count' | 'uniqueCount' | 'average' | 'median' | 'sum' | 'concat';

export interface ColumnConfigurationExtensions {
  /**
   * Whether column filtering should be enabled for this column.
   *
   * @default false
   */
  showFilter?: boolean;

  /**
   * Type of column filter to use.
   *
   * @default auto detection
   */
  filterType?: ColumnFilterConfigurationType;

  /**
   * Type of aggregation to use for this column.
   */
  aggregation?: ColumnAggregateConfigurationType;

  /**
   * Template for aggregated values.
   *
   * The aggregated value is available with the `value` variable.
   * Its type depends on the type of aggregation.
   *
   * The variable `rows` is an array containing the bindings of the aggregated rows.
   *
   * @mpSeeResource {
   *   "name": "Client-side templating",
   *   "iri": "http://help.metaphacts.com/resource/FrontendTemplating"
   * }
   */
  aggregationCellTemplate?: string;

  /**
   * Optional ID to reference this column from other options. If unset the ID is the variable name.
   */
  id?: string;
}

export interface DataTableColumnConfiguration extends
  TableColumnConfiguration, ColumnConfigurationExtensions { }

export const CompContext: React.Context<ComponentContext> = React.createContext(null);

type PagedTableInstance = TableInstance<object> & UsePaginationInstanceProps<object>;
type SortedHeaderGroup = HeaderGroup<object> & UseSortByColumnProps<object>;
type FilteredHeaderGroup = HeaderGroup<object> & UseFiltersColumnProps<object>;
type GroupedHeaderGroup = HeaderGroup<object> & UseGroupByColumnProps<object>;

/**
 * Additional custom properties for columns
 */
type ExtendedColumn = Column<object> & {
  /**
   * Index representing the original order of the columns
   */
  originalIndex: number;
};

interface ToolbarProps {
  enableColumnFilters: boolean;
  enableGlobalFilter: boolean;
  enableGrouping: boolean;
  styleHeader: boolean | string;
  globalFilterInstance: UseGlobalFiltersInstanceProps<object>;
  globalFilterState: UseGlobalFiltersState<object>;
  setSidebarShown: (sidebarShown: boolean) => void;
  headerGroups: HeaderGroup<object>[];
}

export function DataTable(props: DataTableProps) {
  const context = React.useContext(CompContext);

  const layout = props.layout ?? null;
  const showLabels = layout?.showLabels ?? true;
  const prefetchLabels = layout?.prefetchLabels ?? true;

  // Prefer opts directly on props, also support legacy from layout
  const propOpts = props.options ?? (layout?.options as DataTableOptions);
  const enableGlobalFilter = propOpts?.showFilter ?? true;
  const enableColumnFilters = (propOpts?.showColumnFilters || props?.columnConfiguration?.some(
    (col: DataTableColumnConfiguration) => col.showFilter));
  const enableSorting = propOpts?.enableSort ?? true;
  const enableInteractiveGrouping = propOpts?.enableGrouping ?? false;
  const groupingOptions = propOpts?.groupingOptions;
  const enableGrouping = enableInteractiveGrouping || (groupingOptions?.groupedBy != null);
  const enableExpansion = !(groupingOptions?.showOnlyAggregatedValue);
  const showTableHeading = propOpts?.showTableHeading ?? true;

  // The buffer has a 'loading' prop in itself. The state here is for propagating the state to
  // the component, so it updates once loaded
  const [bufferLoading, setBufferLoading] = React.useState(false);
  const [sidebarShown, setSidebarShown] = React.useState(false);

  const [error, setError] = React.useState(undefined);

  const aggregtionExtensionsLoaded = useExtensionPoint(TableAggregationExtension);
  const filterExtensionsLoaded = useExtensionPoint(TableFilterExtension);
  const haveExtensionsLoaded = aggregtionExtensionsLoaded && filterExtensionsLoaded;

  const cancellation = React.useMemo(() => new Cancellation(), []);
  React.useEffect(() => {
    return () => {
      cancellation.cancelAll();
    };
  }, []);

  const buffer = React.useMemo(() => {
    return new KeyedBufferPool(
      Immutable.Map<Rdf.Iri, string>(),
      cancellation,
      (keys: Immutable.Set<Rdf.Iri>) =>
        getLabels(keys.toArray(), { context: context.semanticContext }),
      () => setBufferLoading(false)
    );
  }, []);

  const renderingState: RenderingState = React.useMemo(() => ({
    context,
    setError,
    showLabels,
    prefetchLabels,
    enableGrouping,
    enableInteractiveGrouping,
    getLabel: resourceIri => {
      return (showLabels && prefetchLabels) ?
        buffer.result.get(resourceIri) : undefined;
    },
  }), [context, showLabels, prefetchLabels, enableGrouping, buffer.result.size]);

  const plugins: Array<(hooks: Hooks<object>) => void> = [];
  const options: Partial<TableOptions<object>> = {};
  const initialState: TableState<object> & Partial<UsePaginationState<object>> = {
    pageSize: props.numberOfDisplayedRows ?? DEFAULT_ROWS_PER_PAGE,
    pageIndex: props.currentPage != null ? props.currentPage - 1 : 0,
  };

  (options as UseGlobalFiltersOptions<object>).filterTypes = React.useMemo(() => {
    if (enableGlobalFilter || enableColumnFilters) {
      return makeFilterTypes(renderingState);
    } else {
      return undefined;
    }
  }, [renderingState, enableGlobalFilter, enableColumnFilters]);

  if (enableGlobalFilter) {
    plugins.push(useGlobalFilter);
    (options as UseGlobalFiltersOptions<object>).globalFilter = FILTER_TYPE_DEFAULT;
  }
  const defaultColumn = React.useMemo(() => {
    if (enableColumnFilters) {
      return {
        Filter: DefaultColumnFilter,
        filter: FILTER_TYPE_DEFAULT,
      } as Partial<Column<object>>;
    } else {
      return undefined;
    }
  }, [enableColumnFilters]);
  if (enableColumnFilters) {
    plugins.push(useFilters);
    renderingState.showColumnFilters = true;
    options.defaultColumn = defaultColumn;
  }

  if (enableGrouping) {
    plugins.push(useGroupBy);
    renderingState.enableGrouping = true;
    if (groupingOptions?.groupedBy) {
      (initialState as UseGroupByState<object>).groupBy = groupingOptions.groupedBy;
    }
  }

  const sortFunction = React.useMemo(() => {
    if (enableSorting) {
      return makeSortFunction(renderingState.getLabel);
    } else {
      return undefined;
    }
  }, [renderingState.getLabel]);
  if (enableSorting) {
    plugins.push(useSortBy);
    renderingState.sortFunction = sortFunction;
  }
  const sorting = React.useMemo(() => {
    if (enableSorting && propOpts?.sorting) {
      return sortOptionsToTableOptions(propOpts.sorting, renderingState);
    } else {
      return undefined;
    }
  }, [propOpts?.sorting]);
  if (sorting) {
    (initialState as UseSortByState<object>).sortBy = sorting;
  }

  if (enableGrouping && enableExpansion) {
    // useExpanded must be after useSortBy
    plugins.push(useExpanded);
  }

  plugins.push(usePagination);

  const result = props.data;
  const cols = React.useMemo(() => (
    !haveExtensionsLoaded ? [] :
      isArrayTableData(result)
        ? getColumnPropsForFlatDataArray(props, result, renderingState)
        : getColumnPropsForSparqlResult(props, result, renderingState)
  ), [result, haveExtensionsLoaded]);
  const data = React.useMemo(() => (
    isArrayTableData(result) ? result : result.results.bindings
  ), [result]);

  const instance = useTable({ columns: cols, data: data as any[], initialState, ...options },
    ...plugins) as PagedTableInstance;

  const { state } = instance;
  const paginationState = state as UsePaginationState<object>;

  handleOnPageChangeCallback(paginationState, props.onPageChange);
  React.useEffect(() => {
    // make sure pagination is not on invalid page, if index is set from outside
    if (props.currentPage !== undefined && paginationState.pageIndex > (instance.pageCount - 1)) {
      instance.gotoPage(instance.pageCount - 1);
    }
  }, [props.currentPage, instance.pageCount, paginationState.pageIndex]);

  // grouping / expanding
  const { toggleAllRowsExpanded } = instance as
    PagedTableInstance & UseExpandedInstanceProps<object>;
  React.useEffect(() => {
    if (enableExpansion && (groupingOptions?.expandByDefault ?? false)) {
      toggleAllRowsExpanded(true);
    }
  }, []);

  // prefetch labels after data has been loaded
  React.useEffect(() => {
    if (prefetchLabels) {
      const targets = findReferencedResources(instance, buffer.targets);
      if (targets.size > 0) {
        if (!bufferLoading) {
          setBufferLoading(true);
        }
        buffer.load(targets);
      }
    }
  }, [buffer, cols, data]);


  if (bufferLoading || !haveExtensionsLoaded) {
    return <Spinner></Spinner>;
  }
  if (buffer.error) {
    return <ErrorNotification errorMessage={buffer.error as any}></ErrorNotification>;
  }
  if (error) {
    return <ErrorNotification errorMessage={error}></ErrorNotification>;
  }

  return (
    <div className={styles.semanticDataTable}>
      {showToolbar(enableGlobalFilter, enableColumnFilters, enableInteractiveGrouping) ? <Toolbar
        enableGlobalFilter={enableGlobalFilter}
        enableColumnFilters={enableColumnFilters}
        enableGrouping={enableInteractiveGrouping}
        styleHeader={props.options?.styleHeader}
        globalFilterInstance={instance as
          PagedTableInstance & UseGlobalFiltersInstanceProps<object>}
        globalFilterState={state as UseGlobalFiltersState<object>}
        setSidebarShown={setSidebarShown}
        headerGroups={instance.headerGroups}
      ></Toolbar> : null}
      {typeof layout?.tupleTemplate === 'string' ?
        renderTupleTemplate(instance, layout.tupleTemplate) :
        renderTable(instance, {
          enableGrouping,
          enableExpansion,
          enableSorting,
          enableColumnFilters,
          showTableHeading
        })
      }
      {instance.pageCount > 1 ? pagination(instance, paginationState) : null}
      {enableColumnFilters && sidebarShown && renderFilterSidebar(instance, setSidebarShown)}
    </div>
  );
}

function sortOptionsToTableOptions(
  sortings: SortDefinition | SortDefinition[],
  renderingState: RenderingState
): Array<SortingRule<object>> {
  if (!Array.isArray(sortings)) {
    sortings = [sortings];
  }

  return sortings.map(sorting => {
    const sortKeys = Object.keys(sorting);
    if (sortKeys.length !== 1) {
      renderingState.setError(`Sorting option can only have one key. Incorrect value: ${JSON.stringify(sorting)}`);
      return null;
    }
    const sortKey = sortKeys[0];
    return {
      id: sortKey,
      desc: sorting[sortKey] === 'desc'
    };
  }).filter(s => s);
}

function showToolbar(
  enableGlobalFilter: boolean,
  enableColumnFilters: boolean,
  enableGrouping: boolean
): boolean {
  return enableGlobalFilter || enableColumnFilters || enableGrouping;
}

function Toolbar(props: ToolbarProps) {
  const { preGlobalFilteredRows, setGlobalFilter } = props.globalFilterInstance;
  const { globalFilter } = props.globalFilterState;

  const filter = props.enableGlobalFilter ? <GlobalFilter
    preGlobalFilteredRows={preGlobalFilteredRows}
    globalFilter={globalFilter}
    setGlobalFilter={setGlobalFilter}
  /> : null;

  const styleClass = props.styleHeader ? styles.headerContainerBackground : '';
  const style = typeof props.styleHeader === 'string' ? {
    backgroundColor: props.styleHeader
  } : null;
  return <div data-flex-layout='row'
    className={`table-header-container ${styles.headerContainer} ${styleClass}`}
    style={style}>
    {filter}
    {props.enableColumnFilters ?
      <Button variant='secondary' onClick={() => props.setSidebarShown(true)}>
        <i className={'fa fa-filter ' + styles.buttonIconLeft}></i>
      Filter columns
      </Button> : null}
    {props.enableGrouping ?
      renderGroupColumnsPopover(props.headerGroups) : null}
  </div>;
}

function renderGroupColumnsPopover(headerGroups: HeaderGroup<object>[]) {
  return <OverlayTrigger
    trigger='click' rootClose placement='bottom' containerPadding={0}
    overlay={
      <Popover className={styles.popover} id='tablegrouppopover'>
        <div className={styles.popoverContent}>
          {headerGroups.map(headerGroup => {
            return columnsInOriginalOrder(headerGroup.headers).map(column => {
              const groupColumn = column as GroupedHeaderGroup;
              if (groupColumn.canGroupBy) {
                return renderColumnGroupingToggleOption(groupColumn);
              } else {
                return null;
              }
            });
          })}
        </div>
        <div className={styles.popoverFooter}>
          <Button variant='link'
            disabled={!hasGroupedColumn(headerGroups)}
            onClick={() => clearColumnGrouping(headerGroups)}>
            Clear grouping
            </Button>
        </div>
      </Popover>}>
    <Button variant='secondary'>
      Group columns
      <i className={'fa fa-caret-down ' + styles.buttonIconRight}></i>
    </Button>
  </OverlayTrigger>;
}

function columnsInOriginalOrder(columns: Column[]): Column[] {
  const sortedColumns = [...columns];
  sortedColumns.sort((c1, c2) =>
    (c1 as ExtendedColumn).originalIndex - (c2 as ExtendedColumn).originalIndex);
  return sortedColumns;
}

function renderColumnGroupingToggleOption(column: GroupedHeaderGroup) {
  return <div key={column.id} className={styles.groupingOption}>
    <label>
      <input type='checkbox'
        checked={column.isGrouped}
        onChange={() => column.toggleGroupBy()}></input>
      {column.render('Header')}
    </label>
    <div className={styles.groupingOptionSpacer}></div>
    {column.groupedIndex >= 0 ? <div className={styles.groupingOptionIndex}>
      {column.groupedIndex + 1}
    </div> : null}
  </div>;
}

function hasGroupedColumn(headerGroups: HeaderGroup<object>[]): boolean {
  return headerGroups.some(headerGroup => {
    return headerGroup.headers.some(column => {
      return (column as GroupedHeaderGroup).isGrouped;
    });
  });
}

function clearColumnGrouping(headerGroups: HeaderGroup<object>[]) {
  headerGroups.forEach(headerGroup => {
    headerGroup.headers.forEach(column => {
      const groupColumn = column as GroupedHeaderGroup;
      if (groupColumn.isGrouped) {
        groupColumn.toggleGroupBy();
      }
    });
  });
}

function renderTable(instance: PagedTableInstance, {
  enableGrouping,
  enableExpansion,
  enableSorting,
  enableColumnFilters,
  showTableHeading,
}: {
  enableGrouping: boolean,
  enableExpansion: boolean,
  enableSorting: boolean,
  enableColumnFilters: boolean,
  showTableHeading: boolean,
}) {
  const {
    getTableProps,
    headerGroups,
    getTableBodyProps,
    prepareRow,
    page,
    state,
  } = instance;
  return <table {...getTableProps()} className={'table ' + styles.table}>
    {showTableHeading ? <thead>
      {headerGroups.map(headerGroup => (
        <tr {...headerGroup.getHeaderGroupProps()}>
          {headerGroup.headers.map((column, i) =>
            <th {...column.getHeaderProps()}>
              <div className={styles.headerCell}>
                {enableExpansion && i === 0 && hasGroupedColumn(headerGroups) ?
                  renderExpandChevron(
                    // function is documented but missing from types
                    (instance as any).getToggleAllRowsExpandedProps(),
                    (instance as unknown as UseExpandedInstanceProps<object>).isAllRowsExpanded
                  )
                  : null}
                <span {...Object.assign({}, enableSorting ?
                  (column as SortedHeaderGroup).getSortByToggleProps() : {})}>
                  {column.render('Header')}</span>
                {enableSorting ? headerSorting(column as SortedHeaderGroup) : null}
                <div className={styles.headerCellSpacer}></div>
                {enableGrouping && (column as GroupedHeaderGroup).isGrouped ? <>
                  {/* If the column can be grouped, let's add a toggle*/}
                  <span {...(column as GroupedHeaderGroup).getGroupByToggleProps()}
                    className={`${styles.columnIndicatorTrigger} ${styles.columnIndicatorActive}`}>
                    <img src={GROUPING_ICON} />
                  </span>
                  {' '}
                </> : null}
                {enableColumnFilters && (column as FilteredHeaderGroup).canFilter ?
                  renderFilterPopover(column as FilteredHeaderGroup) : null}
              </div>
          </th>)}
        </tr>
      ))}
    </thead> : null}
    <tbody {...getTableBodyProps()}>
      {page.map((row, i) => {
        prepareRow(row);
        return (
          <tr {...row.getRowProps()}>
            {row.cells.map(cell => {
              return (
                <td
                  {...cell.getCellProps()}
                >
                  {cellContent(cell, enableGrouping, enableExpansion)}
                </td>
              );
            })}
          </tr>
        );
      })}
    </tbody>
  </table>;
}

function renderFilterPopover(column: FilteredHeaderGroup) {
  return <OverlayTrigger
    trigger='click' rootClose placement='bottom' containerPadding={0}
    overlay={
      <Popover className={styles.popover} id='tablefilterpopover'>
        <div>
          <div className={styles.popoverContent}>
            {renderInlineFilter(column)}
          </div>
          <div className={styles.popoverFooter}>
            <Button variant='link'
              disabled={column.filterValue == null}
              onClick={() => column.setFilter(undefined)}>
              Clear filter
            </Button>
          </div>
        </div>
      </Popover>}>
    <span className={`btn ${styles.columnIndicatorTrigger}
                  ${hasActiveFilterValue(column) ? styles.columnIndicatorActive : ''}`}>
      <i className={`fa fa-filter ${styles.columnIndicatorText}`}></i>
    </span>
  </OverlayTrigger>;
}

function renderTupleTemplate({ page, prepareRow }: PagedTableInstance, tupleTemplate: string) {
  const createTpl = (row: Row<object>) => <TemplateItem
    key={row.id}
    template={{
      source: tupleTemplate,
      options: getTemplateParamsForRow(row)
    }}
  ></TemplateItem>;

  return <div className={`table-custom-row ${styles.tableGridLayout}`}>
    {page.map((row, i) => {
      prepareRow(row);
      return (
        createTpl(row)
      );
    })}
  </div>;
}

function getTemplateParamsForRow(row: Row<object>) {
  // If available use original values, otherwise use column values
  // (e.g.for aggregated rows, which don't have original data)
  return row.original != null ? row.original : row.values;
}

function getColumnPropsForFlatDataArray(props: DataTableProps,
  res: readonly any[], renderingState: RenderingState) {

  const heads = _.reduce(res, (union, obj) => _.union(union, Object.keys(obj)), []);
  return buildColumnsMetadata(res, heads, props, renderingState);
}

function getColumnPropsForSparqlResult(
  props: DataTableProps,
  res: SparqlClient.SparqlStarSelectResult,
  renderingState: RenderingState
) {
  return buildColumnsMetadata(res.results.bindings, res.head.vars, props, renderingState);
}


function findReferencedResources(
  tableInstance: TableInstance<object>,
  alreadyFetching: Immutable.Set<Rdf.Iri>
) {
  // Filter out column without data reference
  const dataColumns = tableInstance.columns.filter(column => {
    return column.isVisible && ((column as Column<object>).accessor);
  });

  return Immutable.Set<Rdf.Iri>().withMutations(set => {
    findReferencedResourcesOfRows(set, alreadyFetching,
      tableInstance.rows, dataColumns);
  });
}

function findReferencedResourcesOfRows(set: Immutable.Set<Rdf.Iri>,
  alreadyFetching: Immutable.Set<Rdf.Iri>,
  rows: Row<object>[],
  columns: ColumnInstance<object>[]) {
  for (const item of rows) {
    for (const column of columns) {
      const columnValue = item.values[column.id];
      if (Rdf.looksLikeTerm(columnValue)
        && Rdf.isIri(columnValue)
        && !alreadyFetching.has(columnValue)
      ) {
        set.add(columnValue);
      }
    }

    // Also find values in sub rows
    if (item.subRows && item.subRows.length > 0) {
      findReferencedResourcesOfRows(set, alreadyFetching, item.subRows, columns);
    }
  }
}

function headerSorting(column: SortedHeaderGroup) {
  return <span className={column.isSorted
    ? column.isSortedDesc
      ? 'fa fa-long-arrow-up'
      : 'fa fa-long-arrow-down'
    : ''}>
  </span>;
}

function handleOnPageChangeCallback(
  { pageIndex }: UsePaginationState<object>,
  callback: (page: number) => void
) {

  const previousPageIndex = React.useRef<number>();
  React.useEffect(() => {
    previousPageIndex.current = pageIndex;
  });

  if (callback && previousPageIndex.current != null && previousPageIndex.current !== pageIndex) {
    callback(pageIndex + 1);
  }
}

function pagination({
  pageCount, canPreviousPage, previousPage, canNextPage, nextPage, gotoPage
}: PagedTableInstance,
  { pageIndex }: UsePaginationState<object>
) {
  return <ul className='pagination'>
    <li className={'page-item ' + (canPreviousPage ? '' : 'disabled')}>
      <a className='page-link' onClick={previousPage}>{'«'}</a>
    </li>

    {/* page number selectors around current page */}
    {Array.from({ length: Math.min(pageCount, 5) }, (obj, i) => {
      const dspIdx = Math.max(pageIndex - 2, 0) + i;
      return dspIdx < pageCount ?
        <li key={dspIdx} className={'page-item ' +  (dspIdx === pageIndex ? 'active' : '')}>
          <a className='page-link' onClick={() => gotoPage(dspIdx)}>{dspIdx + 1}</a>
        </li> : null;
    })}

    <li className={'page-item ' + (canNextPage ? '' : 'disabled')}>
      <a className='page-link' onClick={nextPage}>{'»'}</a>
    </li>
  </ul>;
}

function cellContent(
  cell: Cell<object, any>,
  enableGrouping: boolean,
  enableExpansion: boolean
) {
  if (!enableGrouping) {
    return cell.render('Cell');
  }

  const groupedCell = cell as Cell<object, any> & UseGroupByCellProps<object>;
  // const row = groupedCell.row as Row<object> & UseGroupByRowProps<object>;
  const row = groupedCell.row as Row<object> & UseExpandedRowProps<object>;
  return (groupedCell.isGrouped && enableExpansion) ? (
    // If it's a grouped cell, add an expander and row count
    <div className={styles.groupingCell}>
      {renderExpandChevron(row.getToggleRowExpandedProps(), row.isExpanded)}
      <div>
        {groupedCell.render('Cell')} ({row.subRows.length})
      </div>
    </div>
  ) : groupedCell.isAggregated ? (
    // If the cell is aggregated, use the Aggregated
    // renderer for cell
    groupedCell.render('Aggregated')
  ) : groupedCell.isPlaceholder ? null : ( // For cells with repeated values, render null
    // Otherwise, just render the regular cell
    groupedCell.render('Cell')
  );
}

function renderExpandChevron(props: object, isExpanded: boolean) {
  return <span className={styles.groupingChevron} {...props}>
    <i className={'fa fa-chevron-' + (isExpanded ? 'down' : 'right')}></i>
  </span>;
}

function buildColumnsMetadata(data: readonly any[], vars: string[], config: DataTableProps,
  renderingState: RenderingState
): Column[] {
  // we show all columns from bindings only when we don't specify any column
  //  configuration in the config
  if (_.isEmpty(config.columnConfiguration)) {
    return defaultColumnsMetadata(vars, config, renderingState);
  } else {
    return customColumnsMetadata(data, config, renderingState);
  }
}

function defaultColumnsMetadata(vars: string[], config: DataTableProps,
  renderingState: RenderingState
): Column[] & UseSortByColumnOptions<object>[] {
  return vars.map((varName: string, index: number): Column & UseSortByColumnOptions<object> => {
    const col = {
      Header: varName,
      id: varName,
      accessor: varName,
      originalIndex: index,
      Cell: makeCellTemplateComponent(config, undefined, renderingState),
      ...commonColumnMetadata(renderingState, config.options?.groupingOptions),
    };

    return col;
  });
}

function customColumnsMetadata(
  data: readonly any[],
  config: DataTableProps,
  renderingState: RenderingState
): Column[] & UseSortByColumnOptions<object>[] {
  const ensureUniqueColumnName = makeUniqueColumnNameGenerator();
  return _.map(config.columnConfiguration, (columnConfig, i):
    Column & UseSortByColumnOptions<object> => {

    const columnName = columnConfig.variableName === undefined
      ? 'mp-custom-column' : columnConfig.variableName;

    const col = {
      // generate unique column name if a column with same name already exists,
      // otherwise Griddle won't render this column
      Header: columnConfig.displayName ?? columnConfig.variableName,
      id: columnConfig.id ?? ensureUniqueColumnName(columnName),
      accessor: columnConfig.variableName,
      originalIndex: i,
      Cell: makeCellComponentClass(config, columnConfig, renderingState),
      ...commonColumnMetadata(renderingState, config.options?.groupingOptions, columnConfig),
    };
    if (renderingState.showColumnFilters) {
      const colOptions = col as UseFiltersColumnOptions<object>;
      if (!(columnConfig.showFilter ?? config.options?.showColumnFilters)) {
        colOptions.disableFilters = true;
      }
      const colData = data.map(obj => obj[columnConfig.variableName]);
      const filterType = columnConfig.filterType ?? determineColumnFilterType(colData);
      applyColumnFilterOptions(colOptions, filterType, renderingState);
    }

    return col;
  });
}

function determineColumnFilterType(columnData: any[]): ColumnFilterConfigurationType {
  if (columnData.length === 0) {
    return null;
  }

  const sample = columnData[0];
  if (typeof sample === 'number' ||
    (sample != null && Rdf.isLiteral(sample) && !Number.isNaN(parseFloat(sample.value)))) {
    return 'number';
  }

  const uniqueValues = rdfUniqueCount(columnData);
  if (uniqueValues === 2) {
    return 'select';
  } else if (uniqueValues <= 0.45 * columnData.length) {
    return 'multiselect';
  }

  return null;
}

function commonColumnMetadata(
  renderingState: RenderingState,
  groupingOptions: GroupingOptions,
  columnConfig?: DataTableColumnConfiguration
) {
  const col = {
    sortType: renderingState.sortFunction,
  };

  if (renderingState.enableGrouping) {
    const aggrOptions = (col as UseGroupByColumnOptions<object>);
    if (!renderingState.enableInteractiveGrouping) {
      aggrOptions.disableGroupBy = true;
    }
    applyColumnAggregateOptions(aggrOptions, columnConfig, groupingOptions, renderingState);
  }

  return col;
}

function makeSortFunction(getLabel: (resource: Rdf.Iri) => string) {
  const comparator = makeCellComparator({ getLabel });
  return (rowA: Row<object>, rowB: Row<object>,
    columnId: string) => {
    const objA = rowA.values[columnId];
    const objB = rowB.values[columnId];
    return comparator(objA, objB);
  };
}

export type RenderingState = {
  context: ComponentContext;
  setError: (error: any) => void;
  getLabel: (resource: Rdf.Iri) => string;
  showLabels: boolean;
  prefetchLabels: boolean;
  showColumnFilters?: boolean;
  enableGrouping?: boolean;
  enableInteractiveGrouping?: boolean;
  sortFunction?: (rowA: Row<object>, rowB: Row<object>,
    columnId: string, desc?: boolean) => number;
};

function makeCellComponentClass(props: DataTableProps,
  columnConfig: TableColumnConfiguration,
  renderingState: RenderingState
) {
  if (columnConfig.cellComponent) {
    return columnConfig.cellComponent;
  } else {
    return makeCellTemplateComponent(props,
      columnConfig.cellTemplate !== undefined ? columnConfig.cellTemplate : undefined,
      renderingState
    );
  }
}

function makeCellTemplateComponent(
  props: DataTableProps,
  template: string | undefined,
  renderingState: RenderingState
): Renderer<CellProps<object>> {
  const { showLiteralDatatype, linkParams, showCopyToClipboardButton } = props;
  const templateString = template ?? props.options?.defaultCellTemplate;
  const templateSource = _.isString(templateString) ? String(templateString) : undefined;
  return (cell: CellProps<object>) => {
    if (_.isUndefined(templateSource) === false) {
      return <TemplateItem template={{
        source: templateSource,
        options: {
          ...getTemplateParamsForRow(cell.row),
          cellValue: cell.value,
        }
      }}></TemplateItem>;
    } else if (isPrimitiveDatatype(cell.value)) {
      return <span>{cell.value}</span>;
    } else {
      return showRdfValue(cell.value, renderingState,
        showLiteralDatatype, linkParams, showCopyToClipboardButton);
    }
  };
}

function showRdfValue(value: Rdf.Iri, renderingState: RenderingState,
  showLiteralDatatype: boolean, linkParams: {}, showCopyToClipboardButton: boolean) {
  const { showLabels, prefetchLabels } = renderingState;
  return <RdfValueDisplay
    data={value}
    getLabel={renderingState.getLabel}
    fetchLabel={showLabels && !prefetchLabels}
    fetchContext={renderingState.context.semanticContext}
    showLiteralDatatype={showLiteralDatatype}
    linkParams={linkParams}
    showCopyToClipboardButton={showCopyToClipboardButton}
  ></RdfValueDisplay>;
}

export default DataTable;
