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
import {
  ReactElement,
  ReactNode,
  createElement,
  CSSProperties,
  ComponentClass,
  FunctionComponent,
} from 'react';
import * as D from 'react-dom-factories';

import * as assign from 'object-assign';
import * as _ from 'lodash';
import * as React from 'react';
import * as he from 'he';
import { Parser as ToReactParser, ProcessNodeDefinitions, Node, Instruction } from 'html-to-react';
import * as Kefir from 'kefir';
import * as jsonlint from 'jsonlint-mod';

import {
  DataContext, TemplateScope, RawTemplateScope, extractTemplates, findImportedComponents,
  isNonEmptyNode, isTemplate, matchJsonAttributeValue, parseHtml, renderHtml,
  RAW_TEMPLATES_ATTRIBUTE, CAPTURED_DATA_CONTEXT_ATTRIBUTE,
} from 'platform/api/services/template';
import { ComponentProps } from 'platform/api/components';
import { WrappingError } from 'platform/api/async';
import { FormattedError } from 'platform/components/ui/notification/FormattedError';

import { loadPermittedComponents, isComponentPermittedSync } from './ComponentBasedSecurity';
import {
  hasComponent, isRegisteredNativeComponent, loadComponents, loadComponentSync,
} from './ComponentsStore';
import { safeReactCreateElement } from './ReactErrorCatcher';

const processNodeDefinitions = new ProcessNodeDefinitions(React);

/*
 * Intercept calls to customElements.define to track all custom components.
 */
const originalRegisterElement = customElements.define.bind(customElements);
customElements.define = function(
  name: string, constructor: CustomElementConstructor, options?: ElementDefinitionOptions
) {
  return originalRegisterElement(name, constructor, options);
};

/**
 * Register react component as a web-component.
 *
 * At rendering time html tag instantiated with corresponding react component.
 * Attributes are propagated as props with some transformations:
 *  1) 'data-' prefix is stripped.
 *  2) names are translated to camel-case se. e.g "data-event-key" corresponds
 *     to "eventKey" property.
 *  3) attribute value is parsed as JSON.
 *
 * Example:
 *  html:
 *    <bs-tab data-event-key="1" data-title="Tab 1">
 *      Some Content
 *    </bs-tab>
 *
 *  react:
 *    Tab({eventKey: '1', title: 'Tab 1'}, 'Some Content')
 */
export function init() {/**/}

/**
 * When we parse custom component attributes we save raw style attribute into
 * __style variable,
 * because original style is parsed to be in line with react style syntax.
 * But raw style string can be useful when we want to propagate style to DOM element
 * managed outside React. E.g. CytoscapeNavigator component.
 */
export const RAW_STYLE_ATTRIBUTE = '__style';

const PROCESSING_INSTRUCTIONS = getProcessingInstructions(false);
const PROCESSING_INSTRUCTIONS_USE_RANDOM_KEY = getProcessingInstructions(true);

function getProcessingInstructions(
  useRandomKey: boolean
): Instruction<React.ReactElement<any>>[] {
  return [
    {
      shouldProcessNode: isCodeExample,
      processNode: processCode('mp-code-example'),
    },
    {
      shouldProcessNode: isCode,
      processNode: processCode('mp-code-highlight'),
    },
    {
      shouldProcessNode: isCodeBlock,
      processNode: processCode('mp-code-block'),
    },
    {
      shouldProcessNode: isCodeChild,
      processNode: skipNode,
    },
    {
      shouldProcessNode: isStyle,
      processNode: processStyle,
    },
    {
      shouldProcessNode: isStyleChild,
      processNode: skipNode,
    },
    {
      shouldProcessNode: isReactComponent,
      processNode: processReactComponent(useRandomKey),
    },
    {
      shouldProcessNode: isNativeComponent,
      processNode: processNativeComponent,
    },
    {
      shouldProcessNode: node => !isTemplate(node),
      processNode: processDefaultNode,
    },
  ];
}

const TO_REACT_PARSER = new ToReactParser(React, {recognizeCDATA: true});

/**
 * Parse HTML string into ReactElements hierarchy.
 * @param html Plain html string to be parsed to React.
 * @return Array of React nodes
 */
