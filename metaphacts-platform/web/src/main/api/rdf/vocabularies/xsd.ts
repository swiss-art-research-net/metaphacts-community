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
import * as Immutable from 'immutable';

import * as Rdf from '../core/Rdf';

module xsd {
  /**
   * For XSD namespace considerations see
   * https://www.w3.org/TR/xmlschema-2/#namespaces
   */
  export const _NAMESPACE = 'http://www.w3.org/2001/XMLSchema#';
  export const _DATATYPES_NAMESPACE =
    'http://www.w3.org/2001/XMLSchema-datatypes#';
  export const iri = (s: string) => Rdf.iri(_NAMESPACE + s);

  export const _string = iri('string');
  export const integer = iri('integer');
  export const float = iri('float');
  export const double = iri('double');
  export const boolean = iri('boolean');
  export const date = iri('date');
  export const time = iri('time');
  export const dateTime = iri('dateTime');
  export const decimal = iri('decimal');
  export const anyURI = iri('anyURI');
  export const positiveInteger = iri('positiveInteger');
  export const negativeInteger = iri('negativeInteger');
  export const nonPositiveInteger = iri('nonPositiveInteger');
  export const nonNegativeInteger = iri('nonNegativeInteger');

  export const NUMERIC_TYPES = Immutable.Set<Rdf.Iri>([
    integer,
    positiveInteger,
    negativeInteger,
    nonPositiveInteger,
    nonNegativeInteger,
    float,
    double,
    decimal,
  ]);
}

export default xsd;
