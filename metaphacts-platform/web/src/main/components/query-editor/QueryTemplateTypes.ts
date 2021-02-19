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
import { Rdf, vocabularies } from 'platform/api/rdf';
const { xsd, rdf } = vocabularies;

export const VALUE_TYPES: Array<{ value: string; label: string; disabled?: boolean }> = [
  {value: xsd.anyURI.value, label: 'xsd:anyURI'},
  {value: xsd.integer.value, label: 'xsd:integer'},
  {value: xsd.date.value, label: 'xsd:date'},
  {value: xsd.dateTime.value, label: 'xsd:dateTime'},
  {value: xsd._string.value, label: 'xsd:string'},
  {value: 'http://www.w3.org/2001/XMLSchema#langString', label: 'xsd:langString', disabled: true},
  {value: rdf.langString.value, label: 'rdf:langString'},
  {value: xsd.boolean.value, label: 'xsd:boolean'},
  {value: xsd.double.value, label: 'xsd:double'},
  {value: xsd.decimal.value, label: 'xsd:decimal'},
];

export interface Template {
  readonly templateType: Rdf.Iri;
  readonly identifier: string;
  readonly label: string;
  readonly description: string;
  readonly categories: ReadonlyArray<Rdf.Iri>;
  readonly args: ReadonlyArray<Argument>;
}

export interface Argument {
  readonly label: string;
  readonly variable: string;
  readonly comment: string;
  readonly valueType: string;
  readonly defaultValue?: Rdf.Node;
  readonly optional: boolean;
}

export interface Value {
  readonly value: string;
  readonly error?: Error;
}

export interface CheckedArgument {
  readonly argument: Argument;
  readonly valid: boolean;
}
