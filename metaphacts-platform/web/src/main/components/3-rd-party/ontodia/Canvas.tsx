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
import * as React from 'react';
import * as Kefir from 'kefir';
import {
  Children, cloneElement, Component as ReactComponent,
} from 'react';
import {
  WorkspaceContext, WorkspaceContextWrapper, WorkspaceContextTypes,
  Canvas as OntodiaCanvas, CanvasProps as OntodiaCanvasProps, CanvasCommands,
  Element, ElementTemplate, TemplateProps, AuthoredEntity, AuthoredEntityContext,
  Link, LinkTemplate, LinkStyle, LinkLabel, LinkMarkerStyle, LinkTypeIri,
  Property, PropertyTypeIri, EventObserver, EventSource, IriClickIntent, setElementExpanded,
} from 'ontodia';

import { Cancellation } from 'platform/api/async';
import { Component, ComponentContext, ContextTypes } from 'platform/api/components';
import { listen, trigger } from 'platform/api/events';
import { mapHtmlTreeToReact } from 'platform/api/module-loader/Registry';
import { Rdf } from 'platform/api/rdf';
import { CompiledTemplate, mergeInContextOverride } from 'platform/api/services/template';

import { Spinner } from 'platform/components/ui/spinner';
import { TemplateItem } from 'platform/components/ui/template';
import { ErrorNotification } from 'platform/components/ui/notification/ErrorNotification';
import { componentHasType, isValidChild, universalChildren } from 'platform/components/utils';

import { NavigationMenu } from './NavigationMenu';
import { OntodiaContext, OntodiaContextWrapper, OntodiaContextTypes } from './OntodiaContext';
import * as OntodiaEvents from './OntodiaEvents';

import * as CanvasEvents from './CanvasEvents';
import * as styles from './Canvas.scss';
import * as elementStyles from './TabbyTemplate.scss';

/**
 * Renders graph, allows navigating through data.
 */
interface CanvasConfig {
  /**
   * Unique ID.
   */
  id?: string;
  /**
   * If true zoomToFit to call on each addElements event.
   */
  autoZoom?: boolean;
  /**
   * CSS classes for ontodia Canvas.
   */
  style?: React.CSSProperties;
  /**
   * Zoom options.
   * @default {"min": 0.002, "maxFit": 1}
   */
  zoomOptions?: ZoomOptions;
  /**
   * Custom templates of the elements.
   *
   * @mpSeeResource {
   *   "name": "Client-side templating",
   *   "iri": "http://help.metaphacts.com/resource/FrontendTemplating"
   * }
   */
  nodeTemplates?: { [type: string]: string };
  /**
   * Default custom template of the elements.
   *
   * @mpSeeResource {
   *   "name": "Client-side templating",
   *   "iri": "http://help.metaphacts.com/resource/FrontendTemplating"
   * }
   */
  defaultNodeTemplate?: string;
  /**
   * Custom styles for the edges.
   */
  edgeStyles?: { [linkTypeId: string]: EdgeStyle };
  /**
   * Default custom style for the edges.
   */
  defaultEdgeStyle?: EdgeStyle;
  /**
   * Custom styles for the edge properties and how to combine them into groups.
   */
  edgePropertyGroups?: ReadonlyArray<EdgePropertyGroup>;
  /**
   * Specifies to only show edge properties which are part of a defined property group.
   *
   * @default false
   */
  onlyGroupedEdgeProperties?: boolean;
  /**
   * Default template to use when rendering edge property groups and single properties.
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
  defaultEdgePropertyTemplate?: string;
  /**
   * Default custom style for the edge properties.
   */
  defaultEdgePropertyStyle?: EdgePropertyStyle;
  /**
   * Allows to disable rendering default `<ontodia-navigation-menu>` if none
   * found in the canvas children.
   *
   * This setting also controls whether "open navigation menu" button will be
   * shown inside the node when using default template.
   *
   * @default true
   */
  useDefaultNavigationMenu?: boolean;
  /**
   * Defines whether "open knowledge panel" button will be
   * shown inside the node when using default template.
   *
   * @default false
   */
  useKnowledgePanel?: boolean;
}

export interface ZoomOptions {
  min?: number;
  max?: number;
  step?: number;
  maxFit?: number;
  fitPadding?: number;
  requireCtrl?: boolean;
}

