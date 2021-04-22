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
import { kebabCase } from 'lodash';
import * as vsHtmlService from 'vscode-html-languageservice';
import * as vsJsonService from 'vscode-json-languageservice';

import {
  TemplateLanguageServiceData, ComponentMetadata, JsonSchema, TEMPLATE_RESOURCE_LINK,
} from './TemplateLanguageWorkerCommon';

export class TemplateLanguageDataProvider implements vsHtmlService.IHTMLDataProvider {
  private cachedTags: vsHtmlService.ITagData[] | undefined;

  constructor(
    private readonly languageData: TemplateLanguageServiceData,
    private readonly schemaProvider: ComponentSchemaProvider
  ) {}

  getId(): string {
    return 'mp-template-data-provider';
  }

  isApplicable(languageId: string): boolean {
    return languageId === 'mp-template';
  }

  provideTags(): vsHtmlService.ITagData[] {
    if (!this.cachedTags) {
      const allTags = getAllComponentTags(this.languageData);
      this.cachedTags = allTags.map((tag): vsHtmlService.ITagData => {
        const metadata = getComponentMetadata(tag, this.languageData);
        const schema = getComponentSchema(tag, this.languageData);
        const description = schema?.description ?? `\`${tag}\` component`;
        const helpUrl = metadata?.helpResource
          ? (TEMPLATE_RESOURCE_LINK + metadata.helpResource)
          : undefined;
        const references: vsHtmlService.IReference[] = [];
        if (helpUrl) {
          references.push({name: 'Documentation page', url: helpUrl});
        }
        this.addResourceReferences(schema, references);
        return {
          name: tag,
          description,
          attributes: this.provideAttributes(tag),
          references,
        };
      });
    }
    return this.cachedTags;
  }

  provideAttributes(tag: string): vsHtmlService.IAttributeData[] {
    const schema = getComponentSchema(tag, this.languageData);
    if (!schema) {
      return [];
    }
    const allProperties = findAllSchemaProperties(schema);
    const attributes: vsHtmlService.IAttributeData[] = [];
    for (const propertyName of Object.keys(allProperties)) {
      if (propertyName === 'children') { continue; }

      let previousSchema: JsonSchema;
      let propertySchema = allProperties[propertyName];
      if (propertySchema) {
        do {
          if (propertySchema.description) { break; }
          previousSchema = propertySchema;
          propertySchema = resolveSchemaRef(schema.definitions, previousSchema);
        } while (propertySchema !== previousSchema);
      }

      const attributeName = propertyNameToAttributeName(propertyName);
      let description = propertySchema?.description ?? `\`${attributeName}\` attribute`;
      if (propertySchema?.default) {
        const defaultValue = propertySchema.default;
        const defaultString = typeof defaultValue === 'object'
          ? JSON.stringify(defaultValue) : defaultValue;
        description += `\n\n**Default**: \`\`\`${defaultString}\`\`\``;
      }

      const references: vsHtmlService.IReference[] = [];
      this.addResourceReferences(propertySchema, references);

      attributes.push({
        name: attributeName,
        description,
        values: this.provideValues(tag, attributeName),
        references,
      });
    }
    return attributes;
  }

  provideValues(tag: string, attribute: string): vsHtmlService.IValueData[] {
    const schema = getComponentSchema(tag, this.languageData);
    if (!schema) {
      return [];
    }
    const allProperties = findAllSchemaProperties(schema);
    const propertyName = attributeNameToPropertyName(attribute);
    let propertySchema = allProperties[propertyName];
    if (!propertySchema) {
      return [];
    }
    propertySchema = deepResolveSchemaRef(schema.definitions, propertySchema);
    if (propertySchema.format === 'mp-event-type') {
      return this.schemaProvider.provideEventTypes();
    } else if (propertySchema.enum) {
      const values: vsHtmlService.IValueData[] = [];
      for (const enumValue of propertySchema.enum) {
        if (typeof enumValue === 'string'
          || typeof enumValue === 'number'
          || typeof enumValue === 'boolean'
        ) {
          values.push({name: String(enumValue)});
        }
      }
      return values;
    } else if (propertySchema.type === 'boolean') {
      return [...BOOLEAN_VALUE_SET];
    } else {
      return [];
    }
  }

