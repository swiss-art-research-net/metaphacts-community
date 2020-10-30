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
import * as _ from 'lodash';
import * as Model from './Model';
import { SemanticSearchConfig } from '../../config/SearchConfig';

const DATE_STRING_FORMAT = 'DD/MM/YYYY';

export const textDisjunctToString = (disjunct: Model.TextDisjunct): string => {
  return `"${disjunct.value}"`;
};

export const entityToString = (disjunct: Model.ResourceDisjunct): string => disjunct.value.label;

export const setToString =
  (disjunct: Model.SetDisjunct): string => `entities from set: ${disjunct.value.label}`;

export const dateValueToString = (dateValue: Model.DateValue): string =>
  dateValue.format(DATE_STRING_FORMAT);

export const yearValueToString = (value: Model.YearValue): string =>
  `Year ${value.year} ${value.epoch}`;

export const dateToString = (disjunct: Model.DateDisjunct): string =>
  dateValueToString(disjunct.value);

export const dateRangeToString = (disjunct: Model.DateRangeDisjunct): string =>
  `${dateValueToString(disjunct.value.begin)} - ${dateValueToString(disjunct.value.end)}`;

export const dateDeviationToString = (disjunct: Model.DateDeviationDisjunct): string =>
  `${dateValueToString(disjunct.value.date)} ± ${disjunct.value.deviation} days`;

export const yearToString = (disjunct: Model.YearDisjunct): string =>
  yearValueToString(disjunct.value);

export const yearRangeToString = (disjunct: Model.YearRangeDisjunct): string =>
  `${yearValueToString(disjunct.value.begin)} - ${yearValueToString(disjunct.value.end)}`;

export const yearDeviationToString = (disjunct: Model.YearDeviationDisjunct): string =>
  `${yearValueToString(disjunct.value.year)} ± ${disjunct.value.deviation} years`;

const round = (value: number): number => _.round(value, 2);

export const spatialDistanceToString = (disjunct: Model.SpatialDistanceDisjunct): string => {
  const value = disjunct.value;
  return `Circle of ${round(value.distance)}km at (${round(value.center.lat)},${round(value.center.long)})`;
};

export const spatialBoundingBoxToString = (disjunct: Model.SpatialBoundingBoxDisjunct): string => {
  const value = disjunct.value;
  return `Rectangle from (${round(value.southWest.lat)},${round(value.southWest.long)}) ` +
    `to (${round(value.northEast.lat)},${round(value.northEast.long)})`;
};

export const literalToString = (disjunct: Model.LiteralDisjunct): string => {
  const value = disjunct.value.literal;
  return `Literal "${value}"`;
};

export const numericRangeToString = (disjunct: Model.NumericRangeDisjunct): string => {
  const {begin, end} = disjunct.value;
  return `Numeric range [${begin}, ${end}]`;
};

export const searchDisjunctToString = (disjunct: Model.SearchDisjunct): string => {
  return '';
};

export const savedSearchToString = (disjunct: Model.SavedSearchDisjunct): string =>
  'Search: ' + disjunct.value.label;

export function disjunctToString(disjunct: Model.Disjunct): string {
  return Model.matchDisjunct({
    Resource: entityToString,
    Date: dateToString,
    DateRange: dateRangeToString,
    DateDeviation: dateDeviationToString,
    Year: yearToString,
    YearRange: yearRangeToString,
    YearDeviation: yearDeviationToString,
    Text: textDisjunctToString,
    Set: setToString,
    Search: searchDisjunctToString,
    SavedSearch: savedSearchToString,
    Distance: spatialDistanceToString,
    BoundingBox: spatialBoundingBoxToString,
    Literal: literalToString,
    NumericRange: numericRangeToString,
  })(disjunct);
}

export type ResourceCategoryType = 'resource' | 'hierarchy' | 'place' | 'set';
export type TextCategoryType = 'text';
export type DateRangeCategoryType = 'date-range';
export type NumericalCategoryType = 'numerical';
export type LiteralCategoryType = 'literal';
export type NumericRangeCategoryType = 'numeric-range';
export type CategoryType = ResourceCategoryType | TextCategoryType | DateRangeCategoryType | NumericalCategoryType |
  LiteralCategoryType | NumericRangeCategoryType;

export function getCategoryTypes(
  config: SemanticSearchConfig, category: Model.Category
): Array<CategoryType> {
  const categories = config.categories;
  const categoryIri = category.iri.toString();
  if (_.has(categories, categoryIri)) {
    const kinds = _.cloneDeep(_.map(categories[categoryIri], c => c.kind));
    if (
      _.intersection(kinds, ['text', 'numeric-range', 'date-range', 'literal']).length === 0 &&
        !_.includes(kinds, 'hierarchy')
    ) {
      kinds.push('resource', 'set');
    }
    return kinds;
  } else {
    return ['resource', 'set'];
  }
}