export interface EdgeStyle {
  markerSource?: LinkMarkerStyle;
  markerTarget?: Partial<LinkMarkerStyle>;
  linkStyle?: EdgeConnectionStyle;
  editable?: boolean;
}

export interface EdgeConnectionStyle {
  connection?: LinkStyle['connection'];
  label?: EdgePropertyStyle;
  properties?: EdgePropertyStyle[];
}

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

export const DEFAULT_CANVAS_STYLE: React.CSSProperties = {
  backgroundColor: 'whitesmoke',
};

const DEFAULT_EDGE_STYLE: EdgeStyle = {
  markerTarget: {
    fill: '#CCCCCC',
    stroke: '#CCCCCC'
  },
  linkStyle: {
    connection: {
      stroke: '#CCCCCC',
      'stroke-width': 1,
    }
  }
};

const DEFAULT_LABEL_STYLE: EdgePropertyStyle = {
  rectStyle: {fill: '#fafafa'},
  textStyle: {
    fill: '#666666',
    strokeWidth: 0,
    fontFamily: 'Lato',
    fontSize: 12,
  },
};

const DEFAULT_EDGE_PROPERTY_STYLE: EdgePropertyStyle = {
  rectStyle: {fill: '#fafafa'},
  textStyle: {
    fill: '#666666',
    strokeWidth: 0,
    fontFamily: 'Lato',
    fontSize: 11,
  }
};

const DEFAULT_EDGE_PROPERTY_GROUP_TEMPLATE = `
{{#each properties}}
  {{#if @first}}{{label}}:{{/if}}
  {{#each (lookup ../values typeIri)}}
    {{label}}{{#unless @last}};{{/unless}}
  {{/each}}
  {{#unless @last}};{{/unless}}
{{/each}}
`;

function getTabbyTemplate(options: {
  showInfoButton?: boolean;
  showNavigationMenuButton?: boolean;
}) {
  return `
    <div class='{{#if onlySelected}}${elementStyles.selected}{{/if}} ${elementStyles.border}'
      style='color: {{color}}'>
      <div class='${elementStyles.template}'
        title='{{iri}}'
        style='border-right: 4px solid {{color}}; color: {{color}}'>
        <div class='${elementStyles.buttons}'>
          ${options.showInfoButton ? `
            <button type='button' name='showInfo' title='Open Knowledge Panel'
              class='${elementStyles.buttonInformation}'>
            </button>
          ` : `
            <button type='button' name='followLink' title='Navigate to resource'
              class='${elementStyles.buttonNavigateToResource}'>
            </button>
          `}
          ${options.showNavigationMenuButton ? `
            <button type='button' name='openConnectionMenu' title='Open navigation menu'
              class='${elementStyles.buttonConnections}'>
            </button>
          ` : ``}
        </div>
        <div class='${elementStyles.content}'>
          {{#if imgUrl}}
            <div class='${elementStyles.image}'>
              <img src='{{imgUrl}}'/>
              <div class='${elementStyles.imageShadow}'></div>
            </div>
          {{else}} {{#if iconUrl}}
            <div class='${elementStyles.image}'>
              <img src='{{iconUrl}}'/>
              <div class='${elementStyles.imageShadow}'></div>
            </div>
          {{/if}}{{/if}}
          <div class='${elementStyles.body}'>
            <div class='${elementStyles.label}'>
              <div class='${elementStyles.labelValue}' title='{{label}}'>
                {{label}}
              </div>
            </div>
            {{#if types}}
              <div class='${elementStyles.types}' title='{{types}}'>
                <div class='${elementStyles.typesValue}'>{{types}}</div>
              </div>
            {{else}}
              <div class='${elementStyles.noTypes}' title='Type is undefined'>
                <div class='${elementStyles.line}'></div>
              </div>
            {{/if}}
          </div>
        </div>
      </div>
    </div>
  `;
}

export interface CanvasProps extends CanvasConfig {
  /**
   * Canvas widgets.
   */
  children?: React.ReactElement | ReadonlyArray<React.ReactElement>;
}

export interface CanvasState {
  loadingTemplates?: boolean;
  loadingEdgeProperties?: boolean;
  loadingError?: any;
}

// exported for documentation
interface OntodiaElementTemplateData extends TemplateProps {
  /**
   * `true` if the ontodia in Authoring mode
   */
  inAuthoringMode: boolean;

  /**
   * `true` if the element is the only one that's selected
   */
  onlySelected: boolean;

  /**
   * `true` if the properties of the element can be edited
   */
  canEdit: boolean;