  private addResourceReferences(
    schema: JsonSchema | undefined,
    outReferences: vsHtmlService.IReference[]
  ) {
    if (schema?.mpSeeResource) {
      if (Array.isArray(schema.mpSeeResource)) {
        for (const {name, iri} of schema.mpSeeResource) {
          outReferences.push({name, url: TEMPLATE_RESOURCE_LINK + iri});
        }
      } else {
        const {name, iri} = schema.mpSeeResource;
        outReferences.push({name, url: TEMPLATE_RESOURCE_LINK + iri});
      }
    }
  }
}

const BOOLEAN_VALUE_SET: ReadonlyArray<vsHtmlService.IValueData> = [
  {name: 'true', description: '`true` boolean value'},
  {name: 'false', description: '`false` boolean value'},
];

export class HtmlOnlyDataProvider implements vsHtmlService.IHTMLDataProvider {
  private baseProvider = vsHtmlService.getDefaultHTMLDataProvider();

  constructor(
    private readonly languageData: TemplateLanguageServiceData
  ) {}

  getId(): string {
    return this.baseProvider.getId();
  }

  isApplicable(languageId: string): boolean {
    return languageId === 'mp-template';
  }

  provideTags(): vsHtmlService.ITagData[] {
    return this.baseProvider.provideTags();
  }

  provideAttributes(tag: string): vsHtmlService.IAttributeData[] {
    if (hasComponent(tag, this.languageData)) {
      return [];
    }
    return this.baseProvider.provideAttributes(tag);
  }

  provideValues(tag: string, attribute: string): vsHtmlService.IValueData[] {
    if (hasComponent(tag, this.languageData)) {
      return [];
    }
    return this.baseProvider.provideValues(tag, attribute);
  }
}

export class ComponentSchemaProvider {
  private schemas: vsJsonService.SchemaConfiguration[] = [];
  private readonly eventTypeToSchemaName = new Map<string, string>();
  private readonly augmentedSchemas = new Set<JsonSchema>();
  private readonly resolvedSchemas = new Map<string, JsonSchema>();

  private cachedEventTypes: vsHtmlService.IValueData[] | undefined;

  constructor(
    private readonly languageData: TemplateLanguageServiceData
  ) {
    for (const tag of getAllComponentTags(this.languageData)) {
      const schema = getComponentSchema(tag, this.languageData);
      if (schema) {
        const allProperties = findAllSchemaProperties(schema);
        for (const property of Object.keys(allProperties)) {
          const propertySchema = deepResolveSchemaRef(schema.definitions, allProperties[property]);
          if (propertySchema.anyOf
            || propertySchema.type === 'object'
            || propertySchema.type === 'array'
          ) {
            const schemaUri = `mp-template:attribute/${tag}/${property}`;
            this.schemas.push({
              fileMatch: [schemaUri],
              uri: schemaUri,
            });
          }
        }
      }
    }
    for (const schemaName in this.languageData.schemas) {
      if (!Object.prototype.hasOwnProperty.call(this.languageData.schemas, schemaName)) {
        continue;
      }
      const schema = this.languageData.schemas[schemaName];
      if (schema.type === 'object' && schema.mpSchemaMetadata?.kind === 'events') {
        for (const eventType in schema.properties) {
          if (!Object.prototype.hasOwnProperty.call(schema.properties, eventType)) {
            continue;
          }
          this.eventTypeToSchemaName.set(eventType, schemaName);
          const schemaUri = `mp-template:event/${eventType}`;
          this.schemas.push({
            fileMatch: [schemaUri],
            uri: schemaUri,
          });
        }
      }
    }
  }