export function parseHtmlToReact(
  html: string,
  allowTemplateMode = false,
  useRandomKey = false
): Kefir.Property<ReactElement<any> | ReactElement<any>[]> {
  let nodes: Node[];
  try {
    nodes = parseHtml(html);
  } catch (err) {
    return Kefir.constantError<any>(err);
  }

  if (allowTemplateMode && nodes.find(isEnablePageTemplateMetaTag)) {
    // TODO: decide if we want to support "page is a template" mode
    // where template constructs are available at the top level
    return TemplateScope.empty().prepare(html).map(compiledTemplate => {
      const renderedNodes = compiledTemplate({context: undefined});
      return mapHtmlTreeToReact(renderedNodes, useRandomKey);
    });
  } else {
    const importedComponents = findImportedComponents(nodes);
    return loadPermittedComponents(importedComponents)
      .flatMap(permittedComponents =>
        Kefir.fromPromise(loadComponents(permittedComponents))
      )
      .flatMap<ReactElement<any> | ReactElement<any>>(() => {
        try {
          const reactElements = mapHtmlTreeToReact(nodes, useRandomKey);
          return Kefir.constant(reactElements);
        } catch (err) {
          return Kefir.constantError<any>(err);
        }
      })
      .toProperty();
  }
}

// TODO: discuss this backwards compatibility flag
function isEnablePageTemplateMetaTag(node: Node) {
  return Boolean(
    node.type === 'tag' &&
    node.name === 'meta' &&
    node.attribs &&
    node.attribs['name'] === 'mp-page-experimental-template-mode' &&
    node.attribs['content'] === 'true'
  );
}

export function mapHtmlTreeToReact(
  tree: Node[], useRandomKey = false
): ReactElement<any> | ReactElement<any>[] {
  if (tree.length === 0) {
    return [];
  }

  const root: Node = {
    type: 'tag',
    name: 'div',
    children: tree,
  };

  const mapped = TO_REACT_PARSER.mapParsedTree(
    [root],
    isNonEmptyNode,
    useRandomKey ? PROCESSING_INSTRUCTIONS_USE_RANDOM_KEY : PROCESSING_INSTRUCTIONS
  ).props.children;

  if (Array.isArray(mapped)) {
    if (mapped.length === 0) {
      return null;
    } else if (mapped.length === 1) {
      return mapped[0];
    }
  }
  return mapped;
}

export function isWebComponent(componentTag: string) {
  return hasComponent(componentTag);
}

/**
 * Creates ReactElement for corresponding html-tag with
 * provided props, children and templateScope
 */
export function renderWebComponent(
  componentTag: string,
  props: Object,
  children?: ReactNode[],
  templateScope?: TemplateScope,
  dataContext?: DataContext
): ReactElement<any> | null {
  // check if user is permitted to use the component
  // if not it will not be rendered at all
  if (!isComponentPermittedSync(componentTag)) {
    return null;
  }
  const component = loadComponentSync(componentTag);
  if (typeof component === 'string') {
    return React.createElement(component, props, children);
  }
  templateScope = templateScope || TemplateScope.empty();
  return createElementWithTemplateScope(
    component, props, children, templateScope, dataContext
  );
}

function processDefaultNode(
  node: Node, children: Array<ReactElement<any>>
): ReactElement<any> | Array<ReactElement<any>> {
  const decodedNode: Node = {
    ...node,
    // 'html-to-react' does not decode attributes so it needs to be done separately
    attribs: decodeHtmlEntitiesInAttributes(node.attribs),
  };
  return processNodeDefinitions.processDefaultNode(decodedNode, children);
}

function isCode(node: Node): boolean {
  return node.name === 'code';
}

function isCodeExample(node: Node): boolean {
  return node.name === 'mp-code-example';
}

function isCodeBlock(node: Node): boolean {
  return node.name === 'mp-code-block';
}

function isCodeChild(node: Node): boolean {
  return node.parent &&
    (node.parent.name === 'code' || node.parent.name === 'mp-code-example'
     || node.parent.name === 'mp-code-block');
}

function isStyle(node: Node): boolean {
  return node.name === 'style';
}

function isStyleChild(node: Node): boolean {
  return node.parent && node.parent.name === 'style';
}

function isReactComponent(node: Node): boolean {
  return hasComponent(node.name) && !isRegisteredNativeComponent(node.name);
}

function isNativeComponent(node: Node): boolean {
  if (node.type !== 'tag') { return false; }
  if (hasComponent(node.name)) {
    return isRegisteredNativeComponent(node.name);
  } else {
    // according to specification name of the custom element must contain dash.
    // see https://developer.mozilla.org/en-US/docs/Web/API/CustomElementRegistry/define
    return node.name.indexOf('-') >= 0;
  }
}

