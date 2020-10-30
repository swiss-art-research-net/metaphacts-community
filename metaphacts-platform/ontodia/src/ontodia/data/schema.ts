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
import { ElementTypeIri, LinkTypeIri } from './model';
import { generate128BitID } from './utils';

// context could be imported directly from NPM package, e.g.
//   import OntodiaContextV1 from 'ontodia/schema/context-v1.json';
export const DIAGRAM_CONTEXT_URL_V1 = 'https://ontodia.org/context/v1.json';

export const PLACEHOLDER_ELEMENT_TYPE = 'http://ontodia.org/NewEntity' as ElementTypeIri;
export const PLACEHOLDER_LINK_TYPE = 'http://ontodia.org/NewLink' as LinkTypeIri;
const ONTODIA_ID_URL_PREFIX = 'http://ontodia.org/data/';

export namespace GenerateID {
    export function forElement() { return `${ONTODIA_ID_URL_PREFIX}e_${generate128BitID()}`; }
    export function forLink() { return `${ONTODIA_ID_URL_PREFIX}l_${generate128BitID()}`; }
}

export namespace TemplateProperties {
    export const PinnedProperties = 'ontodia:pinnedProperties';
    export const CustomLabel = 'ontodia:customLabel';
}
