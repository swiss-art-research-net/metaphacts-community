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
import * as _ from 'lodash';
import Select from 'react-select';
import { Range as Slider } from 'rc-slider';
import 'rc-slider/assets/index.css';
import {
  HeaderGroup,
  UseFiltersColumnProps,
  Row,
  UseFiltersColumnOptions,
  TableInstance,
  FilterValue
} from 'react-table';
import { Button } from 'react-bootstrap';
import { Rdf } from 'platform/api/rdf';
import { RenderingState, ColumnFilterConfigurationType } from './DataTable';
import { prepareCellMatchQuery, doesCellMatchText } from '../table/tableutils';

import * as styles from './DataTable.scss';
import { TableFilterExtension } from './extensions';

export const FILTER_TYPE_DEFAULT = 'rdfDefault';
export const FILTER_TYPE_MULTI = 'rdfMulti';
export const FILTER_TYPE_RANGE = 'rdfRange';


type FilteredHeaderGroup = HeaderGroup<object> & UseFiltersColumnProps<object>;

type FilterParameter = { column: FilteredHeaderGroup } & ExtendedColumnFilterProps;


/**
 * Extended column filter data. The properties `mpGetFilterValue` and `mpSetFilter` replace
 * the fields `filterValue` and `setFilter` of the column. Using those fields makes the
 * filters usable with deferred values, so the table is not immediatlely filtered on input.
 */
interface ExtendedColumnFilterProps {
  mpGetFilterValue: () => FilterValue,
  mpSetFilter: (filter: FilterValue) => void;
}

class DeferredValue {
  current: FilterValue;
  deferred: FilterValue;

  constructor(current: FilterValue, deferred: FilterValue) {
    this.current = current;
    this.deferred = deferred;
  }
}

export function GlobalFilter({
  preGlobalFilteredRows,
  globalFilter,
  setGlobalFilter,
}: {
  preGlobalFilteredRows: Row<object>[],
  globalFilter: any,
  setGlobalFilter: (filterValue: any) => void
}) {
  const [value, setValue] = React.useState(globalFilter);
  const onChange = _.debounce((newValue: string) => {
    setGlobalFilter(newValue || undefined);
  }, 200);
  React.useEffect(() => {
    return () => onChange.cancel();
  }, []);

  return <span className={styles.globalFilterContainer}>
    <input type='text'
      placeholder='Quick search'
      className={'form-control ' + styles.globalFilter}
      value={value || ''}
      onChange={e => {
        setValue(e.target.value);
        onChange(e.target.value);
      }}
    >
    </input>
    <i className={'fa fa-search ' + styles.globalFilterIcon}></i>
  </span>;
}

export function renderInlineFilter(column: FilteredHeaderGroup) {
  return column.render('Filter', {
    mpGetFilterValue: () => column.filterValue,
    mpSetFilter: column.setFilter
  });
}

function renderDeferredFilter(column: FilteredHeaderGroup) {
  return column.render('Filter', {
    mpGetFilterValue: () => {
      const value = (column as FilteredHeaderGroup).filterValue;
      if (isDeferredValue(value)) {
        return value.deferred;
      } else {
        return value;
      }
    },
    mpSetFilter: (newValue: FilterValue) => {
      const filterHeader = (column as FilteredHeaderGroup);
      let lastFilter = filterHeader.filterValue;
      if (lastFilter != null && isDeferredValue(lastFilter)) {
        lastFilter = lastFilter.current;
      }
      const filterValue = new DeferredValue(lastFilter, newValue);
      filterHeader.setFilter(filterValue);
    }
  });
}

export function renderFilterSidebar(
  tableInstance: TableInstance<object>,
  setSidebarShown: (show: boolean) => void
) {
  const { headerGroups } = tableInstance;

  return <div className={styles.filterSidebar}>
    <div className={styles.filterSidebarTitle} data-flex-layout='row center-justify'>
      <span>Filter columns</span>
      <button onClick={() => setSidebarShown(false)} className={styles.filterSidebarClose}>
        <i className='fa fa-times'></i>
      </button>
    </div>
    <div className={styles.filterSidebarContent}>
      {headerGroups.map((headerGroup, i) => headerGroup.headers.map((column, j) => {
        return (column as FilteredHeaderGroup).canFilter ?
          <div key={i + '-' + j} className={styles.filterSidebarFilter}>
            <div className={styles.filterSidebarFilterLabel}>{column.render('Header')}</div>
            <div>
              {renderDeferredFilter(column as FilteredHeaderGroup)}
            </div>
          </div> : null;
      }))}
    </div>

    <div data-flex-layout='row center-justify' className={styles.filterSidebarActions}>
      <Button bsStyle='primary'
        onClick={() => applyFiltersAndClose(tableInstance, setSidebarShown)}>
        Apply filters
      </Button>
      <Button bsStyle='link' onClick={() => resetAllAndClose(tableInstance, setSidebarShown)}>
        Clear all
      </Button>
    </div>
  </div>;
}

