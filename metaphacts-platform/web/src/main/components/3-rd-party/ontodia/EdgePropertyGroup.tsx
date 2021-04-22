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
import * as Immutable from 'immutable';
import * as Kefir from 'kefir';
import * as React from 'react';
import * as Ontodia from 'ontodia';

import { Cancellation, KeyedBufferPool } from 'platform/api/async';
import { Component, ComponentContext, ContextTypes } from 'platform/api/components';
import { mapHtmlTreeToReact } from 'platform/api/module-loader/Registry';
import { Rdf } from 'platform/api/rdf';

import { CompiledTemplate, mergeInContextOverride } from 'platform/api/services/template';

export interface EdgePropertyStyle {
  readonly position?: number;
  readonly title?: string;
  /**
   * @TJS-type ["string", "null"]
   */
  readonly content?: string | null;
  readonly rectStyle?: { [cssProperty: string]: any };
  readonly textStyle?: { [cssProperty: string]: any };
}

export interface EdgePropertyGroup {
  /**
   * A set of edge types to apply this group if possible.
   *
   * If empty then the group will not be matched against any edge types.
   * If undefined then the group will be matched against all edge types.
   */
  readonly edgeTypes?: ReadonlyArray<string>;
  /**
   * An ordered list of edge property type IRIs to group values from.
   *
   * The group becomes applicable only if there is a matched or default value
   * for each property on the edge.
   */
  readonly properties: ReadonlyArray<EdgePropertyGroupItem>;
  /**
   * Style override for edge property group.
   */
  readonly style?: EdgePropertyStyle;
  /**
   * Template for rendering edge property group.
   *
   * Note: edge properties are currently rendered in the SVG context thus
   * only SVG-compatible components are supported inside directly.
   *
   * **Default**:
   * ```
   * {{#each properties}}
   *   {{#if @first}}{{label}}:{{/if}}
   *   {{#each (lookup ../values typeIri)}}
   *     {{label}}{{#unless @last}};{{/unless}}
   *   {{/each}}
   *   {{#unless @last}};{{/unless}}
   * {{/each}}
   * ```
   */
  readonly template?: string;
}

export interface EdgePropertyGroupItem {
  /**
   * Edge property type IRI to group values from.
   */
  readonly type: string;
  /**
   * Default value for edge property.
   *
   * Undefined value means there is no default for corresponding property
   * and the value is required to match this group.
   *
   * If present, value will be converted to RDF literal
   * with `xsd:string` datatype.
   */
  readonly default?: string;
}

export interface ResolvedEdgePropertyGroup extends EdgePropertyGroup {
  readonly properties: ReadonlyArray<ResolvedEdgePropertyGroupItem>;
  readonly compiledTemplate: CompiledTemplate;
}

export interface ResolvedEdgePropertyGroupItem extends EdgePropertyGroupItem {
  readonly type: Ontodia.PropertyTypeIri;
  readonly defaultTerm: Rdf.Node | null;
}

export const DEFAULT_EDGE_PROPERTY_GROUP_TEMPLATE = `
{{#each properties}}
  {{#if @first}}{{label}}:{{/if}}
  {{#each (lookup ../values typeIri)}}
    {{label}}{{#unless @last}};{{/unless}}
  {{/each}}
  {{#unless @last}};{{/unless}}
{{/each}}
`;

interface UnlabelledEdgePropertyGroupData {
  properties: Array<{
    typeIri: string;
  }>;
  values: {
    [typeIri: string]: Array<{
      term: Rdf.Iri | Rdf.Literal | Rdf.BNode;
    }>;
  };
}

// exported for documentation
interface OntodiaEdgePropertyGroupTemplateData extends UnlabelledEdgePropertyGroupData {
  properties: Array<{
    typeIri: string;
    label: string;
  }>;
  values: {
    [typeIri: string]: Array<{
      term: Rdf.Iri | Rdf.Literal | Rdf.BNode;
      label: string;
    }>;
  };
}

