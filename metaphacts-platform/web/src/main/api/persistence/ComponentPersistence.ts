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
import { ReactElement, Props, Children } from 'react';
import { fromNullable } from 'data.maybe';

import { ComponentProps, SemanticContext } from 'platform/api/components';
import { serialize, deserialize } from 'platform/api/json';
import { ComponentClassMetadata } from 'platform/api/module-loader';
import { Rdf, ObjectGraph } from 'platform/api/rdf';
import { rdf, persist } from 'platform/api/rdf/vocabularies';
import { QueryContext } from 'platform/api/sparql';
import { TemplateScope, TemplateScopeProps } from 'platform/api/services/template';

interface RawComponentContext {
  templateProps: TemplateScopeProps;
  semanticContext?: QueryContext;
}

/**
 * Serializes any React DOM element or platform component registered in `component.json`
 * into RDF graph. Component's props must contain only serializable values (primitives,
 * arrays, raw objects).
 *
 * @see ActionSaveComponent
 * @see PersistedComponent
 */
export function componentToGraph(params: {
  /** Serialized component. */
  component: ReactElement<any>;
  /** Pointer to root component structure withing the result graph. */
  componentRoot: Rdf.Iri | Rdf.BNode;
  /**
   * Effective template scope from outer React context for the component.
   *
   * This value is available through `PlatformComponent.appliedTemplateScope` of parent component
   * and required if the component uses any templates from parent scope.
   */
  parentTemplateScope?: TemplateScope;
  /** Semantic context from outer React context for the component. */
  semanticContext?: QueryContext;
}): Rdf.PointedGraph {
  const {component, componentRoot, parentTemplateScope, semanticContext} = params;

  const htmlTag = (
    typeof component.type === 'string' ? component.type :
    typeof component.type === 'function' ? (component.type as ComponentClassMetadata).__htmlTag :
    undefined
  );
  if (!htmlTag) {
    throw new Error('Cannot serialize component with unknown HTML tag');
  }

  const componentNamespace = Rdf.iri(persist.COMPONENT_TYPE_PREFIX + htmlTag);
  type CustomComponentProps = Props<any> & ComponentProps;
  const {markupTemplateScope, children, ...otherProps} = component.props as CustomComponentProps;

  const appliedScope = markupTemplateScope || parentTemplateScope || TemplateScope.empty();

  const propsGraph = ObjectGraph.serialize(otherProps, componentNamespace);
  const result = propsGraph.graph.triples.toArray();
  result.push(
    Rdf.triple(componentRoot, rdf.type, persist.PersistedComponent),
    Rdf.triple(componentRoot, persist.componentType, componentNamespace),
    Rdf.triple(componentRoot, persist.componentProps, propsGraph.pointer),
  );

  if (children && Children.count(children) > 0) {
    const serializedChildren = Children.toArray(children).map((child, index) => componentToGraph({
      component: child as any,
      componentRoot: Rdf.bnode(),
      parentTemplateScope: appliedScope,
    }));
    const childrenGraph = ObjectGraph.serializeArray(serializedChildren, child => child);
    result.push(...childrenGraph.graph.triples.toArray());
    result.push(Rdf.triple(componentRoot, persist.componentChildren, childrenGraph.pointer));
  }

  if (isCustomElementTag(htmlTag)) {
    const rawContext: RawComponentContext = {
      templateProps: appliedScope.exportProps(),
      semanticContext,
    };
    const contextGraph = ObjectGraph.serialize(serialize(rawContext), persist.componentContext);
    result.push(...contextGraph.graph.triples.toArray());
    result.push(Rdf.triple(componentRoot, persist.componentContext, contextGraph.pointer));
  }

  return Rdf.pg(componentRoot, Rdf.graph(result));
}

export interface DeserializedComponent {
  type: string;
  props: any;
  children: DeserializedComponent[];
}

export interface DeserializationResult {
  component: DeserializedComponent;
  context: SemanticContext;
}

/**
 * Deserializes a platform component from an RDF graph generated by `componentToGraph()`.
 */
export function graphToComponent(root: Rdf.Node, graph: Rdf.Graph): DeserializationResult {
  const componentTypeTriple = graph.triples.filter(t =>
    t.s.equals(root) && t.p.equals(persist.componentType)
  ).first();
  if (!componentTypeTriple) {
    throw new Error(`Missing componentType for ${root}`);
  }
  const componentType = componentTypeTriple.o.value;

  const componentPropsTriple = graph.triples.filter(t =>
    t.s.equals(root) && t.p.equals(persist.componentProps) && Rdf.isNode(t.o)
  ).first();
  if (!componentPropsTriple) {
    throw new Error(`Missing componentProps for ${root}`);
  }
  const componentProps = componentPropsTriple.o as Rdf.Node;

  const componentChildrenRoot = fromNullable(graph.triples.filter(t =>
    t.s.equals(root) && t.p.equals(persist.componentChildren) && Rdf.isNode(t.o)
  ).first()).map(t => t.o as Rdf.Node);
  const componentContextRoot = fromNullable(graph.triples.filter(t =>
    t.s.equals(root) && t.p.equals(persist.componentContext) && Rdf.isNode(t.o)
  ).first()).map(t => t.o as Rdf.Node);

  if (!componentType.startsWith(persist.COMPONENT_TYPE_PREFIX)) {
    throw new Error(`Invalid componentType <${componentType}> for ${root}`);
  }

  const type = componentType.substr(persist.COMPONENT_TYPE_PREFIX.length);
  let props: Props<any> & ComponentProps = ObjectGraph.deserialize(componentProps, graph);
  let children: DeserializedComponent[] = [];
  let context: SemanticContext = {semanticContext: {}};

  if (componentChildrenRoot.isJust) {
    children = ObjectGraph.deserializeArray(
      componentChildrenRoot.get(),
      graph,
      pointer => {
        // discard child's context (it should be empty)
        const {component} = graphToComponent(pointer, graph);
        return component;
      },
    );
  }

  if (isCustomElementTag(type) && componentContextRoot.isJust) {
    const {semanticContext, templateProps} = deserialize<RawComponentContext>(
      ObjectGraph.deserialize(componentContextRoot.get(), graph)
    );
    context = {semanticContext};
    props = {
      ...props,
      markupTemplateScope: TemplateScope.fromProps(templateProps),
    };
  }

  const component: DeserializedComponent = {
    type,
    props: props as any,
    children,
  };
  return {component, context};
}

function isCustomElementTag(tagName: string): boolean {
  return tagName.indexOf('-') >= 0;
}