  /**
   * `true` if element can be deleted from the data
   */
  canDelete: boolean;
}

// exported for documentation
interface OntodiaEdgePropertyGroupTemplateData {
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

interface ResolvedEdgePropertyGroup extends EdgePropertyGroup {
  readonly properties: ReadonlyArray<ResolvedEdgePropertyGroupItem>;
  readonly compiledTemplate: CompiledTemplate;
}

interface ResolvedEdgePropertyGroupItem extends EdgePropertyGroupItem {
  readonly type: PropertyTypeIri;
  readonly defaultTerm: Rdf.Node | null;
}

type DefaultProps = Pick<CanvasProps,
  'zoomOptions' |
  'defaultEdgeStyle' |
  'defaultEdgePropertyStyle' |
  'nodeTemplates' |
  'edgeStyles' |
  'edgePropertyGroups' |
  'defaultEdgePropertyTemplate' |
  'useDefaultNavigationMenu'
>;

export class Canvas extends Component<CanvasProps, CanvasState> {
  static defaultProps: DefaultProps = {
    zoomOptions: {
      min: 0.002,
      maxFit: 1,
    },
    defaultEdgeStyle: DEFAULT_EDGE_STYLE,
    defaultEdgePropertyStyle: DEFAULT_EDGE_PROPERTY_STYLE,
    nodeTemplates: {},
    edgeStyles: {},
    edgePropertyGroups: [],
    defaultEdgePropertyTemplate: DEFAULT_EDGE_PROPERTY_GROUP_TEMPLATE,
    useDefaultNavigationMenu: true,
  };

  static contextTypes = {...ContextTypes, ...OntodiaContextTypes};
  readonly context: ComponentContext & OntodiaContextWrapper;

  protected readonly cancellation = new Cancellation();
  protected readonly commands = new EventSource<CanvasCommands>();

  private nodeTemplates: {[type: string]: ElementTemplate} = {};
  private defaultNodeTemplate: ElementTemplate;

  private resolvedEdgeGroups: ReadonlyArray<ResolvedEdgePropertyGroup> | undefined;
  private resolvedDefaultEdgeTemplate: CompiledTemplate | undefined;
  private resolvedDefaultEdgePropertyStyle: EdgePropertyStyle | undefined;

  constructor(props: CanvasProps, context: any) {
    super(props, context);
    this.state = {
      loadingTemplates: true,
      loadingEdgeProperties: true,
    };
  }

