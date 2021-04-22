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
import * as vsHtmlService from 'vscode-html-languageservice';
import * as vsJsonService from 'vscode-json-languageservice';

// importing only types to avoid bundling Monaco with worker
import type * as monaco from './MonacoBundle';
import { RangeSet } from './RangeSet';
import {
  TemplateLanguageDataProvider, HtmlOnlyDataProvider, ComponentSchemaProvider,
  hasComponent, getComponentSchema, attributeNameToPropertyName, propertyNameToAttributeName,
  deepResolveSchemaRef, findAllSchemaProperties,
} from './TemplateLanguageDataProvider';
import {
  TemplateLanguageServiceData, JsonSchema, TEMPLATE_INCLUDE_SCHEMA,
} from './TemplateLanguageWorkerCommon';

/* tslint:disable: max-line-length */
/*
 * See `monaco-html` and `vscode-html-languageservice` packages for implementation details:
 *   https://github.com/microsoft/monaco-html/tree/bdd3de5f00a5a44a97984a14ab3e8ffb128c8e5a
 *   https://github.com/microsoft/vscode-html-languageservice/tree/d7fda646b16a244bc33ca84d6a8b0e4e8bc34655
 *   https://github.com/microsoft/vscode-json-languageservice/tree/3eac248f9d55e023b7d039648812439f910059b5
 */
/* tslint:enable: max-line-length */

export class TemplateLanguageWorker {
  private readonly workerContext: monaco.worker.IWorkerContext;
  private readonly htmlService: vsHtmlService.LanguageService;
  private readonly jsonService: vsJsonService.LanguageService;

  private readonly languageData: TemplateLanguageServiceData;
  private readonly schemaProvider: ComponentSchemaProvider;

  constructor(
    workerContext: monaco.worker.IWorkerContext,
    createData: { languageSettings: TemplateLanguageServiceData }
  ) {
    this.workerContext = workerContext;
    this.languageData = createData.languageSettings;
    if (!this.languageData) {
      throw new Error('Missing template language data for language service');
    }
    this.schemaProvider = new ComponentSchemaProvider(this.languageData);
    this.htmlService = vsHtmlService.getLanguageService({
      useDefaultDataProvider: false,
      customDataProviders: [
        new HtmlOnlyDataProvider(this.languageData),
        new TemplateLanguageDataProvider(this.languageData, this.schemaProvider),
      ],
    });
    this.jsonService = vsJsonService.getLanguageService({
      schemaRequestService: this.schemaProvider.resolveSchema,
    });
    this.jsonService.configure({
      validate: true,
      schemas: this.schemaProvider.getSchemas(),
    });
  }

  private getOrCreateDocument(uri: string): vsHtmlService.TextDocument {
    for (const model of this.workerContext.getMirrorModels()) {
      if (model.uri.toString() === uri) {
        return vsHtmlService.TextDocument.create(
          uri, 'mp-template', model.version, model.getValue()
        );
      }
    }
    return null;
  }

  private makeHtmlDocumentContext(document: vsHtmlService.TextDocument): HtmlDocumentContext {
    let documentText: string | null = null;
    return {
      document,
      htmlService: this.htmlService,
      jsonService: this.jsonService,
      schemaProvider: this.schemaProvider,
      getDocumentText: () => {
        if (documentText === null) {
          documentText = document.getText();
        }
        return documentText;
      }
    };
  }

