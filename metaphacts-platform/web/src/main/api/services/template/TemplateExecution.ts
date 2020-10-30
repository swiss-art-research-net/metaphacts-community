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
import { Node } from 'html-to-react';
import * as Handlebars from 'handlebars';

import { SparqlUtil } from 'platform/api/sparql';
import { hasComponent } from 'platform/api/module-loader/ComponentsStore';

import { DataContext, HandlebarsDataStack, cloneDataStack } from './DataContext';
import {
  ExtractedNode, ExtractedTemplate, SystemHelpers, isRemoteReference, parseHtml,
  getTransformedAttribute, preserveTagContent, findImportedComponents,
} from './TemplateParser';
import { makeJsonTemplateReviver } from './JsonTemplateParser';

export const RAW_TEMPLATES_ATTRIBUTE = '__rawTemplates';
export const CAPTURED_DATA_CONTEXT_ATTRIBUTE = '__capturedDataContext';

/**
 * Allowed component tags when rendering "unescaped" value, e.g. {{{foo.value}}}.
 *
 * This set should be kept as short as possible because all components here
 * will be preloaded when preparing template which may render dynamic HTML
 * (even indirectly from referenced local or remote templates).
 */
export const ALLOWED_DYNAMIC_HTML_COMPONENTS: ReadonlySet<string> = new Set<string>([
  'mp-code-highlight', // required because <code> tag maps to <mp-code-highlight>
]);

export type RawTemplateScope = Map<string, ExtractedTemplate>;

interface SystemHelperOptions {
  data?: RenderingDataStack;
  fn: (context: unknown) => string;
  hash?: { [key: string]: unknown };
}

interface RenderingDataStack extends HandlebarsDataStack {
  root?: {
    __renderingContext?: RenderingContext;
  }
}

interface RenderingContext {
  readonly node: ExtractedNode | undefined;
  readonly nodeSource: ExtractedTemplate | undefined;
  insideAttribute: boolean;
  jsonParts?: unknown[];
  getSource(uniqueKey: number): ExtractedTemplate;
  pushNode(node: ExtractedNode, source: ExtractedTemplate): void;
  popNode(): void;
}

function systemNodeHelper(
  this: unknown,
  tagName: string,
  sourceKey: number,
  nodeIndex: number,
  options: SystemHelperOptions
) {
  if (typeof sourceKey !== 'number') {
    throw new Error('Missing source template key in system node helper');
  }
  if (typeof nodeIndex !== 'number') {
    throw new Error('Missing node index in system node helper');
  }

  const data: RenderingDataStack | undefined = options ? options.data : undefined;
  if (!data) {
    throw new Error('Missing data stack in system node helper');
  }

  const context = data.root.__renderingContext;
  if (context.insideAttribute) {
    // disallow node rendering inside computed attributes
    return;
  }

  const nodeSource = context.getSource(sourceKey);
  const node = nodeSource.nodes[nodeIndex];
  if (!node) {
    throw new Error('Invalid node index in system node helper');
  }

  const nodeClone: Node = {
    ...node,
    // TODO: use deep clone for element props?
    // Currently node attributes is always a string to string map,
    // so shallow clone should be enough.
    attribs: {...node.attribs},
    parent: undefined,
    // TODO: use deep clone for children?
    // (only shallow clone required for <code>, <mp-code-highlight>, etc)
    children: preserveTagContent(node.name) ? [...node.children] : [],
  };
  context.pushNode(nodeClone, nodeSource);
  options.fn(this);
  context.popNode();

  // capture data context if node has any nested templates
  if (nodeSource.captureContextAt.has(nodeIndex)) {
    const capturedContext: DataContext = {
      context: this,
      data: cloneDataStack(data),
    };
    nodeClone.attribs[CAPTURED_DATA_CONTEXT_ATTRIBUTE] = capturedContext;
  }

  if (context.node) {
    nodeClone.parent = context.node;
    context.node.children.push(nodeClone);
  }
}

function systemAttributeHelper(this: unknown, attrName: string, options: SystemHelperOptions) {
  if (typeof attrName !== 'string') {
    throw new Error('Missing attribute name in system attribute helper');
  }

  const data: RenderingDataStack | undefined = options ? options.data : undefined;
  if (!data) {
    throw new Error('Missing data stack in system attribute helper');
  }

  const context = data.root.__renderingContext;
  if (context.insideAttribute) {
    throw new Error('Cannot compute attribute value inside another attribute');
  }
  context.insideAttribute = true;
  let attrValue: unknown;
  if (options.hash.json) {
    const sourceJson = getTransformedAttribute(context.node, attrName);
    if (typeof sourceJson !== 'string') {
      throw new Error('Missing or unexpected non-JSON attribute value for JSON template');
    }

    const parts: unknown[] = [];
    context.jsonParts = parts;
    options.fn(this);
    context.jsonParts = undefined;

    const reviver = makeJsonTemplateReviver(parts);
    attrValue = JSON.parse(sourceJson, reviver);
  } else {
    attrValue = options.fn(this);
  }
  context.insideAttribute = false;
  context.node.attribs[attrName] = attrValue;
}

function systemTemplateHelper(this: unknown, templateIndex: string, options: SystemHelperOptions) {
  if (typeof templateIndex !== 'number') {
    throw new Error('Missing child template index in system template helper');
  }

  const data: RenderingDataStack | undefined = options ? options.data : undefined;
  if (!data) {
    throw new Error('Missing data stack in system template helper');
  }

  const context = data.root.__renderingContext;
  const template = context.nodeSource.childTemplates[templateIndex];
  if (!template) {
    throw new Error('Invalid template index in system template helper');
  }

  let rawTemplates = (
    context.node.attribs[RAW_TEMPLATES_ATTRIBUTE]
  ) as RawTemplateScope | undefined;
  if (!rawTemplates) {
    rawTemplates = new Map<string, ExtractedTemplate>();
    context.node.attribs[RAW_TEMPLATES_ATTRIBUTE] = rawTemplates;
  }
  rawTemplates.set(template.localName, template);
}

