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
import * as Handlebars from 'handlebars';
import { Parser as HtmlParser, Node, Instruction } from 'html-to-react';
import * as render from 'dom-serializer';
import * as _ from 'lodash';

import { WrappingError } from 'platform/api/async';
import {
  ComponentMetadata, hasComponent, getComponentMetadata,
} from 'platform/api/module-loader/ComponentsStore';
import { Rdf } from 'platform/api/rdf';
import { resolveIris } from 'platform/api/sparql/SparqlUtil';

import {
  JSON_PART_HELPER, getDeferredJsonProperties, transformJsonTemplate,
} from './JsonTemplateParser';

export function isTemplate(node: Node): boolean {
  return node.type === 'tag' && node.name === 'template';
}

export interface ExtractedTemplate {
  readonly localName: string;
  readonly globalKey: number;
  readonly source: string;
  readonly transformedAst: hbs.AST.Program;
  readonly nodes: ReadonlyArray<ExtractedNode>;
  readonly childTemplates: ReadonlyArray<ExtractedTemplate>;
  readonly captureContextAt: ReadonlySet<number>;
  readonly importedComponents: ReadonlySet<string>;
  readonly localReferences: ReadonlySet<string>;
  /**
   * Resolved remote template references (IRIs).
   */
  readonly remoteReferences: ReadonlyArray<Rdf.Iri>;
  readonly hasDynamicHtml: boolean;
}

export interface ExtractedNode extends Node {
  __transformedAttributes?: { [attrName: string]: unknown };
}

/**
 * Extracts locally defined templates from a node.
 *
 * For example, `<set-management>` node in this markup locally defines
 * a separate template scope with templates 'foo', 'qux' and
 * 'http://www.metaphacts.com/ontologies/platform#bar':
 *
 * <set-management>
 *   <template id='foo'>
 *     <span style='background: red'>{{> qux}}</span>
 *   </template>
 *   <template id='qux'>
 *     <div>QUX</div>
 *     {{> @partial-block}}
 *   </template>
 *   <template id='http://www.metaphacts.com/ontologies/platform#bar'>
 *     {{> foo}}
 *     {{#> qux}}footer{{/qux}}
 *   </template>
 * </set-management>
 */
export function extractTemplates(node: Node): Array<ExtractedTemplate> {
  let missingID = false;
  const templateNodes = node.children
    .filter(child => child.name === 'template')
    .filter(template => {
      const hasId = template.attribs.id !== undefined;
      if (!hasId) {
        missingID = true;
      }
      return hasId;
    });

  if (missingID) {
    throw new Error(`Missing an ID attribute for a mini-template in <${node.name}>`);
  }

  return templateNodes.map(extractTemplateFromTemplateNode);
}

function extractTemplateFromTemplateNode(templateNode: Node) {
  const localName = (
    templateNode.attribs ? templateNode.attribs.id : undefined
  ) as string | undefined;
  if (!localName) {
    throw new Error('Missing ID for <template> node');
  }

  try {
    return extractTemplateBody(templateNode.children, localName);
  } catch (err) {
    throw new WrappingError(`Failed to parse <template id='${localName}'>`, err);
  }
}

let nextGlobalTemplateKey = 1;

export function extractTemplateBody(
  body: ReadonlyArray<Node> | undefined,
  localName?: string
): ExtractedTemplate {
  // Assign each template a unique global ID to differentiate nodes from main template
  // and referenced partials (other templates) when rendering the template
  const globalKey = nextGlobalTemplateKey++;
  const result: OutputTranslationResult = {
    globalKey,
    parts: [],
    nodes: [],
    childTemplates: [],
    captureContextAt: new Set(),
  };
  if (body) {
    // Transform parsed HTML tree into Handlebars template where each tag
    // (e.g. <div>, <semantic-link>, etc) is replaced by system node helper call
    for (const child of body) {
      translateTemplateElement(child, result);
    }
  }
  const transformedSource = result.parts.join('');
  let transformedAst: hbs.AST.Program;
  try {
    transformedAst = Handlebars.parse(transformedSource);
  } catch (err) {
    throw tryImproveTemplateParseError(err);
  }
  const {nodes, childTemplates, captureContextAt} = result;

  // Wrap free-standing content nodes (i.e. text) and non-block braced statements ({{ ... }})
  // into system text helper to capture result when rendering the template
  const transformer = new TextNodesTransformer();
  transformer.accept(transformedAst);

  const scanner = new RemoteTemplateScanner();
  scanner.accept(transformedAst);

  const remoteReferences = resolveIris(Array.from(scanner.remoteReferences));

  return {
    localName,
    globalKey: result.globalKey,
    source: body ? renderHtml(body) : '',
    transformedAst,
    nodes,
    childTemplates,
    captureContextAt,
    // imported components and references in theory could be computed lazily if needed
    importedComponents: findImportedComponents(nodes),
    localReferences: scanner.localReferences,
    remoteReferences,
    hasDynamicHtml: transformer.foundDynamicHtml,
  };
}