  getSchemas(): vsJsonService.SchemaConfiguration[] {
    return this.schemas;
  }

  hasEventType(eventType: string): boolean {
    return this.eventTypeToSchemaName.has(eventType);
  }

  provideEventTypes(): vsHtmlService.IValueData[] {
    if (!this.cachedEventTypes) {
      const eventTypes = Array.from(this.eventTypeToSchemaName.keys()).sort();
      this.cachedEventTypes = eventTypes.map((eventType): vsHtmlService.IValueData => {
        const schemaName = this.eventTypeToSchemaName.get(eventType);
        const schema = this.languageData.schemas[schemaName];
        const eventDataSchema = schema.properties[eventType];
        return {
          name: eventType,
          description: eventDataSchema.description,
        };
      });
    }
    return this.cachedEventTypes;
  }

  getEventTypePropertyName(tag: string, propertyName: string): string | undefined {
    const schema = getComponentSchema(tag, this.languageData);
    if (schema && schema.type === 'object') {
      if (Object.prototype.hasOwnProperty.call(schema.properties, propertyName)) {
        const propertySchema = schema.properties[propertyName];
        return propertySchema?.mpHasEventType;
      }
    }
    return undefined;
  }

  constructSchemaUri(tag: string, propertyName: string, eventType: string | undefined): string {
    if (eventType && this.eventTypeToSchemaName.has(eventType)) {
      return `mp-template:event/${eventType}`;
    }
    return `mp-template:attribute/${tag}/${propertyName}`;
  }

  resolveSchema: vsJsonService.SchemaRequestService = uri => {
    const schema = this.buildAttributeSchema(uri);
    return Promise.resolve(schema ? JSON.stringify(schema) : undefined);
  }

  private buildAttributeSchema(uri: string): JsonSchema | undefined {
    if (this.resolvedSchemas.has(uri)) {
      return this.resolvedSchemas.get(uri);
    }

    let topLevelSchema: JsonSchema | undefined;
    let subSchema: JsonSchema | undefined;

    let match = /^mp-template:attribute\/([^\/]+)\/([^\/]+)$/.exec(uri);
    if (match) {
      const [, tag, property] = match;
      topLevelSchema = getComponentSchema(tag, this.languageData);
      if (!topLevelSchema) {
        return undefined;
      }
      augmentSchemaRecursively(topLevelSchema, this.augmentedSchemas);
      const allProperties = findAllSchemaProperties(topLevelSchema);
      if (!Object.prototype.hasOwnProperty.call(allProperties, property)) {
        return undefined;
      }
      subSchema = allProperties[property];
    }
    match = /^mp-template:event\/([^\/]+)$/.exec(uri);
    if (match) {
      const [, eventType] = match;
      const schemaName = this.eventTypeToSchemaName.get(eventType);
      if (!schemaName) {
        return;
      }
      topLevelSchema = this.languageData.schemas[schemaName];
      augmentSchemaRecursively(topLevelSchema, this.augmentedSchemas);
      subSchema = topLevelSchema.properties[eventType];
    }

    if (topLevelSchema && subSchema) {
      const schemaWithDefinitions: JsonSchema = {
        ...subSchema,
        id: uri,
        definitions: topLevelSchema.definitions,
      };
      this.resolvedSchemas.set(uri, schemaWithDefinitions);
      return schemaWithDefinitions;
    } else {
      return undefined;
    }
  }
}

function getAllComponentTags(languageData: TemplateLanguageServiceData): string[] {
  return Object.keys(languageData.components);
}

export function hasComponent(
  componentTag: string,
  languageData: TemplateLanguageServiceData
): boolean {
  return Object.prototype.hasOwnProperty.call(languageData.components, componentTag);
}

export function getComponentSchema(
  componentTag: string,
  languageData: TemplateLanguageServiceData
): JsonSchema | undefined {
  const metadata = getComponentMetadata(componentTag, languageData);
  if (!(metadata && metadata.propsSchema)) {
    return undefined;
  }
  const schema = languageData.schemas[metadata.propsSchema];
  return schema;
}