export function computeEdgeProperties(
  link: Ontodia.Link,
  groups: ReadonlyArray<ResolvedEdgePropertyGroup>,
  onlyGroupedProperties: boolean,
  defaultTemplate: CompiledTemplate,
  defaultStyle: EdgePropertyStyle,
  labelCache: ResourceLabelCache
): Ontodia.LinkLabel[] {
  const labels: Ontodia.LinkLabel[] = [];
  let groupedProperties: Set<Ontodia.PropertyTypeIri> | undefined;
  if (groups.length > 0) {
    groupedProperties = new Set<Ontodia.PropertyTypeIri>();
    for (const group of groups) {
      const groupData = matchEdgeGroup(link, group);
      if (groupData) {
        for (const item of group.properties) {
          groupedProperties.add(item.type);
        }
        labels.push({
          ...group.style,
          content: (
            <EdgeProperty template={group.compiledTemplate}
              groupData={groupData}
              labelCache={labelCache}
            />
          )
        });
      }
    }
  }
  if (!onlyGroupedProperties) {
    for (const propertyTypeIri in link.data.properties) {
      if (!Object.prototype.hasOwnProperty.call(link.data.properties, propertyTypeIri)) {
        continue;
      }
      const typeIri = propertyTypeIri as Ontodia.PropertyTypeIri;
      if (groupedProperties && groupedProperties.has(typeIri)) { continue; }
      const property = link.data.properties[typeIri];
      const groupData: UnlabelledEdgePropertyGroupData = {
        properties: [{typeIri}],
        values: {
          [typeIri]: property.values.map(v => ({term: v})),
        },
      };
      labels.push({
        ...defaultStyle,
        content: (
          <EdgeProperty template={defaultTemplate}
            groupData={groupData}
            labelCache={labelCache}
          />
        )
      });
    }
  }
  return labels;
}

function matchEdgeGroup(
  link: Ontodia.Link,
  group: ResolvedEdgePropertyGroup
): UnlabelledEdgePropertyGroupData | undefined {
  if (group.edgeTypes && group.edgeTypes.indexOf(link.typeId) < 0) {
    // ignore groups for different edge types
    return undefined;
  }
  const properties: UnlabelledEdgePropertyGroupData['properties'] = [];
  const values: UnlabelledEdgePropertyGroupData['values'] = {};
  for (const {type: propertyTypeIri, defaultTerm} of group.properties) {
    const terms: Array<{ term: Rdf.Iri | Rdf.Literal | Rdf.BNode }> = [];
    if (Object.prototype.hasOwnProperty.call(link.data.properties, propertyTypeIri)) {
      for (const term of link.data.properties[propertyTypeIri].values) {
        terms.push({term});
      }
    } else if (!(defaultTerm === undefined || defaultTerm === null)) {
      terms.push({term: defaultTerm});
    } else {
      return undefined;
    }
    properties.push({typeIri: propertyTypeIri});
    values[propertyTypeIri] = terms;
  }
  return {properties, values};
}

interface EdgePropertyProps {
  readonly template: CompiledTemplate;
  readonly groupData: UnlabelledEdgePropertyGroupData;
  readonly labelCache: ResourceLabelCache;
}

interface EdgePropertyState {
  readonly labelledData?: OntodiaEdgePropertyGroupTemplateData;
  readonly trackedResources?: ReadonlyArray<Rdf.Iri>;
}

class EdgeProperty extends Component<EdgePropertyProps, EdgePropertyState> {
  static contextTypes = {...ContextTypes, ...Ontodia.WorkspaceContextTypes};
  readonly context: ComponentContext & Ontodia.WorkspaceContextWrapper;

  private readonly listener = new Ontodia.EventObserver();

  constructor(props: EdgePropertyProps, context: any) {
    super(props, context);
    this.state = {};
  }

  static getDerivedStateFromProps(props: EdgePropertyProps): EdgePropertyState {
    const {groupData, labelCache} = props;
    const values: OntodiaEdgePropertyGroupTemplateData['values'] = {};
    const trackedResources: Rdf.Iri[] = [];
    for (const propertyIri in groupData.values) {
      if (!Object.prototype.hasOwnProperty.call(groupData.values, propertyIri)) { continue; }
      values[propertyIri] = groupData.values[propertyIri].map(value => {
        const label = labelCache.requestLabel(value.term);
        if (Rdf.isIri(value.term)) {
          trackedResources.push(value.term);
        }
        return {...value, label};
      });
    }
    const labelledData: OntodiaEdgePropertyGroupTemplateData = {
      properties: groupData.properties.map(property => {
        const typeIri = Rdf.iri(property.typeIri);
        const label = labelCache.requestLabel(typeIri);
        trackedResources.push(typeIri);
        return {...property, label};
      }),
      values,
    };
    return {labelledData, trackedResources};
  }

  componentDidMount() {
    const {labelCache} = this.props;
    this.listener.listen(labelCache.events, 'resourceChanged', e => {
      const {trackedResources} = this.state;
      for (const iri of trackedResources) {
        if (e.changedResources.has(iri)) {
          this.setState(EdgeProperty.getDerivedStateFromProps(this.props));
          break;
        }
      }
    });
  }

  componentWillUnmount() {
    this.listener.stopListening();
  }