function processNativeComponent(
  node: Node, children: Array<ReactNode>
): ReactElement<any> {
  let decodedAttrs: { [attrName: string]: unknown };
  try {
    decodedAttrs = decodeHtmlEntitiesInAttributes(node.attribs);
  } catch (e) {
    throw new WrappingError(
      `Error while processing attributes for web component \"${node.name}\":`, e);
  }
  return React.createElement(node.name, decodedAttrs, children);
}

/**
 * Properly handle children for code visualization components.
 */
function processCode(codeComponent: 'mp-code-example' | 'mp-code-highlight' | 'mp-code-block') {
  return function(
    node: Node, children: Array<React.ReactNode>
  ): React.ReactElement<any> {
    const innerCode = _.trim(he.decode(renderHtml(node.children)));
    const attributes = htmlAttributesToReactProps(node.attribs);

    // remove CDATA wrapper if it is present
    const codeToHighlight =
      innerCode.replace('<!--[CDATA[', '').replace(']]-->' , '');

    const component = loadComponentSync(codeComponent);
    return createElement(
      component,
      assign({codeText: codeToHighlight}, attributes)
    );
  };
}


function skipNode(
  node: Node, children: Array<React.ReactNode>
): React.ReactElement<any> {
  return null;
}

function processStyle(
  node: Node, children: Array<React.ReactNode>
): React.ReactElement<any> {
  // return for empty style tags i.e. uBlock browser extension may inject these
  const styleNode = !node.children[0]
    ? D.style()
    : D.style({dangerouslySetInnerHTML: { __html: node.children[0].data}}, null );

  return styleNode;
}

function processReactComponent(
  useRandomKey: boolean
) {
  return function(node: Node, children: Array<ReactNode>) {
    let attributes: { key?: string; fixedKey?: string, useRandomKey?: boolean };
    try {
      const decodedAttrs = decodeHtmlEntitiesInAttributes(node.attribs);
      attributes = htmlAttributesToReactProps(decodedAttrs);
    } catch (e) {
      if (e instanceof FormattedError) {
        throw e;
      } else {
        const msg = `Error while processing attributes for component \"${node.name}\":
      ' + ${e.message}`;
        throw new Error(msg);
      }
    }

    let computedKey: string;
    if (attributes['fixedKey']) {
      computedKey = attributes['fixedKey'];
    } else if (attributes['key']) {
      computedKey = attributes['key'];
    } else if (useRandomKey || attributes['useRandomKey']) {
      computedKey = Math.random().toString(36).slice(2);
    }
    let props = {...attributes, key: computedKey} as { [key: string]: any };

    // handle nested config for semantic components
    if (_.startsWith(node.name, 'semantic')) {
      if (!_.isUndefined(props['config'])) {
        const nestedProps = _.transform(
          props['config'],
          (acc: { [attr: string]: string }, val: string, key: string) => {
            acc[attributeName(key)] = val;
            return acc;
          }, {}
        );
        props = assign(props, nestedProps);
      }
    }

    let templateScope: TemplateScope = undefined;
    try {
      templateScope = extractTemplateScope(node);
    } catch (error) {
      throw new WrappingError(`Invalid template markup at <${node.name}>`, error);
    }
    const dataContext = extractDataContext(node);
    return renderWebComponent(node.name, props, children, templateScope, dataContext);
  };
}

/**
 * Creates a template scope derived from default one and registers
 * local templates from the node.
 */
function extractTemplateScope(node: Node): TemplateScope | undefined {
  if (node.attribs[RAW_TEMPLATES_ATTRIBUTE]) {
    const templates = node.attribs[RAW_TEMPLATES_ATTRIBUTE] as RawTemplateScope;
    return TemplateScope.fromTemplates(templates);
  } else if (nodeHasTemplate(node)) {
    const templates: RawTemplateScope = new Map();
    for (const template of extractTemplates(node)) {
      templates.set(template.localName, template);
    }
    return TemplateScope.fromTemplates(templates);
  }
  return undefined;
}

function extractDataContext(node: Node): DataContext | undefined {
  if (node.attribs[CAPTURED_DATA_CONTEXT_ATTRIBUTE]) {
    return node.attribs[CAPTURED_DATA_CONTEXT_ATTRIBUTE] as DataContext;
  }
  return undefined;
}

function nodeHasTemplate(node: Node) {
  if (!node.children) {
    return false;
  }
  for (const child of node.children) {
    if (isTemplate(child)) {
      return true;
    }
  }
  return false;
}