  async doComplete(
    uri: string,
    position: vsHtmlService.Position
  ): Promise<vsHtmlService.CompletionList> {
    const [document] = maskBackendHandlebars(this.getOrCreateDocument(uri));
    const htmlDocument = this.htmlService.parseHTMLDocument(document);

    const match = this.getEmbeddedJsonAtPosition(document, htmlDocument, position);
    if (match) {
      const jsonPosition = match.positionFromHtml(position);
      const jsonCompletionList = await this.jsonService.doComplete(
        match.textDocument, jsonPosition, match.json
      );
      if (jsonCompletionList) {
        const translatedList = translateJsonAttributeCompletion(
          match, jsonCompletionList, jsonPosition
        );
        return Promise.resolve(translatedList);
      }
    }

    const completionList = this.htmlService.doComplete(
      document, position, htmlDocument, {}
    );
    const filteredList: vsHtmlService.CompletionList = {
      ...completionList,
      // filter-out `data-*` attribute suggestions added automatically
      // from usage in the HTML document
      items: completionList.items
        .filter(item => !item.label.startsWith('data-'))
        .map(mapCompletionItemQuotes),
    };
    return Promise.resolve(filteredList);
  }

  async doHover(uri: string, position: vsHtmlService.Position): Promise<vsHtmlService.Hover> {
    const [document] = maskBackendHandlebars(this.getOrCreateDocument(uri));
    const htmlDocument = this.htmlService.parseHTMLDocument(document);

    const match = this.getEmbeddedJsonAtPosition(document, htmlDocument, position);
    if (match) {
      const jsonPosition = match.positionFromHtml(position);
      const jsonHover = await this.jsonService.doHover(
        match.textDocument, jsonPosition, match.json
      );
      if (jsonHover) {
        const translatedHover: vsHtmlService.Hover = {
          contents: jsonHover.contents,
          range: jsonHover.range ? match.rangeFromJson(jsonHover.range) : undefined,
        };
        return Promise.resolve(translatedHover);
      }
    }

    const hover = this.htmlService.doHover(document, position, htmlDocument);
    return Promise.resolve(hover);
  }

  async doValidation(uri: string): Promise<vsHtmlService.Diagnostic[]> {
    const [document, maskedRanges] = maskBackendHandlebars(this.getOrCreateDocument(uri));
    const htmlDocument = this.htmlService.parseHTMLDocument(document);
    const context = this.makeHtmlDocumentContext(document);

    const tasks: Promise<void>[] = [];
    const diagnostics: vsHtmlService.Diagnostic[] = [];

    const checkRequiredAttributes = (node: vsHtmlService.Node, schema: JsonSchema) => {
      if (!schema.required) { return; }
      let range: vsHtmlService.Range | undefined;
      for (const requiredProperty of schema.required) {
        if (requiredProperty === 'children') { continue; }
        const attributeName = propertyNameToAttributeName(requiredProperty);
        const hasRequiredProperty = (
          node.attributes &&
          Object.prototype.hasOwnProperty.call(node.attributes, attributeName)
        );
        if (!hasRequiredProperty) {
          if (!range) {
            range = findTagStartRange(node, context);
          }
          diagnostics.push({
            range,
            severity: vsHtmlService.DiagnosticSeverity.Error,
            message: `Missing required attribute "${attributeName}"`,
          });
        }
      }
    };

    const checkJsonAttribute = (node: vsHtmlService.Node, attribute: string) => {
      if (!node.attributes) { return; }
      if (!Object.prototype.hasOwnProperty.call(node.attributes, attribute)) { return; }
      let rawValue = node.attributes[attribute];
      if (rawValue === null) { return; }
      const attributeValue = trimAttributeContent(rawValue);
      if (!looksLikeEmbeddedJson(attributeValue)) {
        return;
      }
      let match: EmbeddedJson | undefined;
      const ranges = findAttributeRanges(node, attribute, AttributePart.Value, context);
      for (const range of ranges) {
        const content = document.getText(range);
        if (content === rawValue) {
          match = matchEmbeddedJson(node, attribute, content, range, context);
          break;
        }
      }
      if (match) {
        tasks.push((async () => {
          const jsonDiagnostics = await this.jsonService.doValidation(
            match.textDocument, match.json
          );
          for (const diagnostic of jsonDiagnostics) {
            diagnostics.push({
              ...diagnostic,
              range: match.rangeFromJson(diagnostic.range),
            });
          }
        })());
      }
    };

    const visitNode = (node: vsHtmlService.Node) => {
      if (node.tag === undefined) {
        // Handle CDATA blocks and other invalid syntax
        const cdataRange = findCDATARange(node, context);
        if (cdataRange) {
          diagnostics.push({
            range: cdataRange,
            severity: vsHtmlService.DiagnosticSeverity.Warning,
            message: `CDATA sections are invalid in HTML, they will work, ` +
              `but they will break editor features like on-hover information, ` +
              `auto-completion and diagnostic warnings`,
          });
        } else {
          const range = vsHtmlService.Range.create(
            document.positionAt(node.start),
            document.positionAt(node.start + 1)
          );
          diagnostics.push({
            range,
            severity: vsHtmlService.DiagnosticSeverity.Hint,
            message: `Possibly invalid template markup`,
          });
        }
      } else if (node.tag && node.endTagStart === undefined && !VOID_HTML_TAGS.has(node.tag)) {
        const range = findTagStartRange(node, context);
        diagnostics.push({
          range,
          severity: vsHtmlService.DiagnosticSeverity.Error,
          message: `Unclosed non-void tag <${node.tag}>`,
        });
      }

      if (node.tag && hasComponent(node.tag, this.languageData)) {
        const schema = getComponentSchema(node.tag, this.languageData);
        if (schema) {
          checkRequiredAttributes(node, schema);
          checkDefinedAttributes(node, schema, context, maskedRanges, diagnostics);
        }
        if (node.attributes) {
          for (const attribute of Object.keys(node.attributes)) {
            checkJsonAttribute(node, attribute);
          }
        }
      }

      for (const child of node.children) {
        visitNode(child);
      }
    };

    for (const root of htmlDocument.roots) {
      visitNode(root);
    }
    if (tasks.length > 0) {
      await Promise.all(tasks);
    }
    return Promise.resolve(diagnostics);
  }

