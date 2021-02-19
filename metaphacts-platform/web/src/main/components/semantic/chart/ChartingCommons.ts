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
import { Just, Nothing, of as maybeOf } from 'data.maybe';
import * as _ from 'lodash';

import { Rdf } from 'platform/api/rdf';
import { SparqlClient } from 'platform/api/sparql';

export interface DataSetMappings {
  /** Query variable to pivot on. */
  dataSetVariable?: string;
  /** Optional label of data set to display in legend. */
  dataSetName?: string;
  /**
   * Optional IRI of data set. If specified, a label for this IRI will be fetched and displayed in legend.
   * */
  dataSetIRI?: string;
  /**
   * Determines position of data point along main axis (usually x-axis or axis around chart's center).
   */
  x?: string;
  /**
   * Determine position along cross axis (y-axis or radial axis).
   */
  y?: string;
  /**
   * Third-dimension value for 3+ dimensional data.
   */
  z?: string;
  /** Same as x, but value is explicitly non-numerical. */
  category?: string;
  /** Same as y for two-dimensional data. */
  value?: string;
  /**
   * Default value if there's no data point. Can also be `null`.
   * @default 0
   */
  defaultValue?: number | null;
  /** Color of specific data point. */
  color?: string;
}

export type ChartProvider = 'chartjs' | 'highcharts';

export interface ProviderSpecificStyle {
  /** Charting library identifier. */
  provider: ChartProvider;

  /**
   * Options specific to the provider. These options will be merged with widget-generated options and specified style will override defaults.
   * See <a href="https://www.chartjs.org/docs/" target="_blank">ChartJS Docs</a> and <a href="https://www.highcharts.com/docs/" target="_blank">Highcharts Docs</a> for further information.
   */
  style: any;
}

export type ChartType = 'line' | 'bar' | 'radar' | 'pie' | 'donut' | 'bubble';

export interface ChartDimensions {
  /**
   * Chart width in pixels
   */
  width?: number;

  /**
   * Chart height in pixels
   */
  height?: number;
}

export interface SemanticChartConfig {
  /**
   * SPARQL select query where the resulting rows correspond to one (in case of `multi-data-set`) or multiple (in case of `data-sets`) data points.
   */
  query: string;

  /** Type of chart, specified as string */
  type: ChartType;

  /**
   * List of plotted data sets where each specified through mapping between data points properties and query variables. (Mutually exclusive with `multi-data-sets.`)
   */
  sets?: DataSetMappings[];

  /**
   * Data sets specified through pivoting on variable in query and mapping between data points properties and other query variables. (Mutually exclusive with `data-sets.`)
   */
  multiDataSet?: DataSetMappings;

  /** List of charting library-specific configurations. */
  styles?: ProviderSpecificStyle[];

  /**
   * Chart's dimensions. If any dimension is not set, the default value provided by the charting library is used instead. In most cases the component will occupy all available space, so you should limit dimensions on enclosing HTML container tag if omitting this parameter.
   */
  dimensions?: ChartDimensions;

  /**
   * Charting library provider.
   * <a target='_blank' href='http://www.chartjs.org/'>Chart.js</a> is used by default.
   */
  provider?: ChartProvider;

  /**
   * ID for issuing component events.
   */
  id?: string;

  /**
   * Disables chart tooltips.
   */
  disableTooltips?: boolean;

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
   * Template which is applied to render tooltip for chart points.
   *
   * The following properties are provided:
   * <mp-documentation type="ChartTooltipData"></mp-documentation>
   *
   * @mpSeeResource {
   *   "name": "Client-side templating",
   *   "iri": "http://help.metaphacts.com/resource/FrontendTemplating"
   * }
   */
  tooltipTemplate?: string;
}

export type DataPoint = { [bindingName: string]: Rdf.Node };

export interface DataSet {
  id?: string;
  iri?: Rdf.Iri;
  name?: string;
  mapping: DataSetMappings;
  points?: DataPoint[];
}

export interface BuiltData {
  sets: DataSet[];
  categories?: Rdf.Node[];
}