function isDeferredValue(filterValue: unknown): filterValue is DeferredValue {
  return filterValue instanceof DeferredValue;
}

export function hasActiveFilterValue({ filterValue }: FilteredHeaderGroup) {
  if (filterValue == null) {
    return false;
  }

  const isDeferred = isDeferredValue(filterValue);
  return !isDeferred || filterValue.current != null;
}

function applyFiltersAndClose(tableInstance: TableInstance<object>,
  setSidebarShown: (show: boolean) => void) {
  applyDeferredFilters(tableInstance);
  setSidebarShown(false);
}

function applyDeferredFilters({ headerGroups }: TableInstance<object>) {
  headerGroups.forEach(headerGroup => {
    headerGroup.headers.forEach(column => {
      const filterColumn = (column as FilteredHeaderGroup);
      if (isDeferredValue(filterColumn.filterValue)) {
        filterColumn.setFilter(filterColumn.filterValue.deferred);
      }
    });
  });
}

function resetAllAndClose(tableInstance: TableInstance<object>,
  setSidebarShown: (show: boolean) => void) {
  resetAllFilters(tableInstance);
  setSidebarShown(false);
}

export function resetAllFilters({ headerGroups }: TableInstance<object>) {
  headerGroups.forEach(headerGroup => {
    headerGroup.headers.forEach(column => {
      (column as FilteredHeaderGroup).setFilter(undefined);
    });
  });
}

export function DefaultColumnFilter({
  mpGetFilterValue,
  mpSetFilter: setFilter,
  column: { preFilteredRows },
}: FilterParameter) {
  const count = preFilteredRows.length;

  return (
    <input
      value={mpGetFilterValue() || ''}
      className='form-control'
      onChange={e => {
        setFilter(e.target.value || undefined); // Set undefined to remove the filter entirely
      }}
      placeholder={`Search ${count} records...`}
    />
  );
}

function makeSelectColumnFilter({ getLabel }: RenderingState) {

  return ({
    mpGetFilterValue,
    mpSetFilter: setFilter,
    column: { preFilteredRows, id },
  }: FilterParameter) => {

    const filterValue = mpGetFilterValue();
    const options = React.useMemo(() => uniqueColumnValues(preFilteredRows, id).map(value => ({
      label: renderOption(value, getLabel),
      value: value
    })),
      [id, preFilteredRows]);

    const presetValue = React.useMemo(() => filterValue ? {
      label: renderOption(filterValue, getLabel),
      value: filterValue
    } : null, [filterValue]);

    const updateValue = React.useCallback((value: any) => {
      setFilter(value?.value);
    }, []);

    return <Select
      options={options}
      value={presetValue}
      onChange={updateValue}
    ></Select>;
  };
}

function makeMultiSelectColumnFilter({ getLabel }: RenderingState) {
  return ({
    mpGetFilterValue,
    mpSetFilter: setFilter,
    column: { preFilteredRows, id },
  }: FilterParameter) => {

    const filterValue = mpGetFilterValue();
    const options = React.useMemo(() => {
      const optionValues = uniqueColumnValues(preFilteredRows, id);
      return optionValues.map((optionValue: any) => ({
        label: renderOption(optionValue, getLabel),
        value: optionValue
      })).sort((optA, optB) => ('' + optA.label).localeCompare('' + optB.label));
    }, [id, preFilteredRows]);

    const updateValue = React.useCallback((value: any) => {
      const newValue = (Array.isArray(value) && value.length === 0) ? null : value;
      setFilter(newValue);
    }, []);

    return <Select
      options={options}
      value={filterValue}
      multi
      onChange={updateValue}
    ></Select>;
  };
}