function systemTextHelper(this: unknown, options: SystemHelperOptions) {
  const data: RenderingDataStack | undefined = options ? options.data : undefined;
  if (!data) {
    throw new Error('Missing data stack in system text helper');
  }

  const context = data.root.__renderingContext;
  const textValue = options.fn(this);
  context.node.children.push({
    type: 'text',
    data: textValue,
  });
}

function systemDynamicHtmlHelper(this: unknown, options: SystemHelperOptions) {
  const data: RenderingDataStack | undefined = options ? options.data : undefined;
  if (!data) {
    throw new Error('Missing data stack in system dynamic HTML helper');
  }

  const context = data.root.__renderingContext;
  const rawHtml = options.fn(this);
  const nodes = parseHtml(rawHtml);

  const importedComponents = findImportedComponents(nodes);
  importedComponents.forEach(tagName => {
    if (hasComponent(tagName) && !ALLOWED_DYNAMIC_HTML_COMPONENTS.has(tagName)) {
      throw new Error(
        `Platform component tags are disallowed in dynamic HTML inside templates: <${tagName}>`
      );
    }
  });

  for (const node of nodes) {
    context.node.children.push(node);
  }
}

function systemJsonPartHelper(this: unknown, options: SystemHelperOptions) {
  const data: RenderingDataStack | undefined = options ? options.data : undefined;
  if (!data) {
    throw new Error('Missing data stack in system JSON part helper');
  }

  const context = data.root.__renderingContext;
  if (!context.jsonParts) {
    throw new Error('Cannot evaluate system JSON part helper in non-JSON template context');
  }

  const partValue = options.fn(this);
  context.jsonParts.push(partValue);
}

export function renderTemplate(
  compiledSource: HandlebarsTemplateDelegate,
  getSource: (sourceKey: number) => ExtractedTemplate,
  context: unknown,
  dataStack: HandlebarsDataStack
): Node[] {
  const renderingDataStack: RenderingDataStack = cloneDataStack(dataStack);
  const syntheticRoot: Node = {
    type: 'tag',
    children: [],
  };
  const nodeStack: Node[] = [syntheticRoot];
  const sourceStack: Array<ExtractedTemplate | null> = [null];
  if (!renderingDataStack.root) {
    renderingDataStack.root = {};
  }
  renderingDataStack.root.__renderingContext = {
    get node() {
      return nodeStack.length === 0
        ? undefined : nodeStack[nodeStack.length - 1];
    },
    get nodeSource() {
      return sourceStack.length === 0
        ? undefined : sourceStack[sourceStack.length - 1];
    },
    insideAttribute: false,
    getSource(sourceKey: number) {
      const template = getSource(sourceKey);
      if (!template) {
        throw new Error('Failed to find template source');
      }
      return template;
    },
    pushNode(node: Node, nodeSource: ExtractedTemplate) {
      nodeStack.push(node);
      sourceStack.push(nodeSource);
    },
    popNode() {
      nodeStack.pop();
      sourceStack.pop();
    }
  };
  compiledSource(context, {data: renderingDataStack});
  return syntheticRoot.children;
}

interface HandlebarsAPI {
  JavaScriptCompiler?: HandlebarsJavaScriptCompilerConstructor;
}

interface HandlebarsJavaScriptCompilerConstructor {
  new(...args: any[]): HandlebarsJavaScriptCompiler;
}

interface HandlebarsJavaScriptCompiler {
  nameLookup(parent: any, name: any, type: string): any;
  /**
   * Undocumented reference to constructor function of itself.
   * Nested partials compilation will use default JavaScriptCompiler if this field isn't set to
   * derived compiler's constructor function.
   */
   // See `compiler: JavaScriptCompiler` field here:
   // tslint:disable-next-line:max-line-length
   // https://github.com/wycats/handlebars.js/blob/714a4c448281aef44bcafc4d9e4ecf32ed063b8b/lib/handlebars/compiler/javascript-compiler.js#L695
  compiler?: HandlebarsJavaScriptCompilerConstructor;
}

/**
 * Handlebars runtime compiler with added ability to resolve partial name
 * specified as short prefixed IRI using platform-wide registered prefixes.
 */
class IRIResolvingCompiler extends (Handlebars as HandlebarsAPI).JavaScriptCompiler {
  nameLookup(parent: any, name: any, type: string) {
    if (type === 'partial' && typeof name === 'string' && isRemoteReference(name)) {
      const [iri] = SparqlUtil.resolveIris([name]);
      return super.nameLookup(parent, iri.value, type);
    }
    return super.nameLookup(parent, name, type);
  }
}
IRIResolvingCompiler.prototype.compiler = IRIResolvingCompiler;

export function createTemplateRenderingHandlebars() {
  const handlebars = Handlebars.create();
  (handlebars as HandlebarsAPI).JavaScriptCompiler = IRIResolvingCompiler;
  handlebars.registerHelper(SystemHelpers.NODE, systemNodeHelper);
  handlebars.registerHelper(SystemHelpers.TEXT, systemTextHelper);
  handlebars.registerHelper(SystemHelpers.ATTRIBUTE, systemAttributeHelper);
  handlebars.registerHelper(SystemHelpers.TEMPLATE, systemTemplateHelper);
  handlebars.registerHelper(SystemHelpers.DYNAMIC_HTML, systemDynamicHtmlHelper);
  handlebars.registerHelper(SystemHelpers.JSON_PART, systemJsonPartHelper);
  return handlebars;
}