function createElementWithTemplateScope(
  component: ComponentClass<any> | FunctionComponent,
  componentProps: any,
  children: ReactNode[],
  templateScope: TemplateScope,
  dataContext: DataContext | undefined
): ReactElement<any> {
  if (!component) {
    throw new Error('Failed to create component with undefined type');
  }
  let props = componentProps;
  if (component.propTypes) {
    const propTypes = component.propTypes as { [K in keyof ComponentProps]: any; };
    if (propTypes.markupTemplateScope) {
      // provide template context if component accepts it in props
      const scopeProps: Partial<ComponentProps> = {
        markupTemplateScope: templateScope,
        markupDataContext: dataContext,
      };
      props = {...props, ...scopeProps};
    }
  }
  return safeReactCreateElement.apply<unknown, any[], any>(
    null, [component, props].concat(children));
}

function decodeHtmlEntitiesInAttributes(
  attrs: { [attrName: string]: unknown }
): { [attrName: string]: unknown } {
  const decoded: { [attrName: string]: unknown } = {};
  for (const attrName in attrs) {
    if (!Object.prototype.hasOwnProperty.call(attrs, attrName)) { continue; }
    const attrValue = attrs[attrName];
    decoded[attrName] = typeof attrValue === 'string'
      ? he.decode(attrValue)
      : attrValue;
  }
  return decoded;
}

/**
 * Use helper functions from reactive-elements to convert html attributes to react props.
 */
function htmlAttributesToReactProps(attribs: { [key: string]: unknown }): {} {
  return _.transform(
    attribs,
    (acc: { [attrName: string]: unknown }, val: unknown, key: string) => {
      if (key === RAW_TEMPLATES_ATTRIBUTE || key === CAPTURED_DATA_CONTEXT_ATTRIBUTE) {
        /* skip */
      } else if (key === 'style') {
        acc[attributeName(key)] = parseReactStyleFromCss(attributeValue(key, val));
        // save raw style attribute
        acc[RAW_STYLE_ATTRIBUTE] = attributeValue(key, val);
      } else {
        acc[attributeName(key)] = attributeValue(key, val);
      }
      return acc;
    }, {}
  );
}

function attributeName(name: string): string {
  if (name === 'class') {
    return 'className';
  } if (name === 'data-flex-layout' || name === 'data-flex-self') {
    // we need to propagate data-layout and data-layout-self as is to support
    // styling with https://github.com/StefanKovac/flex-layout-attribute
    return name;
  } else {
    return attributeNameToPropertyName(name);
  }
}

function attributeNameToPropertyName(attrName: string): string {
  return attrName
    .replace(/^(x|data)[-_:]/i, '')
    .replace(/[-_:](.)/g, (x, chr) => chr.toUpperCase());
}

function attributeValue(name: string, val: unknown): any {
  if (typeof val !== 'string') {
    return val;
  }

  // custom handling for boolean attributes.
  // replace with something more generic, like https://github.com/YousefED/typescript-json-schema
  if (val === 'true' || val === 'false') {
    return JSON.parse(val);
  } else if (isNumberAttributeValue(val) && !Number.isNaN(+val)) {
    // custom handling for number attributes
    return +val;
  } else {
    return parseJsonAttributeValue(name, val);
  }
}

function isNumberAttributeValue(value: string): boolean {
  return /^[+-]?[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/.test(value);
}

function parseJsonAttributeValue(name: string, value: string) {
  if (!value) {
    return value;
  }

  const jsonMatch = matchJsonAttributeValue(value);
  if (jsonMatch !== null) {
    try {
      value = JSON.parse(jsonMatch);
    } catch (e) {
      try {
        jsonlint.parse(jsonMatch);
      } catch (e2) {
        const msg = `Failed to parse value for attribute \"${name}\" as JSON.
          Details`;
        throw new FormattedError(D.pre({}, FormattedError.concatMessage(msg, e2)), msg, e2);
      }
    }
  }

  return value;
}

export function parseReactStyleFromCss(cssStyle: string | undefined | null): CSSProperties {
  if (!cssStyle) {
    return {};
  }
  const styles = cssStyle.split(';');
  const jsonStyles: CSSProperties = {};
  for (const styleEntry of styles) {
    const separatorIndex = styleEntry.indexOf(':');
    if (separatorIndex <= 0 || separatorIndex === styleEntry.length - 1) {
      continue;
    }
    const key = _.camelCase(styleEntry.substring(0, separatorIndex));
    const value = styleEntry.substring(separatorIndex + 1);
    (jsonStyles as any)[key] = value;
  }
  return jsonStyles;
}
