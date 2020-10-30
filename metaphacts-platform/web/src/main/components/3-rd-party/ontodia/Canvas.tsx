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
import * as React from 'react';
import * as Kefir from 'kefir';
import {
  Children, cloneElement, Component as ReactComponent,
} from 'react';
import {
  CanvasProps as OntodiaCanvasProps,
  ElementTemplate, TemplateProps, AuthoredEntity,
  AuthoredEntityContext, LinkTemplate, Link,
  LinkMarkerStyle, LinkStyle, EventObserver,
  EventSource, CanvasCommands, Canvas as OntodiaCanvas,
  WorkspaceContextWrapper, WorkspaceContextTypes, IriClickIntent,
  setElementExpanded, EditorController, Element, DiagramView,
} from 'ontodia';

import { Component, ComponentContext, ContextTypes } from 'platform/api/components';
import { Cancellation } from 'platform/api/async';
import { listen, trigger } from 'platform/api/events';
import { Rdf } from 'platform/api/rdf';
import { Spinner } from 'platform/components/ui/spinner';
import { TemplateItem } from 'platform/components/ui/template';
import { isValidChild, universalChildren } from 'platform/components/utils';

import { OntodiaContextWrapper, OntodiaContextTypes } from './OntodiaContext';

import * as CanvasEvents from './CanvasEvents';
import * as styles from './Canvas.scss';
import * as elementStyles from './TabbyTemplate.scss';

export interface ZoomOptions {
  min?: number;
  max?: number;
  step?: number;
  maxFit?: number;
  fitPadding?: number;
  requireCtrl?: boolean;
}

export interface EdgeStyle {
  markerSource?: LinkMarkerStyle,
  markerTarget?: Partial<LinkMarkerStyle>,
  linkStyle?: LinkStyle,
  editable?: boolean;
}

export const DEFAULT_CANVAS_STYLE: React.CSSProperties = {
  backgroundColor: 'whitesmoke',
};

const DEFAULT_EDGE_STYLE: EdgeStyle = {
  'markerTarget': {
    'fill': '#CCCCCC',
    'stroke': '#CCCCCC'
  },
  'linkStyle': {
    'connection': {
      'stroke': '#CCCCCC',
      'stroke-width': 1
    },
    'label': {
      'attrs': {
        'rect': {
          'fill': '#fafafa'
        },
        'text': {
          'fill': '#666666',
          'stroke-width': 0,
          'font-family': 'Lato',
          'font-size': 12
        }
      }
    }
  }
};

