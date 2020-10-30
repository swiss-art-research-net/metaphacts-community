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
import {
  ComponentMetadata, DeferredJsonProperties,
} from 'platform/api/module-loader/ComponentsStore';

export function matchJsonAttributeValue(value: string): string | null {
  // remove all kind of line breaks
  const withoutBreaks = value.replace(/(\r\n|\n|\r|\t)/gm, '');

  if (withoutBreaks.startsWith('{{') && withoutBreaks.endsWith('}}')) {
    // not a JSON value
    return null;
  } else if (withoutBreaks.startsWith('{') && withoutBreaks.endsWith('}')) {
    // JSON object
    return withoutBreaks;
  } else if (withoutBreaks.startsWith('[') && withoutBreaks.endsWith(']')) {
    // JSON array
    return withoutBreaks;
  } else {
    return null;
  }
}

export const JSON_PART_HELPER = '__json-part';

export interface TransformedJsonTemplate {
  readonly sourceJson: string;
  readonly transformedJson: string;
  readonly templateString: string;
}

interface TemplateJsonPlaceholder {
  '@type': '__mp-json-part';
  index: number;
}

export function transformJsonTemplate(
  attrValue: string,
  deferred: DeferredJsonProperties | undefined
): TransformedJsonTemplate | null {
  const json = matchJsonAttributeValue(attrValue);
  if (!json) {
    return null;
  }

  const lines: string[] = [];
  let nextValueIndex = 0;
  const reviver = (key: string, value: unknown): unknown => {
    if (typeof value === 'string' && doesValueHaveTemplate(value)) {
      if (!(deferred && Object.prototype.hasOwnProperty.call(deferred, key) && deferred[key])) {
        const index = nextValueIndex++;
        lines.push(`{{#${JSON_PART_HELPER}}}${value}{{/${JSON_PART_HELPER}}}`);
        const placeholder: TemplateJsonPlaceholder = {
          '@type': '__mp-json-part',
          'index': index,
        };
        return placeholder;
      }
    }
    return value;
  };

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(json, reviver);
  } catch (err) {
    return null;
  }

  return {
    sourceJson: json,
    transformedJson: JSON.stringify(parsedJson),
    templateString: lines.join('\n'),
  };
}

export function getDeferredJsonProperties(
  metadata: ComponentMetadata | undefined,
  attrName: string
): DeferredJsonProperties | undefined {
  const hasDeferredJsonProperties = metadata
    && metadata.deferJsonProperties
    && Object.prototype.hasOwnProperty.call(metadata.deferJsonProperties, attrName);
  return hasDeferredJsonProperties ? metadata.deferJsonProperties[attrName] : undefined;
}

function doesValueHaveTemplate(attributeValue: string): boolean {
  return attributeValue.indexOf('{{') >= 0;
}

export function makeJsonTemplateReviver(
  placedParts: ReadonlyArray<unknown>
): (this: any, key: string, value: unknown) => unknown {
  function isPlaceholder(value: unknown): value is TemplateJsonPlaceholder {
    if (typeof value !== 'object') { return false; }
    const placeholder = value as Partial<TemplateJsonPlaceholder>;
    return placeholder['@type'] === '__mp-json-part'
      && typeof placeholder.index === 'number';
  }
  return function (key, value) {
    if (isPlaceholder(value)) {
      if (value.index < 0 || value.index >= placedParts.length) {
        throw new Error('Invalid template JSON placeholder index');
      }
      return placedParts[value.index];
    }
    return value;
  };
}