  componentDidMount() {
    const {id} = this.props;
    this.prepareElementTemplates();
    this.resolveEdgePropertyStyles();
    this.cancellation.map(
      listen({eventType: CanvasEvents.ForceLayout, target: id})
    ).observe({
      value: ({data}) => this.commands.trigger('forceLayout', data),
    });
    this.cancellation.map(
      listen({eventType: CanvasEvents.ZoomIn, target: id})
    ).observe({
      value: ({data}) => this.commands.trigger('zoomIn', data),
    });
    this.cancellation.map(
      listen({eventType: CanvasEvents.ZoomOut, target: id})
    ).observe({
      value: ({data}) => this.commands.trigger('zoomOut', data),
    });
    this.cancellation.map(
      listen({eventType: CanvasEvents.ZoomToFit, target: id})
    ).observe({
      value: ({data}) => this.commands.trigger('zoomToFit', data),
    });
    this.cancellation.map(
      listen({eventType: CanvasEvents.ZoomToContent, target: id})
    ).observe({
      value: ({data}) => this.commands.trigger('zoomToContent', data),
    });
    this.cancellation.map(
      listen({eventType: CanvasEvents.CenterTo, target: id})
    ).observe({
      value: ({data}) => this.commands.trigger('centerTo', data),
    });
    this.cancellation.map(
      listen({eventType: CanvasEvents.SetZoomLevel, target: id})
    ).observe({
      value: ({data}) => this.commands.trigger('setZoomLevel', data),
    });
    this.cancellation.map(
      listen({eventType: CanvasEvents.ZoomBy, target: id})
    ).observe({
      value: ({data}) => this.commands.trigger('zoomBy', data),
    });
    this.cancellation.map(
      listen({eventType: CanvasEvents.ExportPng, target: id})
    ).observe({
      value: ({data}) => this.commands.trigger('exportPng', data),
    });
    this.cancellation.map(
      listen({eventType: CanvasEvents.ExportSvg, target: id})
    ).observe({
      value: ({data}) => this.commands.trigger('exportSvg', data),
    });
    this.cancellation.map(
      listen({eventType: CanvasEvents.Print, target: id})
    ).observe({
      value: ({data}) => this.commands.trigger('print', data),
    });
    this.cancellation.map(
      listen({eventType: CanvasEvents.MoveElementToCenter, target: id})
    ).observe({
      value: ({data}) => this.commands.trigger('moveElementToCenter', data),
    });
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  render() {
    const {autoZoom, zoomOptions, children, style} = this.props;
    const {loadingTemplates, loadingEdgeProperties, loadingError} = this.state;
    if (loadingError) {
      return <ErrorNotification errorMessage={loadingError} />;
    } else if (loadingTemplates || loadingEdgeProperties) {
      return <Spinner className={styles.spinner} />;
    }
    const props: OntodiaCanvasProps = {
      style: {...DEFAULT_CANVAS_STYLE, ...style},
      commands: this.commands,
      autoZoom,
      zoomOptions,
      elementTemplateResolver: this.resolveElementTemplate,
      linkTemplateResolver: this.resolveLinkTemplate,
      children: this.mapCanvasChildren(),
    };
    return <OntodiaCanvas {...props} />;
  }

  protected resolveElementTemplate = (types: string[]): ElementTemplate | undefined => {
    for (let type of types) {
      const template = this.nodeTemplates[type];
      if (template) { return template; }
    }

    return this.defaultNodeTemplate;
  }

  private prepareElementTemplates = () => {
    const {nodeTemplates, useKnowledgePanel, useDefaultNavigationMenu} = this.props;
    const tasks: Kefir.Property<void>[] = [];

    for (const type of Object.keys(nodeTemplates)) {
      tasks.push(this.getElementTemplate(nodeTemplates[type]).map(template => {
        this.nodeTemplates[type] = template;
      }));
    }

    const defaultNodeTemplate = this.props.defaultNodeTemplate || getTabbyTemplate({
      showInfoButton: useKnowledgePanel,
      showNavigationMenuButton: useDefaultNavigationMenu,
    });
    tasks.push(this.getElementTemplate(defaultNodeTemplate).map(template => {
      this.defaultNodeTemplate = template;
    }));

    Kefir.merge(tasks).observe({
      end: () => this.setState({loadingTemplates: false}),
    });
  }

  private getElementTemplate = (template: string): Kefir.Property<ElementTemplate> => {
    const ontodiaContext = this.context.ontodiaContext;

    return this.appliedTemplateScope.prepare(template).map(compiledTemplate => {
      return class extends ReactComponent<TemplateProps, {}> {
        readonly context: WorkspaceContextWrapper;
        static contextTypes = WorkspaceContextTypes;

        render() {
          const {elementId} = this.props;
          if (ontodiaContext.inAuthoringMode()) {
            return (
              <AuthoredEntity
                elementId={elementId}
                children={(authoredContext: AuthoredEntityContext) => {
                  return this.renderTemplate(authoredContext);
                }}
              />
            );
          } else {
            return this.renderTemplate();
          }
        }

        private renderTemplate(authoredContext?: AuthoredEntityContext) {
          const {elementId} = this.props;
          const workspace = this.context.ontodiaWorkspace;
          const {model, editor} = workspace;
          const target = model.getElement(elementId);
          const onlySelected = editor.selection.length === 1 && editor.selection[0] === target;
          const templateData: OntodiaElementTemplateData = {
            ...this.props,
            onlySelected,
            inAuthoringMode: Boolean(authoredContext),
            canEdit: authoredContext ? authoredContext.canEdit : false,
            canDelete: authoredContext ? authoredContext.canDelete : false,
          };
          return (
            <TemplateItem
              template={{source: compiledTemplate, options: templateData}}
              componentMapper={component => mapTemplateComponent(component, {
                target,
                ontodiaContext,
                workspace,
                authoredContext,
              })}
            />
          );
        }
      };
    });
  }

  protected resolveLinkTemplate = (linkTypeId: string): LinkTemplate | undefined => {
    const {edgeStyles, defaultEdgeStyle, onlyGroupedEdgeProperties} = this.props;

    let edgeStyle = {...DEFAULT_EDGE_STYLE, ...defaultEdgeStyle};
    if (Object.prototype.hasOwnProperty.call(edgeStyles, linkTypeId)) {
      edgeStyle = {...edgeStyle, ...edgeStyles[linkTypeId]};
    }

    const {markerSource, markerTarget, linkStyle, editable} = edgeStyle;

    return {
      markerSource,
      markerTarget,
      renderLink: (link: Link) => {
        let label = linkStyle.label ?? DEFAULT_LABEL_STYLE;
        let properties: LinkLabel[] = linkStyle.properties;
        if (editable && link.linkState) {
          const customLabel = link.linkState['ontodia:customLabel'];
          label = {...label, content: customLabel};
        }
        if (link.data.properties) {
          properties = computeEdgeProperties(
            link,
            this.resolvedEdgeGroups,
            onlyGroupedEdgeProperties,
            this.resolvedDefaultEdgeTemplate,
            this.resolvedDefaultEdgePropertyStyle
          );
        }
        return {...linkStyle, label, properties};
      },
      setLinkLabel: editable ? (link: Link, label: string) => {
        link.setLinkState({['ontodia:customLabel']: label});
      } : undefined,
    };
  }

  private resolveEdgePropertyStyles() {
    const {edgePropertyGroups, defaultEdgePropertyTemplate, defaultEdgePropertyStyle} = this.props;
    const templateScope = this.appliedTemplateScope;
    const resolvedDefaultStyle: EdgePropertyStyle = {
      ...DEFAULT_EDGE_PROPERTY_STYLE,
      ...defaultEdgePropertyStyle,
    };
    const groupsTask = edgePropertyGroups.length === 0
      ? Kefir.constant<ResolvedEdgePropertyGroup[]>([])
      : Kefir.zip(
        edgePropertyGroups.map((group) => {
          const style: EdgePropertyStyle = {...resolvedDefaultStyle, ...group.style};
          const properties = group.properties.map((item): ResolvedEdgePropertyGroupItem => ({
            ...item,
            type: item.type as PropertyTypeIri,
            defaultTerm: typeof item.default === 'string'
              ? Rdf.literal(item.default) : null,
          }));
          return templateScope
            .prepare(group.template ?? defaultEdgePropertyTemplate)
            .map((compiledTemplate): ResolvedEdgePropertyGroup => ({
              ...group,
              style,
              properties,
              compiledTemplate,
            }));
        })
      ).toProperty();

    Kefir.combine({
      defaultTemplate: templateScope.prepare(defaultEdgePropertyTemplate),
      groups: groupsTask,
    }).observe({
      value: ({defaultTemplate, groups}) => {
        this.resolvedEdgeGroups = groups;
        this.resolvedDefaultEdgeTemplate = defaultTemplate;
        this.resolvedDefaultEdgePropertyStyle = resolvedDefaultStyle;
        this.setState({loadingEdgeProperties: false});
      },
      error: loadingError => this.setState({loadingError}),
    });
  }

  protected mapCanvasChildren(): React.ReactElement | ReadonlyArray<React.ReactElement> {
    const {useDefaultNavigationMenu, children} = this.props;
    if (useDefaultNavigationMenu) {
      let foundNavigationMenu = false;
      React.Children.forEach(children, child => {
        if (componentHasType(child, NavigationMenu)) {
          foundNavigationMenu = true;
        }
      });
      if (!foundNavigationMenu) {
        return appendChild(children, <NavigationMenu key='ontodia-navigation-menu' />);
      }
    }
    return children;
  }
}

export function mapTemplateComponent(
  component: React.ReactNode,
  context: {
    target: Element,
    ontodiaContext: OntodiaContext,
    workspace: WorkspaceContext,
    authoredContext?: AuthoredEntityContext
  }
): React.ReactNode {
  const {
    target,
    ontodiaContext: {ontodiaId, onShowInfo},
    workspace: {editor, overlayController, view},
    authoredContext,
  } = context;
  function mapElement(element: React.ReactNode): React.ReactNode {
    if (!isValidChild(element)) { return element; }
    if (element.type === 'button') {
      if (authoredContext) {
        const {onEdit, onDelete, onEstablishNewLink} = authoredContext;
        switch (element.props.name) {
          case 'edit': return cloneElement(element, {
            disabled: !authoredContext.canEdit,
            onClick: onEdit,
          });
          case 'delete': return cloneElement(element, {
            disabled: !authoredContext.canEdit,
            onClick: onDelete,
          });
          case 'establishNewLink': return cloneElement(element, {
            onMouseDown: (e: React.MouseEvent<HTMLElement>) =>
              onEstablishNewLink(e, tryToGetLinkTypeFromEvent(e), tryToGetDropOnCanvasFromEvent(e)),
          });
        }
      }
      switch (element.props.name) {
        case 'openConnectionMenu': return React.cloneElement(element, {
          onClick: () => {
            trigger({
              eventType: OntodiaEvents.OpenConnectionsMenu,
              source: ontodiaId,
              targets: ontodiaId ? [ontodiaId] : undefined,
              data: {id: target.id},
            });
          },
        });
        case 'showInfo': return React.cloneElement(element, {
          onClick: () => onShowInfo(target),
        });
        case 'addToFilter': return React.cloneElement(element, {
          onClick: () => { target.addToFilter(); },
        });
        case 'removeSelectedElements': return React.cloneElement(element, {
          onClick: () => { editor.removeSelectedElements(); }
        });
        case 'followLink': return React.cloneElement(element, {
          onClick: (e: React.MouseEvent<any>) => {
              view.onIriClick(target.iri, target, IriClickIntent.JumpToEntity, e);
          },
        });
        case 'expand': return React.cloneElement(element, {
          onClick: () => {
              view.model.history.execute(
                  setElementExpanded(target, !target.isExpanded)
              );
          },
        });
      }
      return element;
    }

    if ('children' in element.props) {
      return cloneElement(element, {}, universalChildren(
        Children.map(element.props.children, mapElement)
      ));
    }

    return element;
  }

  return mapElement(component);
}

function computeEdgeProperties(
  link: Link,
  groups: ReadonlyArray<ResolvedEdgePropertyGroup>,
  onlyGroupedProperties: boolean,
  defaultTemplate: CompiledTemplate,
  defaultStyle: EdgePropertyStyle
): LinkLabel[] {
  const labels: LinkLabel[] = [];
  let groupedProperties: Set<PropertyTypeIri> | undefined;
  if (groups.length > 0) {
    groupedProperties = new Set<PropertyTypeIri>();
    for (const group of groups) {
      const groupData = matchEdgeGroup(link, group);
      if (groupData) {
        for (const item of group.properties) {
          groupedProperties.add(item.type);
        }
        labels.push({
          ...group.style,
          content: <EdgeProperty template={group.compiledTemplate} templateData={groupData} />
        });
      }
    }
  }
  if (!onlyGroupedProperties) {
    for (const propertyTypeIri in link.data.properties) {
      if (!Object.prototype.hasOwnProperty.call(link.data.properties, propertyTypeIri)) {
        continue;
      }
      const typeIri = propertyTypeIri as PropertyTypeIri;
      if (groupedProperties && groupedProperties.has(typeIri)) { continue; }
      const property = link.data.properties[typeIri];
      const groupData: OntodiaEdgePropertyGroupTemplateData = {
        properties: [{typeIri, label: ''}],
        values: {
          [typeIri]: property.values.map(v => ({term: v, label: getDefaultLabelForTerm(v)})),
        },
      };
      labels.push({
        ...defaultStyle,
        content: <EdgeProperty template={defaultTemplate} templateData={groupData} />
      });
    }
  }
  return labels;
}

function matchEdgeGroup(
  link: Link,
  group: ResolvedEdgePropertyGroup
): OntodiaEdgePropertyGroupTemplateData | undefined {
  if (group.edgeTypes && group.edgeTypes.indexOf(link.typeId) < 0) {
    // ignore groups for different edge types
    return undefined;
  }
  const properties: OntodiaEdgePropertyGroupTemplateData['properties'] = [];
  const values: OntodiaEdgePropertyGroupTemplateData['values'] = {};
  for (const {type: propertyTypeIri, defaultTerm} of group.properties) {
    const terms: Array<{ term: Rdf.Iri | Rdf.Literal | Rdf.BNode; label: string }> = [];
    if (Object.prototype.hasOwnProperty.call(link.data.properties, propertyTypeIri)) {
      for (const term of link.data.properties[propertyTypeIri].values) {
        const label = getDefaultLabelForTerm(term);
        terms.push({term, label});
      }
    } else if (!(defaultTerm === undefined || defaultTerm === null)) {
      const label = getDefaultLabelForTerm(defaultTerm);
      terms.push({term: defaultTerm, label});
    } else {
      return undefined;
    }
    properties.push({
      typeIri: propertyTypeIri,
      label: Rdf.getLocalName(propertyTypeIri),
    });
    values[propertyTypeIri] = terms;
  }
  return {properties, values};
}

function getDefaultLabelForTerm(term: Rdf.Iri | Rdf.Literal | Rdf.BNode): string {
  return Rdf.isIri(term) ? Rdf.getLocalName(term.value) : term.value;
}

interface EdgePropertyProps {
  readonly templateData: OntodiaEdgePropertyGroupTemplateData;
  readonly template: CompiledTemplate;
}

interface EdgePropertyState {}

class EdgeProperty extends Component<EdgePropertyProps, EdgePropertyState> {
  static contextTypes = {...ContextTypes, ...WorkspaceContextTypes};
  readonly context: ComponentContext & WorkspaceContextWrapper;