function makeRangeFilter() {
  return ({
    column: { preFilteredRows, id },
    mpGetFilterValue,
    mpSetFilter: setFilter
  }: FilterParameter) => {

    const filterValue = mpGetFilterValue();

    const updateBegin = (newValue: string) => {
      const parsedValue = parseFloat(newValue);
      setFilter([
        Number.isNaN(parsedValue) ? null : newValue,
        filterValue ? filterValue[1] : null,
      ]);
    };
    const updateEnd = (newValue: string) => {
      const parsedValue = parseFloat(newValue);
      setFilter([
        filterValue ? filterValue[0] : null,
        Number.isNaN(parsedValue) ? null : newValue,
      ]);
    };

    return <>
      <input type='text' className='form-control' style={{ width: '92px', display: 'inline' }}
        placeholder='Any'
        value={filterValue != null && filterValue[0] != null ? filterValue[0] : ''}
        onChange={(e) => updateBegin(e.target.value)}
      ></input>
      <span style={{ marginLeft: '8px', marginRight: '8px' }}>—</span>
      <input type='text' className='form-control' style={{ width: '92px', display: 'inline' }}
        placeholder='Any'
        value={filterValue != null && filterValue[1] != null ? filterValue[1] : ''}
        onChange={(e) => updateEnd(e.target.value)}
      ></input>
    </>;
  };

}

function makeSliderFilter() {
  return ({
    mpGetFilterValue,
    mpSetFilter: setFilter,
    column: { preFilteredRows, id },
  }: FilterParameter) => {

    const filterValue = mpGetFilterValue();
    const [min, max] = React.useMemo(() => {
      const numbers = preFilteredRows.map(row => row.values[id])
        .map(value => isLiteral(value) ? value.value : value)
        .map(value => parseInt(value))
        .filter(value => !Number.isNaN(value));
      return [Math.min(...numbers), Math.max(...numbers)];
    }, [preFilteredRows, id]);


    // shown values are updated live (slidingStart, slidingEnd), but
    // filter is only applied once the user let go off the handle.
    // As changing the filter can cause varying column width, applying
    // the filter live doesn't really work.
    const begin = filterValue ? filterValue[0] : min;
    const end = filterValue ? filterValue[1] : max;

    const slidingStart = filterValue ? filterValue[2] : begin;
    const slidingEnd = filterValue ? filterValue[3] : end;

    return <div data-flex-layout='row'>
      <span style={{ marginRight: '10px' }}>{slidingStart}</span>
      <Slider
        allowCross={false} min={min} max={max}
        defaultValue={[begin, end]}
        value={[slidingStart, slidingEnd]}
        onAfterChange={value => setFilter([...value, ...value])}
        onChange={value => setFilter([begin, end, ...value])}
      />
      <span style={{ marginLeft: '10px' }}>{slidingEnd}</span>
    </div>;
  };
}

function makeCustomFilter(tag: string) {
  return ({
    mpGetFilterValue,
    mpSetFilter: setFilter,
    column: { preFilteredRows },
  }: FilterParameter) => {
    const filterValue = mpGetFilterValue();
    return <CustomFilter tag={tag} filterValue={filterValue} setFilter={setFilter}>
    </CustomFilter>;
  };

}

function CustomFilter({ tag, filterValue, setFilter }: any) {
  const node = React.useMemo(() => {
    const element = document.createElement(tag);
    Object.defineProperty(element, 'filterValue', {
      get: () => filterValue,
      set: (newValue) => setFilter(newValue),
    });
    return element;
  }, [tag, filterValue, setFilter]);

  // Actual filter is added with ref, as when using React.createElement the
  // filterValue would only be set after the initial render.
  return <div ref={(nodeElement) => {
    if (nodeElement && nodeElement.children.length === 0) {
      nodeElement.appendChild(node);
    }
  }} />;
}

function uniqueColumnValues(preFilteredRows: Row<object>[], columnId: string) {
  const opts = {} as any;
  preFilteredRows.forEach(row => {
    const value = row.values[columnId];
    if (value != null) {
      opts[Rdf.looksLikeTerm(value) ? value.value : String(value)] = value;
    }
  });
  // Object.values not available in used es2015
  return Object.keys(opts).map(key => opts[key]);
}

const renderOption = (value: any, getLabel: (iri: Rdf.Iri) => string) => {
  if (Rdf.isIri(value)) {
    return getLabel(value);
  }
  if (isLiteral(value)) {
    return value.value;
  }
  return value?.toString();
};