export function propertyValue(point: DataPoint, property: string): Data.Maybe<string> {
  return (point && point[property]) ? maybeOf(point[property].value) : Nothing<string>();
}

export function labeled(node: Rdf.Node, labels: _.Dictionary<string>): string {
  if (!node) { return ''; }
  if (Rdf.isIri(node)) {
    const label = labels[node.value];
    if (label) { return label; }
  }
  return node.value;
}

export function extractKey(set: DataSet, point: DataPoint): Rdf.Node {
  return point[set.mapping.category || set.mapping.x];
}

export function extractValue(set: DataSet, point: DataPoint): Rdf.Node {
  return point[set.mapping.value || set.mapping.y];
}

export function valueExists(set: DataSet, point: DataPoint): boolean {
  const value = extractValue(set, point);
  return !_.isUndefined(value) && !_.isNull(value);
}

export function isSetContainsPoint(set: DataSet, point: DataPoint) {
  return !set.id || point[set.mapping.dataSetVariable].value === set.id;
}

export interface ChartRendererProps {
  className?: string;
  builtData: BuiltData;
  labels: _.Dictionary<string>;
  config: SemanticChartConfig;
}

export interface ChartRenderer {
  new(props: ChartRendererProps): React.Component<ChartRendererProps, any>;
}

export function parseNumeric(value: string | undefined): Data.Maybe<number> {
  const num = parseFloat(value);
  return Number.isNaN(num) ? Nothing<number>() : Just(num);
}

export interface ChartTooltipData {
  /**
   * Non-numerical value for argument axis (usually x-axis) at selected data points,
   * e.g. labels of pie chart segement or bar chart column; may be empty.
   */
  category?: {
    /**
     * Category IRI (as plain string); may be empty.
     */
    iri?: string;
    /**
     * Category label.
     */
    label: string;
    /**
     * Style string for SVG shape to display category color; may be empty.
     * (Provided by ChartJs.)
     */
    markerStyle?: string;
    /**
     * CSS class for SVG shape to display category color; may be empty.
     * (Provided by Highcharts.)
     */
    markerClass?: string;
  };
  /**
   * Numerical values for value axes (usually y-axis, z-axis, etc) at selected data points.
   */
  points: ReadonlyArray<ChartTooltipPoint>;
}

export interface ChartTooltipPoint {
  /**
   * Bindings from SPARQL query for the data point.
   */
  bindings: DataPoint;
  /**
   * Data set IRI (as plain string) for the data point; may be empty.
   */
  iri?: string;
  /**
   * Data set label for the data point.
   */
  label: string;
  /**
   * Data point value representation: either a simple number or
   * tuple for charts with multiple numerical axes.
   */
  value: number | string;
  /**
   * Style string for SVG shape to display data set color; may be empty.
   * (Provided by ChartJs.)
   */
  markerStyle?: string;
  /**
   * CSS class for SVG shape to display data set color; may be empty.
   * (Provided by Highcharts.)
   */
  markerClass?: string;
}

export const TOOLTIP_ID = 'mp-semantic-chart-tooltip';
export const DEFAULT_TOOLTIP_MARKUP =
`<div>
  {{#*inline "@marker"}}
    {{#ifCond style "||" class}}
      <svg xmlns="http://www.w3.org/2000/svg"
        style="display: inline-block; margin-right: 10px;"
        width="10" height="10">
        <rect width="10" height="10"
          style="{{style}}"
          class="{{class}}" />
      </svg>
    {{/ifCond}}
  {{/inline}}
  {{#if category}}
    <div>
      {{> @marker style=category.markerStyle class=category.markerClass}}
      {{#if category.iri}}
        <semantic-link iri='{{category.iri}}'>
          {{category.label}}
        </semantic-link>
      {{else}}
        {{category.label}}
      {{/if}}
    </div>
  {{/if}}
  <ul class="list-unstyled">
    {{#each points}}
      <li>
        {{> @marker style=markerStyle class=markerClass}}
        {{#if iri}}
          <semantic-link iri="{{iri}}">{{label}}</semantic-link>: {{value}}
        {{else}}
          {{label}}: {{value}}
        {{/if}}
      </li>
    {{/each}}
  </ul>
</div>`;