interface OutputTranslationResult {
  readonly globalKey: number;
  parts: string[];
  nodes: ExtractedNode[];
  childTemplates: ExtractedTemplate[];
  captureContextAt: Set<number>;
}

export namespace SystemHelpers {
  export const NODE = '__n';
  export const ATTRIBUTE = '__a';
  export const TEMPLATE = '__template';
  export const TEXT = '__t';
  export const DYNAMIC_HTML = '__html';
  export const JSON_PART = JSON_PART_HELPER;
}

function translateTemplateElement(node: ExtractedNode, result: OutputTranslationResult): void {
  if (node.type === 'text') {
    result.parts.push(node.data);
    return;
  } else if (!(node.type === 'tag' || node.type === 'style')) {
    return;
  }

  const nodeIndex = result.nodes.length;
  result.nodes.push(node);
  result.parts.push(`{{#${SystemHelpers.NODE} "${node.name}" ${result.globalKey} ${nodeIndex}}}`);

  let markToCaptureDataContext = false;

  const metadata = tryGetComponentMetadata(node.name);
  for (const attrName in node.attribs) {
    if (!Object.prototype.hasOwnProperty.call(node.attribs, attrName)) { continue; }
    const attrValue = node.attribs[attrName];
    if (delayAttributeExpansion(metadata, attrName)) {
      markToCaptureDataContext = true;
      continue;
    }
    if (typeof attrValue === 'string' && doesAttributeHasTemplate(attrValue)) {
      const deferredJsonProperties = getDeferredJsonProperties(metadata, attrName);
      const jsonTemplate = transformJsonTemplate(attrValue, deferredJsonProperties);
      if (jsonTemplate) {
        setTransformedAttribute(node, attrName, jsonTemplate.transformedJson);
        result.parts.push(
          `{{#${SystemHelpers.ATTRIBUTE} "${attrName}" json=true}}`,
          jsonTemplate.templateString,
          `{{/${SystemHelpers.ATTRIBUTE}}}`
        );
      } else {
        const escapedAttrValue = escapePartialReferences(attrValue);
        result.parts.push(
          `{{#${SystemHelpers.ATTRIBUTE} "${attrName}"}}`,
          escapedAttrValue,
          `{{/${SystemHelpers.ATTRIBUTE}}}`
        );
      }
    }
  }

  if (node.children && !preserveTagContent(node.name)) {
    for (const child of node.children) {
      if (isTemplate(child)) {
        markToCaptureDataContext = true;
        const childTemplateIndex = result.childTemplates.length;
        const childTemplate = extractTemplateFromTemplateNode(child);
        result.childTemplates.push(childTemplate);
        result.parts.push(`{{${SystemHelpers.TEMPLATE} ${childTemplateIndex}}}`);
      } else {
        translateTemplateElement(child, result);
      }
    }
  }

  result.parts.push(`{{/${SystemHelpers.NODE}}}`);

  if (markToCaptureDataContext) {
    result.captureContextAt.add(nodeIndex);
  }
}

function tryImproveTemplateParseError(raisedError: unknown): unknown {
  const error = raisedError as { message: string };
  if (!(error && typeof error === 'object' && typeof error.message === 'string')) {
    return error;
  }
  const match = /^([^ ]+) doesn't match ([^ ]+)( .*)$/.exec(error.message);
  if (match) {
    const [, firstName, secondName, restOfError] = match;
    const transformedFirst = getHumanReadableHelperName(firstName);
    const transformedSecond = getHumanReadableHelperName(secondName);
    if (transformedFirst !== firstName || transformedSecond !== secondName) {
      error.message = `${transformedFirst} doesn't match ${transformedSecond}${restOfError}`;
    }
  }
  return error;
}