  render() {
    const {template} = this.props;
    const {labelledData} = this.state;
    // don't use TemplateItem to avoid wrapping string results in non-SVG span tag
    const nodes = template(mergeInContextOverride(this.appliedDataContext, labelledData));
    const markup = mapHtmlTreeToReact(nodes);
    return markup;
  }
}

interface ResourceLabelCacheEvents {
  resourceChanged: {
    readonly changedResources: Immutable.Set<Rdf.Iri>;
  };
}

export class ResourceLabelCache {
  private readonly cancellation = new Cancellation();

  private readonly source = new Ontodia.EventSource<ResourceLabelCacheEvents>();
  readonly events: Ontodia.Events<ResourceLabelCacheEvents> = this.source;

  private readonly labelBuffer: KeyedBufferPool<Rdf.Iri, string>;
  private pendingRequests = Immutable.Set<Rdf.Iri>().asMutable();
  private readonly fetchDebounce = new Ontodia.InternalApi.Debouncer();

  constructor(
    fetchLabels: (resource: Immutable.Set<Rdf.Iri>) =>
      Kefir.Property<Immutable.Map<Rdf.Iri, string>>
  ) {
    this.labelBuffer = new KeyedBufferPool(
      Immutable.Map<Rdf.Iri, string>(),
      this.cancellation,
      fetchLabels,
      loadedKeys => this.source.trigger('resourceChanged', {
        changedResources: loadedKeys,
      })
    );
  }

  dispose() {
    this.cancellation.cancelAll();
  }

  requestLabel(term: Rdf.Node): string {
    if (Rdf.isIri(term)) {
      const bufferedLabel = this.labelBuffer.result.get(term);
      if (bufferedLabel !== undefined) {
        return bufferedLabel;
      }
      if (!this.labelBuffer.targets.has(term)) {
        this.pendingRequests.add(term);
        this.fetchDebounce.call(this.fetchLabels);
      }
    }
    return getDefaultLabelForTerm(term);
  }

  invalidateLabels(resources: ReadonlyArray<Rdf.Iri>): void {
    const onlyTargets = resources.filter(iri => this.labelBuffer.targets.has(iri));
    this.labelBuffer.load(Immutable.Set(onlyTargets));
  }

  private fetchLabels = () => {
    if (this.pendingRequests.size > 0) {
      const iris = this.pendingRequests;
      this.pendingRequests = Immutable.Set<Rdf.Iri>().asMutable();
      this.labelBuffer.load(iris);
    }
  }
}

export function fetchOntodiaResourceLabels(
  resources: Immutable.Set<Rdf.Iri>,
  workspaceContext: Ontodia.WorkspaceContext
): Kefir.Property<Immutable.Map<Rdf.Iri, string>> {
  const {editor, model, view} = workspaceContext;
  const toQuery: Ontodia.ElementIri[] = [];
  const authoredLabels = Immutable.Map<Rdf.Iri, string>().withMutations(labels => {
    for (const iri of resources.toArray()) {
      const elementIri = iri.value as Ontodia.ElementIri;
      const event = editor.authoringState.elements.get(elementIri);
      if (event) {
        const label = view.formatLabel(event.after.label.values, event.after.id);
        labels.set(iri, label);
      } else {
        toQuery.push(elementIri);
      }
    }
  });

  const queryTask = toQuery.length > 0
    ? Kefir.fromPromise(
        model.dataProvider.elementInfo({elementIds: toQuery})
      ).toProperty()
    : Kefir.constant<Ontodia.Dictionary<Ontodia.ElementModel>>({});

  return queryTask.map((models): Immutable.Map<Rdf.Iri, string> => {
    return authoredLabels.withMutations(labels => {
      for (const elementIri in models) {
        if (!Object.prototype.hasOwnProperty.call(models, elementIri)) { continue; }
        const element = models[elementIri];
        const label = view.formatLabel(element.label.values, element.id);
        labels.set(Rdf.iri(elementIri), label);
      }
    });
  });
}

export function findChangedResources(
  before: Ontodia.AuthoringState,
  after: Ontodia.AuthoringState
): Rdf.Iri[] {
  const changedIris: Rdf.Iri[] = [];
  for (const event of after.elements.values()) {
    if (before.elements.get(event.after.id) !== event) {
      changedIris.push(Rdf.iri(event.after.id));
    }
  }
  for (const event of before.elements.values()) {
    if (!after.elements.has(event.after.id)) {
      changedIris.push(Rdf.iri(event.after.id));
    }
  }
  return changedIris;
}

function getDefaultLabelForTerm(term: Rdf.Iri | Rdf.Literal | Rdf.BNode): string {
  return Rdf.isIri(term) ? Rdf.getLocalName(term.value) : term.value;
}
