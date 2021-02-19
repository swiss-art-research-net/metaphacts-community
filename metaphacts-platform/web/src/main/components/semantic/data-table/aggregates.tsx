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
import { UseGroupByColumnOptions, Row, Renderer, CellProps } from 'react-table';
import { RenderingState, DataTableColumnConfiguration, GroupingOptions } from './DataTable';
import { Rdf } from 'platform/api/rdf';
import { xsd } from 'platform/api/rdf/vocabularies';
import { makeCellComparator, isPrimitiveDatatype } from '../table/tableutils';
import { RdfValueDisplay } from '../table/RdfValueDisplay';
import { TemplateItem } from 'platform/components/ui/template';
import { TableAggregationExtension } from './extensions';

export function applyColumnAggregateOptions(
  aggrOptions: UseGroupByColumnOptions<object>,
  columnConfig: DataTableColumnConfiguration,
  groupingOptions: GroupingOptions,
  renderingState: RenderingState
) {
  let aggregation = columnConfig?.aggregation;
  let aggregationTemplate = columnConfig?.aggregationCellTemplate;

  if (aggregation == null && groupingOptions?.defaultAggregation) {
    aggregation = groupingOptions.defaultAggregation;

    // If a column has the 'aggregation' set, but not template, the default template for
    // that aggregation is preferred over the defaultAggregationCellTemplate
    if (aggregationTemplate == null && groupingOptions?.defaultAggregationCellTemplate) {
      aggregationTemplate = groupingOptions.defaultAggregationCellTemplate;
    }
  }

  if (aggregation == null || aggregation === 'default') {
    aggrOptions.aggregate = rdfDefaultAggregation;
    aggrOptions.Aggregated = makeDefaultTemplate(renderingState);
  } else if (aggregation === 'uniqueCount') {
    aggrOptions.aggregate = rdfUniqueCount;
    aggrOptions.Aggregated = countTemplate;
  } else if (aggregation === 'count') {
    aggrOptions.aggregate = 'count';
    aggrOptions.Aggregated = countTemplate;
  } else if (aggregation === 'sum') {
    aggrOptions.aggregate = rdfSum; // 'sum';
  } else if (aggregation === 'average') {
    aggrOptions.aggregate = rdfAverage;
  } else if (aggregation === 'median') {
    aggrOptions.aggregate = makeRdfMedian(renderingState.getLabel);
  } else if (aggregation === 'concat') {
    aggrOptions.aggregate = rdfConcat;
    aggrOptions.Aggregated = makeConcatTemplate(renderingState);
  } else {
    const aggregationExtensions = TableAggregationExtension.get();
    let customAggregation = aggregationExtensions ? aggregationExtensions[aggregation] : null;

    if (customAggregation) {
      if (typeof customAggregation === 'function') {
        customAggregation = customAggregation(renderingState);
      }
      if (customAggregation?.aggregate) {
        aggrOptions.aggregate = customAggregation.aggregate;
      }
    }
  }

  if (aggregationTemplate) {
    aggrOptions.Aggregated = ({ value, row }) => {
      return <TemplateItem template={{
        source: aggregationTemplate,
        options: {
          value,
          // provide rows as getter, so value is only calculated when used
          get rows() {
            // leafRows is a documented property, currently missing from types.
            // As this is to provide access to raw data, leafRows is used instead of subRows.
            const subrows: Array<Row<object>> = (row as any).leafRows;
            return subrows.map(subRow => subRow.original);
          },
        }
      }}>
      </TemplateItem>;
    };
  }

  if (aggrOptions.Aggregated == null) {
    aggrOptions.Aggregated = makeValueTemplate(renderingState);
  }
}

function showRdfValue(value: Rdf.TermLike, renderingState: RenderingState) {
  const { showLabels, prefetchLabels } = renderingState;
  return <RdfValueDisplay
    data={value}
    getLabel={renderingState.getLabel}
    fetchLabel={showLabels && !prefetchLabels}
    fetchContext={renderingState.context.semanticContext}
    showLiteralDatatype={false}
    showCopyToClipboardButton={false}
  ></RdfValueDisplay>;
}