  constructor(props: EdgePropertyProps, context: any) {
    super(props, context);
    this.state = {};
  }

  render() {
    const {view} = this.context.ontodiaWorkspace;
    const {template, templateData} = this.props;
    const properties = templateData.properties.map(property => {
      const propertyType = view.model.createProperty(property.typeIri as PropertyTypeIri);
      const typeLabel = view.formatLabel(propertyType.label, propertyType.id);
      return {...property, label: typeLabel};
    });
    const labelledData: OntodiaEdgePropertyGroupTemplateData = {...templateData, properties};
    // don't use TemplateItem to avoid wrapping string results in non-SVG span tag
    const nodes = template(mergeInContextOverride(this.appliedDataContext, labelledData));
    const markup = mapHtmlTreeToReact(nodes);
    return markup;
  }
}

export function subscribeOnCanvasCommands(
  commands: EventSource<CanvasCommands>, props: { id?: string; canvasId?: string }
) {
  const {id, canvasId} = props;
  const listener = new EventObserver();
  listener.listen(commands, 'forceLayout', e =>
    trigger({
      source: id,
      eventType: CanvasEvents.ForceLayout,
      targets: [canvasId],
      data: e,
    })
  );
  listener.listen(commands, 'zoomIn', e =>
    trigger({
      source: id,
      eventType: CanvasEvents.ZoomIn,
      targets: [canvasId],
      data: e,
    })
  );
  listener.listen(commands, 'zoomOut', e =>
    trigger({
      source: id,
      eventType: CanvasEvents.ZoomOut,
      targets: [canvasId],
      data: e,
    })
  );
  listener.listen(commands, 'zoomToFit', e =>
    trigger({
      source: id,
      eventType: CanvasEvents.ZoomToFit,
      targets: [canvasId],
      data: e,
    })
  );
  listener.listen(commands, 'zoomToContent', e =>
    trigger({
      source: id,
      eventType: CanvasEvents.ZoomToContent,
      targets: [canvasId],
      data: e,
    })
  );
  listener.listen(commands, 'exportPng', e =>
    trigger({
      source: id,
      eventType: CanvasEvents.ExportPng,
      targets: [canvasId],
      data: e,
    })
  );
  listener.listen(commands, 'exportSvg', e =>
    trigger({
      source: id,
      eventType: CanvasEvents.ExportSvg,
      targets: [canvasId],
      data: e,
    })
  );
  listener.listen(commands, 'print', e =>
    trigger({
      source: id,
      eventType: CanvasEvents.Print,
      targets: [canvasId],
      data: e,
    })
  );
  listener.listen(commands, 'moveElementToCenter', e =>
    trigger({
      source: id,
      eventType: CanvasEvents.MoveElementToCenter,
      targets: [canvasId],
      data: e,
    })
  );
}

function tryToGetLinkTypeFromEvent(e: React.MouseEvent<HTMLElement>): LinkTypeIri | undefined {
  const button = (e.target as HTMLElement);
  const linkType = button.getAttribute('data-link-type');
  return linkType as LinkTypeIri | undefined;
}

function tryToGetDropOnCanvasFromEvent(e: React.MouseEvent<HTMLElement>): boolean | undefined {
  const button = (e.target as HTMLElement);
  const canDropOnCanvas = button.getAttribute('data-can-drop-on-canvas');
  return canDropOnCanvas ? (canDropOnCanvas === 'true') : undefined;
}

function appendChild(
  children: React.ReactElement | ReadonlyArray<React.ReactElement> | undefined,
  child: React.ReactElement
) {
  if (!children) {
    return child;
  }
  const array = React.Children.toArray(children) as ReadonlyArray<React.ReactElement>;
  return [...array, child];
}