  async format(
    uri: string,
    range: vsHtmlService.Range,
    options: vsHtmlService.FormattingOptions
  ): Promise<vsHtmlService.TextEdit[]> {
    const document = this.getOrCreateDocument(uri);
    const formattingOptions: vsHtmlService.HTMLFormatConfiguration = {
      ...options,
      wrapAttributes: 'force-expand-multiline',
    };
    const textEdits = this.htmlService.format(document, range, formattingOptions);
    return Promise.resolve(textEdits);
  }

  async getFoldingRanges(
    uri: string,
    context?: { rangeLimit?: number }
  ): Promise<vsHtmlService.FoldingRange[]> {
    const document = this.getOrCreateDocument(uri);
    const ranges = this.htmlService.getFoldingRanges(document, context);
    return Promise.resolve(ranges);
  }

  async findDocumentHighlights(
    uri: string,
    position: vsHtmlService.Position
  ): Promise<vsHtmlService.DocumentHighlight[]> {
    const document = this.getOrCreateDocument(uri);
    const htmlDocument = this.htmlService.parseHTMLDocument(document);
    const highlights = this.htmlService.findDocumentHighlights(document, position, htmlDocument);
    return Promise.resolve(highlights);
  }

  async findDocumentLinks(uri: string): Promise<vsHtmlService.DocumentLink[]> {
    const document = this.getOrCreateDocument(uri);

    const links: vsHtmlService.DocumentLink[] = [];
    const addIncludeLink = (includeMatch: RegExpExecArray) => {
      const includeTarget = includeMatch[1];
      // only consider remote template includes, ignoring inline definitions
      if (includeTarget.indexOf(':') >= 0) {
        const range = vsHtmlService.Range.create(
          document.positionAt(includeMatch.index),
          document.positionAt(includeMatch.index + includeMatch[0].length)
        );
        links.push({
          range,
          target: TEMPLATE_INCLUDE_SCHEMA + includeTarget,
        });
      }
    };

    const documentText = document.getText();

    let match: RegExpExecArray;
    const backendIncludePattern = /\[\[\#?\>\s?\"?([^"\]\s]*)\"?\s?.*?\]\]/g;
    while (match = backendIncludePattern.exec(documentText)) {
      addIncludeLink(match);
    }

    const frontendIncludePattern = /\{\{\#?\>\s?\"?([^"\}\s]*)\"?\s?.*?\}\}/g;
    while (match = frontendIncludePattern.exec(documentText)) {
      addIncludeLink(match);
    }

    return Promise.resolve(links);
  }

  private getEmbeddedJsonAtPosition(
    document: vsHtmlService.TextDocument,
    htmlDocument: vsHtmlService.HTMLDocument,
    position: vsHtmlService.Position
  ): EmbeddedJson | undefined {
    const offset = document.offsetAt(position);
    const node = htmlDocument.findNodeAt(offset);
    if (!node) {
      return undefined;
    }
    const context = this.makeHtmlDocumentContext(document);
    const foundAttribute = findAttributeAtOffset(node, offset, context);
    if (!foundAttribute) {
      return undefined;
    }
    const {attribute, range, content} = foundAttribute;
    return matchEmbeddedJson(node, attribute, content, range, context);
  }
}

/**
 * Maps double-quoted attribute suggestion (`attr="value"`) from HTML language service
 * to single-quoted one (`attr='value'`).
 */
function mapCompletionItemQuotes(item: vsHtmlService.CompletionItem) {
  if (!(item.textEdit && item.insertTextFormat === vsHtmlService.InsertTextFormat.Snippet)) {
    return item;
  }
  const newText = item.textEdit.newText.replace(/="([^"]+)"$/, `='$1'`);
  if (newText === item.textEdit.newText) {
    return item;
  }
  const mapped: vsHtmlService.CompletionItem = {
    ...item,
    textEdit: {...item.textEdit, newText},
  };
  return mapped;
}

function checkDefinedAttributes(
  node: vsHtmlService.Node,
  schema: JsonSchema,
  context: HtmlDocumentContext,
  maskedRanges: RangeSet,
  collectedDiagnostics: vsHtmlService.Diagnostic[]
) {
  if (!node.attributes) { return; }
  const {document} = context;
  let allProperties = schema.properties ?? {};
  if (schema.anyOf) {
    allProperties = findAllSchemaProperties(schema);
  }
  for (const attribute in node.attributes) {
    if (!Object.prototype.hasOwnProperty.call(node.attributes, attribute)) { continue; }
    const propertyName = attributeNameToPropertyName(attribute);
    const hasProperty = Object.prototype.hasOwnProperty.call(allProperties, propertyName);
    if (hasProperty) {
      const propertySchema = deepResolveSchemaRef(
        schema.definitions, allProperties[propertyName]
      );
      const rawValue = node.attributes[attribute];
      if (rawValue !== null) {
        const trimmedValue = trimAttributeContent(rawValue);
        let message = checkAttributeDatatype(trimmedValue, propertySchema, schema.definitions);
        if (message === null) {
          message = checkEventTypeAttribute(trimmedValue, propertySchema, context.schemaProvider);
        }
        if (message !== null) {
          const ranges = findAttributeRanges(node, attribute, AttributePart.Value, context);
          for (const range of ranges) {
            const startOffset = document.offsetAt(range.start);
            const endOffset = document.offsetAt(range.end);
            if (maskedRanges.intersectsRange(startOffset, endOffset)) {
              continue;
            }
            collectedDiagnostics.push({
              range,
              severity: vsHtmlService.DiagnosticSeverity.Warning,
              message,
            });
          }
        }
      }
    } else if (!schema.additionalProperties) {
      let message: string | null;
      if (schema.patternProperties) {
        message = checkPropertyByPattern(propertyName, schema);
      } else {
        message = `Unknown attribute "${attribute}" for component <${node.tag}>`;
      }
      if (message) {
        const ranges = findAttributeRanges(node, attribute, AttributePart.Full, context);
        for (const range of ranges) {
          collectedDiagnostics.push({
            range,
            severity: vsHtmlService.DiagnosticSeverity.Warning,
            message,
          });
        }
      }
    }
  }
}

function checkEventTypeAttribute(
  value: string,
  propertySchema: JsonSchema,
  schemaProvider: ComponentSchemaProvider
): string | null {
  if (propertySchema.format === 'mp-event-type') {
    if (!(value.startsWith('_') || schemaProvider.hasEventType(value))) {
      return `Unknown event type. Custom event types must be ` +
        `prefixed with underscore, e.g. _MyEventType`;
    }
  }
  return null;
}

function findCDATARange(
  node: vsHtmlService.Node,
  context: HtmlDocumentContext
): vsHtmlService.Range | undefined {
  const cdataOpening = '<![CDATA[';
  const openingRange = vsHtmlService.Range.create(
    context.document.positionAt(node.start),
    context.document.positionAt(node.start + cdataOpening.length)
  );
  const openingText = context.document.getText(openingRange);
  return openingText === cdataOpening ? openingRange : undefined;
}

// tslint:disable: no-bitwise
enum AttributeDatatype {
  none = 0,
  string = 1 << 0,
  number = 1 << 1,
  boolean = 1 << 2,
  object = 1 << 3,
  array = 1 << 4,
  any = string | number | boolean | object | array,
}
function checkAttributeDatatype(
  value: string,
  propertySchema: JsonSchema,
  definitions: JsonSchema['definitions']
): string | null {
  let allowed = AttributeDatatype.none;
  allowed = addAllowedDatatype(allowed, propertySchema.type);
  if (propertySchema.anyOf) {
    for (const variant of propertySchema.anyOf) {
      const resolved = deepResolveSchemaRef(definitions, variant);
      allowed = addAllowedDatatype(allowed, resolved.type);
    }
  }
  let valueType = AttributeDatatype.string;
  if (looksLikeTemplatedAttributeValue(value)) {
    valueType = AttributeDatatype.any;
  } else if (looksLikeEmbeddedJson(value)) {
    valueType = AttributeDatatype.object | AttributeDatatype.array;
  } else if (isBooleanAttributeValue(value)) {
    valueType = AttributeDatatype.boolean;
  } else if (isNumberAttributeValue(value)) {
    valueType = AttributeDatatype.number;
  }
  const enumResult = checkEnumAttribute(value, valueType, propertySchema);
  if (enumResult !== null) {
    return enumResult;
  }
  if (allowed && (valueType & allowed) === 0) {
    const typeNames = getDatatypeNames(allowed);
    return typeNames.length === 1
      ? `Expected "${typeNames[0]}"`
      : `Expected one of ${typeNames.map(name => `"${name}"`).join(', ')}`;
  } else {
    return null;
  }
}
function addAllowedDatatype(
  typeSet: AttributeDatatype,
  type: JsonSchema['type']
): AttributeDatatype {
  if (Array.isArray(type)) {
    let result = typeSet;
    for (const variant of type) {
      result |= addAllowedDatatype(result, variant);
    }
    return result;
  } else {
    switch (type) {
      case 'string': return typeSet | AttributeDatatype.string;
      case 'number': return typeSet | AttributeDatatype.number;
      case 'boolean': return typeSet | AttributeDatatype.boolean;
      case 'object': return typeSet | AttributeDatatype.object;
      case 'array': return typeSet | AttributeDatatype.array;
      default: return typeSet;
    }
  }
}
function getDatatypeNames(typeSet: AttributeDatatype): string[] {
  const types: string[] = [];
  let bit = 0;
  while (typeSet !== 0) {
    if (typeSet & 1) {
      types.push(AttributeDatatype[1 << bit]);
    }
    bit++;
    typeSet = (typeSet >> 1);
  }
  return types;
}
function checkEnumAttribute(
  value: string,
  valueType: AttributeDatatype,
  propertySchema: JsonSchema
): string | null {
  if (propertySchema.enum) {
    const parsedValue = parseEnumValue(value, valueType);
    const matchesEnum = (
      (valueType & SUPPORTED_ENUM_TYPES) !== AttributeDatatype.none &&
      propertySchema.enum.indexOf(parsedValue) >= 0
    );
    if (!matchesEnum) {
      const enumValues = propertySchema.enum.map(name => JSON.stringify(name)).join(', ');
      return `Expected one of ${enumValues}`;
    }
  }
  return null;
}
const SUPPORTED_ENUM_TYPES = (
  AttributeDatatype.string |
  AttributeDatatype.number |
  AttributeDatatype.boolean
);
function parseEnumValue(value: string, valueType: AttributeDatatype): string | number | boolean {
  switch (valueType) {
    case AttributeDatatype.number:
      return Number(value);
    case AttributeDatatype.boolean:
      return value === 'true';
    default:
      return value;
  }
}
// tslint:enable: no-bitwise

function checkPropertyByPattern(propertyName: string, schema: JsonSchema): string | null {
  for (const pattern in schema.patternProperties) {
    if (Object.prototype.hasOwnProperty.call(schema.patternProperties, pattern)) {
      if (propertyName.match(pattern)) {
        return null;
      }
    }
  }
  const patterns = Object.keys(schema.patternProperties)
    .map(p => JSON.stringify(p)).join(', ');
  return `Property name "${propertyName}" does not match any pattern: ${patterns}`;
}

class EmbeddedJson {
  constructor(
    readonly textDocument: vsJsonService.TextDocument,
    readonly json: vsJsonService.JSONDocument,
    private readonly offset: number,
    private readonly context: HtmlDocumentContext
  ) {}
  positionFromHtml(position: vsHtmlService.Position): vsJsonService.Position {
    return this.textDocument.positionAt(
      this.context.document.offsetAt(position) - this.offset
    );
  }
  positionFromJson(position: vsJsonService.Position): vsHtmlService.Position {
    return this.context.document.positionAt(
      this.offset + this.textDocument.offsetAt(position)
    );
  }
  rangeFromJson(range: vsJsonService.Range): vsHtmlService.Range {
    return vsHtmlService.Range.create(
      this.positionFromJson(range.start),
      this.positionFromJson(range.end)
    );
  }
}

function matchEmbeddedJson(
  node: vsHtmlService.Node,
  attribute: string,
  content: string,
  range: vsHtmlService.Range,
  context: HtmlDocumentContext
): EmbeddedJson | undefined {
  const trimmedContent = trimAttributeContent(content);
  if (!looksLikeEmbeddedJson(trimmedContent)) {
    return undefined;
  }
  const jsonValue = maskMultilineStringsJson(trimmedContent);
  const propertyName = attributeNameToPropertyName(attribute);
  const eventType = tryGetEventTypeForEventDataProperty(node, propertyName, context.schemaProvider);
  const schemaUri = context.schemaProvider.constructSchemaUri(node.tag, propertyName, eventType);
  const jsonTextDocument = vsJsonService.TextDocument.create(
    schemaUri,
    'json',
    context.document.version,
    jsonValue
  );
  const jsonOffset = context.document.offsetAt(range.start)
    + (trimmedContent.length < content.length ? 1 : 0);
  const jsonDocument = context.jsonService.parseJSONDocument(jsonTextDocument);
  return new EmbeddedJson(jsonTextDocument, jsonDocument, jsonOffset, context);
}

function tryGetEventTypeForEventDataProperty(
  node: vsHtmlService.Node,
  propertyName: string,
  schemaProvider: ComponentSchemaProvider
): string {
  const eventTypePropertyName = schemaProvider.getEventTypePropertyName(node.tag, propertyName);
  if (eventTypePropertyName) {
    const eventTypeAttributeName = propertyNameToAttributeName(eventTypePropertyName);
    if (Object.prototype.hasOwnProperty.call(node.attributes, eventTypeAttributeName)) {
      const eventType = trimAttributeContent(node.attributes[eventTypeAttributeName]);
      return eventType;
    }
  }
  return undefined;
}

function translateJsonAttributeCompletion(
  match: EmbeddedJson,
  jsonCompletionList: vsJsonService.CompletionList,
  jsonPosition: vsJsonService.Position
): vsHtmlService.CompletionList {
  const translatedList: vsHtmlService.CompletionList = {
    isIncomplete: jsonCompletionList.isIncomplete,
    items: jsonCompletionList.items.map((item): vsHtmlService.CompletionItem => {
      let textEdit: vsHtmlService.TextEdit | undefined;
      if (vsJsonService.TextEdit.is(item.textEdit)) {
        textEdit = vsHtmlService.TextEdit.replace(
          match.rangeFromJson(item.textEdit.range),
          item.textEdit.newText
        );
      }
      return {
        ...item,
        documentation: typeof item.documentation === 'string'
          ? {kind: 'markdown', value: item.documentation}
          : item.documentation,
        textEdit,
        additionalTextEdits: undefined,
      };
    }),
  };
  return translatedList;
}

function maskBackendHandlebars(
  document: vsHtmlService.TextDocument
): [vsHtmlService.TextDocument, RangeSet] {
  const documentText = document.getText();
  const maskedRanges = new RangeSet();
  let maskedText = documentText;
  // /[\s\S]/ is "any character" which also matches line breaks unlike /./
  maskedText = maskedText.replace(/\[\[!--[\s\S]*?--(?:\]\]|$)/g, (s, offset) => {
    maskedRanges.insert(offset, offset + s.length);
    return s.replace(/[\s\S]/g, maskNonLineBreaks);
  });
  maskedText = maskedText.replace(/\[\[[\s\S]*?\]\]/g, (s, offset) => {
    maskedRanges.insert(offset, offset + s.length);
    return s.replace(/[\s\S]/g, maskNonLineBreaks);
  });
  const maskedDocument = vsHtmlService.TextDocument.create(
    document.uri, document.languageId, document.version, maskedText
  );
  return [maskedDocument, maskedRanges];
}

function maskNonLineBreaks(ch: string): string {
  return ch === '\r' || ch === '\n' ? ch : ' ';
}

/**
 * Masks line breaks in JSON due to template language allowing
 * multiline string literals in JSON attribute values.
 */
function maskMultilineStringsJson(multilineJson: string): string {
  return multilineJson.replace(/(?:\n|\r|\t)/gm, ' ');
}

function trimAttributeContent(content: string): string {
  if (content.startsWith(`'`) && content.endsWith(`'`)
    || content.startsWith(`"`) && content.endsWith(`"`)
  ) {
    return content.substring(1, content.length - 1);
  }
  return content;
}

// See https://www.w3.org/TR/html5/syntax.html#void-elements
export const VOID_HTML_TAGS = new Set<string>([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen',
  'link', 'menuitem', 'meta', 'param', 'source', 'track', 'wbr',
  // TODO: remove workaround for PREFIX <http://...> handling in multiline attributes
  'http:',
]);

interface HtmlDocumentContext {
  readonly htmlService: vsHtmlService.LanguageService;
  readonly jsonService: vsJsonService.LanguageService;
  readonly schemaProvider: ComponentSchemaProvider;
  readonly document: vsHtmlService.TextDocument;
  getDocumentText(): string;
}

function findTagStartRange(
  node: vsHtmlService.Node,
  context: HtmlDocumentContext
): vsHtmlService.Range {
  const {htmlService, document} = context;
  const documentText = context.getDocumentText();

  let startPosition = node.start;
  let endPosition = node.startTagEnd;
  const scanner = htmlService.createScanner(documentText, node.start);
  if (scanner.scan() === vsHtmlService.TokenType.StartTagOpen) {
    if (scanner.scan() === vsHtmlService.TokenType.StartTag) {
      startPosition = scanner.getTokenOffset();
      endPosition = scanner.getTokenEnd();
    }
  }

  return vsHtmlService.Range.create(
    document.positionAt(startPosition),
    document.positionAt(endPosition)
  );
}

enum AttributePart { Full, Value }

function findAttributeRanges(
  node: vsHtmlService.Node,
  attribute: string,
  part: AttributePart,
  context: HtmlDocumentContext
): vsHtmlService.Range[] {
  const {htmlService, document} = context;
  const documentText = context.getDocumentText();

  const scanner = htmlService.createScanner(documentText, node.start);
  if (scanner.scan() !== vsHtmlService.TokenType.StartTagOpen) {
    return [];
  }
  if (scanner.scan() !== vsHtmlService.TokenType.StartTag) {
    return [];
  }

  const ranges: vsHtmlService.Range[] = [];
  while (scanner.getTokenEnd() < node.startTagEnd) {
    scanner.scan();
    if (scanner.getTokenType() === vsHtmlService.TokenType.AttributeName) {
      if (scanner.getTokenText() === attribute) {
        let startPosition = scanner.getTokenOffset();
        let endPosition = scanner.getTokenEnd();
        scanForEnd: while (scanner.getTokenEnd() < node.startTagEnd) {
          switch (scanner.scan()) {
            case vsHtmlService.TokenType.Whitespace:
            case vsHtmlService.TokenType.DelimiterAssign:
              endPosition = scanner.getTokenEnd();
              break;
            case vsHtmlService.TokenType.AttributeValue:
              if (part === AttributePart.Value) {
                startPosition = scanner.getTokenOffset();
              }
              endPosition = scanner.getTokenEnd();
              break scanForEnd;
            default:
              break scanForEnd;
          }
        }
        ranges.push(vsHtmlService.Range.create(
          document.positionAt(startPosition),
          document.positionAt(endPosition)
        ));
      }
    }
  }

  return ranges;
}

function findAttributeAtOffset(
  node: vsHtmlService.Node,
  offset: number,
  context: HtmlDocumentContext
): { attribute: string; content: string; range: vsHtmlService.Range } | undefined {
  const {htmlService, document} = context;
  const documentText = context.getDocumentText();

  const scanner = htmlService.createScanner(documentText, node.start);
  if (scanner.scan() !== vsHtmlService.TokenType.StartTagOpen) {
    return undefined;
  }
  if (scanner.scan() !== vsHtmlService.TokenType.StartTag) {
    return undefined;
  }

  let attribute: string | undefined;
  while (scanner.getTokenEnd() < offset) {
    scanner.scan();
    switch (scanner.getTokenType()) {
      case vsHtmlService.TokenType.AttributeName:
        attribute = scanner.getTokenText();
        break;
      case vsHtmlService.TokenType.AttributeValue:
        if (attribute && scanner.getTokenOffset() <= offset && offset < scanner.getTokenEnd()) {
          const range = vsHtmlService.Range.create(
            document.positionAt(scanner.getTokenOffset()),
            document.positionAt(scanner.getTokenEnd())
          );
          return {attribute, range, content: scanner.getTokenText()};
        }
        break;
    }
  }
  return undefined;
}

function isNumberAttributeValue(value: string): boolean {
  return /^[+-]?[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/.test(value);
}

function isBooleanAttributeValue(value: string): boolean {
  return value === 'true' || value === 'false';
}

function looksLikeTemplatedAttributeValue(value: string) {
  return (
    // frontend Handlebars syntax -- not a JSON value
    value.startsWith('{{') && value.endsWith('}}') ||
    // backend Handlebars syntax -- not a JSON value
    value.startsWith('[[') && value.endsWith(']]')
  );
}

function looksLikeEmbeddedJson(attributeValue: string): boolean {
  if (looksLikeTemplatedAttributeValue(attributeValue)) {
    return false;
  } else if (attributeValue.startsWith('{') && attributeValue.endsWith('}')) {
    // JSON object
    return true;
  } else if (attributeValue.startsWith('[') && attributeValue.endsWith(']')) {
    // JSON array
    return true;
  } else {
    return false;
  }
}