function getComponentMetadata(
  componentTag: string,
  languageData: TemplateLanguageServiceData
): ComponentMetadata | undefined {
  return hasComponent(componentTag, languageData)
    ? languageData.components[componentTag] : undefined;
}

export function propertyNameToAttributeName(propertyName: string): string {
  if (propertyName === 'className') {
    return 'class';
  }
  return kebabCase(propertyName);
}

export function attributeNameToPropertyName(attributeName: string): string {
  if (attributeName === 'class') {
    return 'className';
  }
  return attributeName
    .replace(/^(x|data)[-_:]/i, '')
    .replace(/[-_:](.)/g, (x, chr) => chr.toUpperCase());
}

export function findAllSchemaProperties(root: JsonSchema): { [propertyName: string]: JsonSchema } {
  const result: { [propertyName: string]: JsonSchema } = {};
  const visitSchema = (schema: JsonSchema) => {
    if (schema.properties) {
      Object.assign(result, schema.properties);
    }
    if (schema.anyOf) {
      for (const variant of schema.anyOf) {
        const resolved = deepResolveSchemaRef(schema.definitions, variant);
        visitSchema(resolved);
      }
    }
  };
  visitSchema(root);
  return result;
}

const SCHEMA_REF_PREFIX = '#/definitions/';

function resolveSchemaRef(
  definitions: JsonSchema['definitions'],
  schema: JsonSchema
): JsonSchema {
  if (schema && definitions) {
    if (schema.$ref && schema.$ref.startsWith(SCHEMA_REF_PREFIX)) {
      const definitionName = schema.$ref.substring(SCHEMA_REF_PREFIX.length);
      const definition = definitions[definitionName];
      if (definition) {
        return definition;
      }
    }
  }
  return schema;
}

export function deepResolveSchemaRef(
  definitions: JsonSchema['definitions'],
  schema: JsonSchema
): JsonSchema {
  let previousSchema: JsonSchema;
  let current = schema;
  do {
    previousSchema = current;
    current = resolveSchemaRef(definitions, previousSchema);
  } while (current !== previousSchema);
  return current;
}

interface MonacoExtendedJsonSchema {
  markdownDescription?: string;
}

function augmentSchemaRecursively(
  root: JsonSchema,
  alreadyAugmented: Set<JsonSchema>
): void {
  const visit = (schema: JsonSchema) => {
    if (alreadyAugmented.has(schema)) { return; }
    alreadyAugmented.add(schema);
    /**
     * Workaround for `vscode-json-languageservice` treating `description` as plain text
     * and requiring to use `markdownDescription` for formatted content instead.
     *
     * See https://github.com/microsoft/vscode-cpptools/issues/4544
     *
     * TODO: generate `markdownDescription` field in schemas?
     */
    if (typeof schema.description === 'string'
      && typeof (schema as MonacoExtendedJsonSchema).markdownDescription !== 'string'
    ) {
      (schema as MonacoExtendedJsonSchema).markdownDescription = schema.description;
    }
    /**
     * Disallow any unknown properties if not specified otherwise because JSON language
     * service doesn't have a configurable option to validate in this mode by default.
     */
    if (schema.type === 'object'
      && !(schema.$ref || schema.anyOf || schema.enum || schema.patternProperties)
      && schema.additionalProperties === undefined
    ) {
      schema.additionalProperties = false;
    }
    if (schema.anyOf) {
      for (const variant of schema.anyOf) {
        visit(variant);
      }
    }
    if (schema.properties) {
      for (const propertyName of Object.keys(schema.properties)) {
        visit(schema.properties[propertyName]);
      }
    }
    if (schema.definitions) {
      for (const definitionName of Object.keys(schema.definitions)) {
        visit(schema.definitions[definitionName]);
      }
    }
  };
  visit(root);
}