function getHumanReadableHelperName(helperName: string): string {
  switch (helperName) {
    case SystemHelpers.NODE: return `HTML tag`;
    case SystemHelpers.ATTRIBUTE: return `HTML attribute`;
    case SystemHelpers.TEXT: return `HTML text`;
    case SystemHelpers.DYNAMIC_HTML: return `{{{raw HTML}}}`;
    case SystemHelpers.TEMPLATE: return `<template>`;
    case SystemHelpers.JSON_PART: return `templated JSON value`;
  }
  return helperName;
}

/**
 * Sets modified value for node attribute in a separate place
 * to preserve original node attributes.
 */
function setTransformedAttribute(node: ExtractedNode, attrName: string, attrValue: unknown) {
  if (!node.__transformedAttributes) {
    node.__transformedAttributes = {};
  }
  node.__transformedAttributes[attrName] = attrValue;
}

export function getTransformedAttribute(node: ExtractedNode, attrName: string): unknown {
  return node.__transformedAttributes ? node.__transformedAttributes[attrName] : undefined;
}

export function findImportedComponents(nodes: Node[]): Set<string> {
  const importedComponents = new Set<string>();
  function visit(node: Node) {
    if (isTemplate(node)) { return; }
    if (node.type === 'tag') {
      const componentTag = mapImportedComponentTag(node.name);
      if (componentTag) {
        importedComponents.add(componentTag);
      }
    }
    if (node.children) {
      for (const child of node.children) {
        visit(child);
      }
    }
  }
  for (const node of nodes) {
    visit(node);
  }
  return importedComponents;
}

function mapImportedComponentTag(tag: string): string | undefined {
  if (tag.indexOf('-') >= 0 || tag === 'ontodia') {
    return tag;
  } else if (tag === 'code') {
    return 'mp-code-highlight';
  } else {
    return undefined;
  }
}

export function preserveTagContent(tag: string) {
  return tag === 'code' || tag === 'mp-code-example' || tag === 'mp-code-block';
}

function doesAttributeHasTemplate(attributeValue: string): boolean {
  return attributeValue.indexOf('{{') >= 0;
}

function tryGetComponentMetadata(tagName: string): ComponentMetadata | undefined {
  return hasComponent(tagName) ? getComponentMetadata(tagName) : undefined;
}

function delayAttributeExpansion(
  metadata: ComponentMetadata | undefined,
  attrName: string
): boolean {
  if (metadata && metadata.deferAttributes) {
    const {deferAttributes} = metadata;
    return Boolean(
      Object.prototype.hasOwnProperty.call(deferAttributes, attrName) &&
      deferAttributes[attrName]
    );
  }
  return false;
}

export function isRemoteReference(partialName: string) {
  return partialName.indexOf(':') >= 0;
}

declare module 'handlebars' {
  interface Visitor {
    mutating: boolean;
  }

  function registerPartial(name: string, ast: hbs.AST.Program): any;
}

class TextNodesTransformer extends Handlebars.Visitor {
  private lastWrapped: hbs.AST.BlockStatement | undefined;
  private hasDynamicHtml = false;

  constructor() {
    super();
    this.mutating = true;
  }

  get foundDynamicHtml(): boolean {
    return this.hasDynamicHtml;
  }

  acceptArray(array: hbs.AST.Expression[]) {
    for (let i = 0, length = array.length; i < length; i++) {
      const canBeMerged = Boolean(this.lastWrapped);
      this.acceptKey(array as any, i as any);

      if (array[i]) {
        if (canBeMerged) {
          // If item wasn't merged into previous one then we must reset ability
          // to merge the next one (it only possible to combine immediate siblings)
          this.lastWrapped = undefined;
        }
      } else {
        array.splice(i, 1);
        i--;
        length--;
      }
    }
    this.lastWrapped = undefined;
  }

  // e.g. free-standing text
  ContentStatement(content: hbs.AST.ContentStatement) {
    return this.mergeIntoTextHelper(content);
  }