function getTabbyTemplate(addShowInfoButton?: boolean) {
  return `
    <div class='{{#if onlySelected}}${elementStyles.selected}{{/if}} ${elementStyles.border}'
      style='color: {{color}}'>
      <div class='${elementStyles.template}'
        title='{{iri}}'
        style='border-right: 4px solid {{color}}; color: {{color}}'>
        <div class='${elementStyles.buttons}'>
          ${addShowInfoButton ? `
            <button type='button' name='showInfo' title='Open Knowledge Panel'
              class='${elementStyles.buttonInformation}'>
            </button>
          ` : `
            <button type='button' name='followLink' title='Navigate to resource'
              class='${elementStyles.buttonNavigateToResource}'>
            </button>
          `}
          <button type='button' name='openConnectionMenu' title='Open connections menu'
            class='${elementStyles.buttonConnections}'>
          </button>
        </div>
        <div class='${elementStyles.content}'>
          {{#if imgUrl}}
            <div class='${elementStyles.image}'>
              <img src='{{imgUrl}}'/>
            </div>
          {{else}} {{#if iconUrl}}
            <div class='${elementStyles.image}'>
              <img src='{{iconUrl}}'/>
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

/**
 * Renders graph, allows navigating through data.
 */
export interface CanvasConfig {
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
   * @default {min: 0.002, maxFit: 1}
   */
  zoomOptions?: ZoomOptions;
  /**
   * Custom templates of the elements.
   */
  nodeTemplates?: {[type: string]: string};
  /**
   * Default custom template of the elements.
   */
  defaultNodeTemplate?: string;
  /**
   * Custom styles of the links.
   */
  edgeStyles?: {[linkTypeId: string]: EdgeStyle};
  /**
   * Default custom style of the links.
   */
  defaultEdgeStyle?: EdgeStyle;
  /**
   * Canvas widgets.
   */
  children?: JSX.Element | ReadonlyArray<JSX.Element>;
  /**
   * Defines whether the info icon (to open the resource's knowledge panel)
   * is shown inside the node. Note that this setting only applies to
   * default templates.
   */
  useKnowledgePanel?: boolean;
}

export type CanvasProps = CanvasConfig;

export interface CanvasState {
  loadingTemplates?: boolean;
}

export class Canvas extends Component<CanvasProps, CanvasState> {
  static defaultProps: Partial<CanvasProps> = {
    zoomOptions: {
      min: 0.002,
      maxFit: 1,
    },
    defaultEdgeStyle: DEFAULT_EDGE_STYLE,
    nodeTemplates: {},
    edgeStyles: {},
  };

  static contextTypes = {
    ...ContextTypes,
    ...OntodiaContextTypes,
  };
  readonly context: ComponentContext & OntodiaContextWrapper;

  protected readonly cancellation = new Cancellation();
  protected readonly commands = new EventSource<CanvasCommands>();

  private nodeTemplates: {[type: string]: ElementTemplate} = {};
  private defaultNodeTemplate: ElementTemplate;

  constructor(props: CanvasProps, context: any) {
    super(props, context);
    this.state = {};
    this.prepareElementTemplates();
  }

  private get defaultNodeTemplateMarkup() {
    return this.props.defaultNodeTemplate || getTabbyTemplate(this.props.useKnowledgePanel);
  }

  componentDidMount() {
    const {id} = this.props;
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
    const {loadingTemplates} = this.state;
    const props: OntodiaCanvasProps = {
      style: {...DEFAULT_CANVAS_STYLE, ...style},
      commands: this.commands,
      autoZoom,
      zoomOptions,
      elementTemplateResolver: this.resolveElementTemplate,
      linkTemplateResolver: this.resolveLinkTemplate,
      children,
    };
    return loadingTemplates ?
      <Spinner className={styles.spinner}/> :
      <OntodiaCanvas {...props} />;
  }

  protected resolveElementTemplate = (types: string[]): ElementTemplate | undefined => {
    for (let type of types) {
      const template = this.nodeTemplates[type];
      if (template) { return template; }
    }

    return this.defaultNodeTemplate;
  }

  private prepareElementTemplates = () => {
    const {nodeTemplates} = this.props;
    const defaultNodeTemplate = this.defaultNodeTemplateMarkup;
    const tasks: Kefir.Property<void>[] = [];
    this.setState({loadingTemplates: true});

    Object.keys(nodeTemplates).forEach(type => {
      const preparationTask =
        this.getElementTemplate(nodeTemplates[type]).map(template => {
          this.nodeTemplates[type] = template;
        });
      tasks.push(preparationTask);
    });

    if (defaultNodeTemplate) {
      const defaultPreparationTask =
        this.getElementTemplate(defaultNodeTemplate).map(template => {
          this.defaultNodeTemplate = template;
        });
        tasks.push(defaultPreparationTask);
    }
    Kefir.merge(tasks).observe({
      end: () => this.setState({loadingTemplates: false}),
    });
  }

  private getElementTemplate = (template: string): Kefir.Property<ElementTemplate> => {
    const {inAuthoringMode, onShowInfo} = this.context.ontodiaContext;

    return this.appliedTemplateScope.prepare(template).map(compiledTemplate => {
      return class extends ReactComponent<TemplateProps, {}> {
        readonly context: ComponentContext & WorkspaceContextWrapper;
        static contextTypes = WorkspaceContextTypes;

        render() {
          const {elementId} = this.props;
          const {editor, view} = this.context.ontodiaWorkspace;
          const target = editor.model.getElement(elementId);
          const context = {target, view, editor, onShowInfo};
          const onlySelected = editor.selection.length === 1 && editor.selection[0] === target;
          if (inAuthoringMode()) {
            return <AuthoredEntity
              elementId={elementId}
              children={(authoredContext: AuthoredEntityContext) => {
                return <TemplateItem template={{
                    source: compiledTemplate,
                    options: {
                      ...this.props,
                      canEdit: authoredContext.canEdit,
                      canDelete: authoredContext.canDelete,
                      onlySelected,
                    }
                  }}
                  componentMapper={component =>
                    mapTemplateComponent(component, context, authoredContext)}/>;
              }}/>;
          } else {
            return <TemplateItem template={{
              source: compiledTemplate,
              options: {...this.props, onlySelected}
            }}
            componentMapper={component => mapTemplateComponent(component, context)}/>;
          }
        }
      };
    });
  }

  protected resolveLinkTemplate = (linkTypeId: string): LinkTemplate | undefined => {
    const {edgeStyles, defaultEdgeStyle} = this.props;
    const template = edgeStyles[linkTypeId] || defaultEdgeStyle;

    if (!template) { return; }

    const {markerSource, markerTarget, linkStyle = {}, editable} = template;

    return {
      markerSource,
      markerTarget,
      renderLink: (link: Link) => {
        if (editable && link.linkState) {
          const customLabel = [Rdf.literal(link.linkState['ontodia:customLabel'])];
          const {label = {}} = linkStyle;
          const {attrs = {}} = label;
          const {text = {}} = attrs;
          return {
            ...linkStyle,
            label: {
              ...label,
              attrs: {
                ...attrs,
                text: {
                  ...text,
                  text: customLabel,
                },
              },
            },
          };
        }
        return linkStyle;
      },
      setLinkLabel: editable ? (link: Link, label: string) => {
        link.setLinkState({['ontodia:customLabel']: label});
      } : undefined,
    };
  }
}

export function mapTemplateComponent(
  component: JSX.Element,
  context: {
    editor: EditorController,
    target: Element,
    view: DiagramView,
    onShowInfo: (target: Element) => void;
  },
  authoredContext?: AuthoredEntityContext
): JSX.Element {
  const {editor, target, view, onShowInfo} = context;
  function mapElement(element: JSX.Element): JSX.Element {
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
            onMouseDown: onEstablishNewLink,
          });
        }
      }
      switch (element.props.name) {
        case 'openConnectionMenu': return React.cloneElement(element, {
          onClick: () => {
            editor.showConnectionsMenu(target);
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