export function applyColumnFilterOptions(colOptions: UseFiltersColumnOptions<object>,
  filterType: ColumnFilterConfigurationType,
  renderingState: RenderingState) {

  if (filterType === 'select') {
    colOptions.Filter = makeSelectColumnFilter(renderingState);
    colOptions.filter = FILTER_TYPE_DEFAULT;
  } else if (filterType === 'multiselect') {
    colOptions.Filter = makeMultiSelectColumnFilter(renderingState);
    colOptions.filter = FILTER_TYPE_MULTI;
  } else if (filterType === 'number') {
    colOptions.Filter = makeRangeFilter();
    colOptions.filter = FILTER_TYPE_RANGE;
  } else if (filterType === 'slider') {
    colOptions.Filter = makeSliderFilter();
    colOptions.filter = FILTER_TYPE_RANGE;
  } else {
    // trying to load custom
    const filterExtensions = TableFilterExtension.get();
    let customFilter = filterExtensions ? filterExtensions[filterType] : null;
    if (customFilter) {
      if (typeof customFilter === 'function') {
        customFilter = customFilter(renderingState);
      }
      if (customFilter?.component) {
        colOptions.Filter = makeCustomFilter(customFilter.component);
      }
      const customFilterType = typeof customFilter?.filter;
      // can either be a custom function or refer to an existing filter through its name
      if (customFilterType === 'function') {
        colOptions.filter = ignoringDeferredFilter(customFilter.filter);
      } else if (customFilterType === 'string') {
        colOptions.filter = customFilter.filter;
      }
    }
  }
}


export function makeFilterTypes(renderingState: RenderingState) {
  const filterFunction = makeFilterFunction(renderingState);

  return {
    [FILTER_TYPE_DEFAULT]: ignoringDeferredFilter(filterFunction),
    [FILTER_TYPE_MULTI]: ignoringDeferredFilter((rows, columns, filterValue?: { value: any }[]) => {
      return filterFunction(rows, columns, filterValue ?
        filterValue.map(val => val.value) : filterValue);
    }),
    [FILTER_TYPE_RANGE]: ignoringDeferredFilter((rows, columns, filterValue?: [number, number]) => {
      if (filterValue == null) {
        return rows;
      }
      let [begin, end] = filterValue;
      if (typeof begin === 'string') {
        begin = parseFloat(begin);
      }
      if (typeof end === 'string') {
        end = parseFloat(end);
      }
      return rows.filter(row => {
        const rowValues = columns.map(column => row.values[column]);
        return rowValues.some(rowValue => {
          if (rowValue == null) {
            return false;
          }
          let parsedValue = rowValue;
          if (isLiteral(rowValue)) {
            parsedValue = rowValue.value;
          }
          if (typeof parsedValue === 'string') {
            parsedValue = parseFloat(parsedValue);
          }
          return !Number.isNaN(parsedValue) &&
            (begin == null || parsedValue >= begin) &&
            (end == null || parsedValue <= end);
        });
      });
    }),
  };
}

function ignoringDeferredFilter(
  filterFunction: (rows: Row<object>[], columnIds: string[], filterValue: any) => Row<object>[]
) {
  return (rows: Row<object>[], columnIds: string[], filterValue: any) => {
    if (filterValue != null && isDeferredValue(filterValue)) {
      filterValue = filterValue.current;
    }
    return filterFunction(rows, columnIds, filterValue);
  };
}

function makeFilterFunction(renderingState: RenderingState):
  ((rows: Row<object>[], columnIds: string[], filterValue: any) => Row<object>[]) {

  return (rows, columnIds, filterValue) => {
    if (filterValue == null) {
      // don't filter on nullish value
      return rows;
    }

    // RDF filter values should be exact matches. Arrays are currently always RDF values
    if (Array.isArray(filterValue)) {
      return rows.filter(row => {
        const valuesToMatch = columnIds.map(columnId => row.values[columnId]);
        return valuesToMatch.some(valueToMatch =>
          filterValue.some(val => val.equals(valueToMatch)));
      });
    }
    if (Rdf.looksLikeTerm(filterValue)) {
      return rows.filter(row => {
        const valuesToMatch = columnIds.map(columnId => row.values[columnId]);
        return valuesToMatch.some(valueToMatch => filterValue.equals(valueToMatch));
      });
    }

    const textQuery = prepareCellMatchQuery(String(filterValue));
    return rows.filter(row => {
      const valuesToMatch = columnIds.map(columnId => row.values[columnId]);
      return doesCellMatchText(valuesToMatch, textQuery, renderingState);
    });
  };
}

function isLiteral(value: unknown): value is Rdf.Literal {
  return Rdf.looksLikeTerm(value) && Rdf.isLiteral(value);
}