  // e.g. {{foo.value}} or {{{unescaped_html.value}}} statements
  MustacheStatement(mustache: hbs.AST.MustacheStatement) {
    if (mustache.escaped) {
      return this.mergeIntoTextHelper(mustache);
    } else {
      const block = wrapIntoBlock(SystemHelpers.DYNAMIC_HTML, mustache);
      this.hasDynamicHtml = true;
      return block;
    }
  }

  BlockStatement(block: hbs.AST.BlockStatement) {
    const helperName = getHelperName(block);
    if (helperName === SystemHelpers.ATTRIBUTE || helperName === SystemHelpers.TEXT) {
      return;
    } else {
      return super.BlockStatement(block);
    }
  }

  private mergeIntoTextHelper(statement: hbs.AST.Statement) {
    if (this.lastWrapped) {
      this.lastWrapped.program.body.push(statement);
      return false;
    } else {
      const block = wrapIntoBlock(SystemHelpers.TEXT, statement);
      this.lastWrapped = block;
      return block;
    }
  }
}

function wrapIntoBlock(blockName: string, statement: hbs.AST.Statement): hbs.AST.BlockStatement {
  return {
    type: 'BlockStatement',
    path: {
      type: 'PathExpression',
      parts: [blockName],
      loc: statement.loc,
      original: blockName,
      depth: 0,
      data: false,
    },
    params: [],
    loc: statement.loc,
    openStrip: {open: false, close: false},
    closeStrip: {open: false, close: false},
    hash: undefined,
    inverse: undefined,
    inverseStrip: undefined,
    program: {
      type: 'Program',
      loc: statement.loc,
      blockParams: undefined,
      body: [
        statement,
      ]
    }
  };
}

function getHelperName(block: hbs.AST.BlockStatement): string | undefined {
  const parts = block.path.parts;
  return parts.length === 1 ? parts[0] : undefined;
}

class RemoteTemplateScanner extends Handlebars.Visitor {
  readonly localReferences = new Set<string>();
  readonly remoteReferences = new Set<string>();

  PartialStatement(partial: hbs.AST.PartialStatement): void {
    this.addReference(partial);
  }

  PartialBlockStatement(partial: hbs.AST.PartialBlockStatement): void {
    this.addReference(partial);
  }

  private addReference(partial: hbs.AST.PartialStatement | hbs.AST.PartialBlockStatement) {
    const name = this.getPartialName(partial.name);
    // exclude special partial names, e.g. @partial-block
    if (name && name.indexOf('@') !== 0) {
      if (isRemoteReference(name)) {
        this.remoteReferences.add(name);
      } else {
        this.localReferences.add(name);
      }
    }
  }

  private getPartialName(name: hbs.AST.PathExpression | hbs.AST.SubExpression) {
    if (name.type === 'PathExpression') {
      const path = name as hbs.AST.PathExpression;
      if (path.parts.length === 1) {
        return path.original;
      }
    }
    return undefined;
  }
}

function escapePartialReferences(content: string): string {
  if (content.indexOf('{{#>') >= 0) {
    throw new Error('Partial blocks ({{#>) are disallowed in the inline templates');
  }
  return content.replace(/({{>[^}]+}})/g, `{{{{raw}}}}$1{{{{/raw}}}}`);
}

/**
 * We simply skip (ignore) empty text nodes here in the processing instructions.
 */
export function isNonEmptyNode(node: Node): boolean {
  return !(node.type === 'text' && _.trim(node.data).length === 0);
}

/**
 * Returns concatenated outer HTML markup of the nodes.
 */
export function renderHtml(nodes: ReadonlyArray<Node>): string {
  // FIXME: properly handle nested templates and captured context
  // (probably just ignore the latter)
  return nodes.map(render).join('\n');
}

const IDENTITY_HTML_PARSER = new HtmlParser<Node>(null);
const IDENTITY_PROCESSING_INSTRUCTIONS: Instruction<Node>[] = [
  {
    shouldProcessNode: node => true,
    processNode: node => node,
  },
];

export function parseHtml(source: string): Node[] {
  /*
   * Because html-to-react expects html with single root node as an input,
   * we need to wrap html into artificial div node. After parsing it's children
   * will correspond to initial html.
   */
  const root = IDENTITY_HTML_PARSER.parseWithInstructions(
    `<div>${source}</div>`,
    isNonEmptyNode,
    IDENTITY_PROCESSING_INSTRUCTIONS
  );
  return root.children;
}