function makeValueTemplate(renderingState: RenderingState) {
  return ({ value }: { value: number }) => {
    if (value === undefined) {
      // table can handle null but not undefined
      return null;
    } else if (isPrimitiveDatatype(value)) {
      return value;
    } else if (Rdf.looksLikeTerm(value)) {
      return showRdfValue(value, renderingState);
    } else {
      return String(value);
    }
  }
}

function rdfDefaultAggregation(values: any[]): number | object[] {
  const uniqueValues = rdfUniqueValues(values);
  if (uniqueValues.length > 3) {
    return uniqueValues.length;
  } else {
    return uniqueValues;
  }
}

function makeDefaultTemplate(renderingState: RenderingState): Renderer<CellProps<object>> {
  const concatTemplate = makeConcatTemplate(renderingState);
  return ({ value }) => {
    if (typeof value === 'number') {
      return countTemplate({ value });
    } else if (Array.isArray(value)) {
      return concatTemplate({ value });
    } else {
      return null;
    }
  };
}

export function rdfUniqueCount(values: any[]) {
  const uniqueValues = new Set();
  values.forEach(value => {
    uniqueValues.add(getRdfValueOrString(value));
  });
  return uniqueValues.size;
}

function countTemplate({ value }: { value: number }) {
  return `${value} value${value !== 1 ? 's' : ''}`;
}

function rdfUniqueValues(values: object[]) {
  const opts = {} as any;
  values.forEach(value => {
    if (value != null) {
      opts[getRdfValueOrString(value)] = value;
    }
  });
  // Object.values not available in used es2015
  return Object.keys(opts).map(key => opts[key]);
}

function getNumberValues(values: any[]): number[] {
  const numbers: number[] = [];
  values.forEach(value => {
    const rawValue = (Rdf.looksLikeTerm(value) && Rdf.isLiteral(value)) ? value.value : value;
    const parsed = parseFloat(rawValue);
    if (!Number.isNaN(parsed)) {
      numbers.push(parsed);
    }
  });
  return numbers;
}

function getNumberSum(numbers: number[]): number {
  return numbers.reduce((sum, value) => sum + value, 0);
}

function rdfSum(values: any[]) {
  const numbers = getNumberValues(values);
  return getNumberSum(numbers);
}

function rdfAverage(values: any[]) {
  const numbers = getNumberValues(values);
  if (numbers.length === 0) {
    return null;
  }
  return getNumberSum(numbers) / numbers.length;
}


function makeRdfMedian(getLabel: (iri: Rdf.Iri) => string) {
  const comparator = makeCellComparator({ getLabel });
  return (values: any[]) => {
    values = values.sort(comparator);
    return rdfMedian(values);
  };
}

function rdfMedian(sortedValues: any[]) {
  if (sortedValues.length === 0) {
    return null;
  } else if (sortedValues.length === 1) {
    return sortedValues[0];
  } else if (sortedValues.length % 2 !== 0) {
    return sortedValues[Math.floor(sortedValues.length / 2)];
  } else {
    const mid = sortedValues.length / 2;
    const midValue1 = sortedValues[mid - 1];
    const midValue2 = sortedValues[mid];
    // For numeric values, return the averge of the two middle values
    // For non-numeric values, just use the first
    const midNumbers = getNumberValues([midValue1, midValue2]);
    if (midNumbers.length === 2) {
      const median = (midNumbers[0] + midNumbers[1]) / 2;
      // To be consistent with other cases, return literal if input is literal
      return (Rdf.looksLikeTerm(midValue1)) ? Rdf.literal(String(median), xsd.double) : median;
    } else {
      return midValue1;
    }
  }
}

function rdfConcat(values: any[]) {
  return values;
}


function makeConcatTemplate(renderingState: RenderingState) {
  return ({ value }: { value: object[] }) => {
    const uniqueValues = rdfUniqueValues(value);
    return <div>
      {uniqueValues.map((v: any, i: number) => <span key={getKey(v)}>
        {showRdfValue(v, renderingState)}
        {i !== (uniqueValues.length - 1) ? ', ' : null}
      </span>)}
    </div>;
  };
}

function getKey(value: unknown) {
  let key = value;
  if (Rdf.looksLikeTerm(value)) {
    key = value.value;
  }
  return typeof key === 'string' ? key : String(key);
}

function getRdfValueOrString(value: unknown): string {
  if (Rdf.looksLikeTerm(value)) {
    return value.value;
  } else {
    return String(value);
  }
}
