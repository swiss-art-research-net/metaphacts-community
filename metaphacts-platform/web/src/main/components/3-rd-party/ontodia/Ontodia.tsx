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
import { ClassAttributes, Children, createElement, cloneElement, ReactElement } from 'react';
import * as Kefir from 'kefir';
import { debounce } from 'lodash';
import {
  Rdf as OntodiaRdf,
  Workspace,
  WorkspaceProps,
  DataProvider,
  GraphBuilder,
  Dictionary,
  ElementModel,
  LinkTypeOptions,
  ElementIri,
  PropertyEditorOptions,
  LinkEditorOptions,
  AuthoringEvent,
  AuthoringState,
  CustomTypeStyle,
  EventObserver,
  SerializedDiagram,
  makeSerializedDiagram,
  Element,
  Link,
  IriClickEvent,
  LabelLanguageSelector,
  LinkModel,
  LinkTypeIri,
  InternalApi,
  CancellationToken,
  parseTurtleText,
  getColorForValues,
  ElementTypeIri,
} from 'ontodia';
import * as URI from 'urijs';
import './Ontodia.scss';

import { BuiltInEvents, trigger, listen, registerEventSource } from 'platform/api/events';
import { Cancellation, WrappingError } from 'platform/api/async';
import { Component, ComponentChildContext } from 'platform/api/components';
import { Rdf, turtle } from 'platform/api/rdf';
import { SparqlClient } from 'platform/api/sparql';
import {
  navigateToResource, openResourceInNewWindow, openExternalLink,
} from 'platform/api/navigation';
import { getPreferredUserLanguage, selectPreferredLabel } from 'platform/api/services/language';

import { CreateResourceDialog } from 'platform/components/ldp';
import { addToDefaultSet } from 'platform/api/services/ldp-set';
import { ConfirmationDialog } from 'platform/components/ui/confirmation-dialog';
import { navigationConfirmation } from 'platform/components/navigation';
import { isSimpleClick } from 'platform/components/navigation/ResourceLink';
import { getOverlaySystem } from 'platform/components/ui/overlay';
import { addNotification, ErrorNotification } from 'platform/components/ui/notification';
import { Spinner } from 'platform/components/ui/spinner';
import { componentHasType } from 'platform/components/utils';

import { OntodiaExtension } from './extensions';
import { DEFAULT_FACTORY } from './DefaultFactory';

import * as DiagramService from './data/DiagramService';
import {
  OntodiaDataProviders, OntodiaDataProvidersProps, CreateDataProviderParams, createDataProvider,
} from './data/OntodiaDataProviders';
import { OntodiaSparqlDataProvider } from './data/OntodiaSparqlDataProvider';

import { FieldBasedMetadataApi } from './authoring/FieldBasedMetadataApi';
import { FieldBasedValidationApi } from './authoring/FieldBasedValidationApi';
import {
  FieldConfiguration, OntodiaPersistenceMode, getOverriddenForm,
} from './authoring/FieldConfigurationCommon';
import {
  OntodiaFieldConfiguration, OntodiaFieldConfigurationProps, extractFieldConfiguration,
} from './authoring/OntodiaFieldConfiguration';
import { OntodiaPersistenceResult } from './authoring/OntodiaPersistence';
import { getEntityMetadata, getLinkMetadata } from './authoring/OntodiaPersistenceCommon';
import { SubjectSuggestionForm } from './authoring/SubjectSuggestionForm';

import { deriveCancellationToken } from './AsyncAdapters';
import * as OntodiaEvents from './OntodiaEvents';
import { OntodiaContext, OntodiaContextWrapper, OntodiaContextTypes } from './OntodiaContext';

/**
 * The component to display an Ontodia diagram.
 *
 * This component **MUST** be wrapped in HTML element with defined height.
 * Diagrams are loaded from and saved to `VocabPlatform:OntodiaDiagramContainer` LDP container.
 *
 * Ontodia will listen to `SemanticContext` and will load and save diagram layouts into specified
 * repository; however repository to load data is defined explicitly in data provider.
 *
 * **Example**: Display component with empty canvas:
 * ```
 * <ontodia></ontodia>
 * ```
 *
 * **Example**: Load diagram from resource and display it:
 * ```
 * <ontodia diagram='[[this]]'></ontodia>
 * ```
 *
 * **Example**: Display diagram with result elements and links created by construct query:
 * ```
 * <ontodia
 *   query='
 *     CONSTRUCT { <[[this]]> ?p ?o }
 *     WHERE {
 *       <[[this]]> ?p ?o
 *       FILTER (ISIRI(?o))
 *     } LIMIT 50
 * '></ontodia>
 * ```
 *
 * **Example**: Display diagram with only one element to start with:
 * ```
 * <ontodia iri='http://www.cidoc-crm.org/cidoc-crm/E22_Man-Made_Object'></ontodia>
 * ```
 */
export interface BaseOntodiaConfig {
  /**
   * Used as source ID for emitted events.
   */
  id?: string;

  /**
   * Diagram identifier to display saved diagram.
   */
  diagram?: string;
  /**
   * SPARQL query to display data on layout.
   * If property diagram is defined, this property will be ignored.
   */
  query?: string;
  /**
   * Repository which is used to execute SPARQL query specified in `query` property.
   * @default "default"
   */
  queryRepository?: string;
  /**
   * Graph to display on initialization.
   */
  graph?: string;
  /**
   * Iri to be used as a single diagram element
   * If property diagram or query is defined, this will be ignored.
   */
  iri?: string;
  /**
   * Elements to display on initialization
   */
  iris?: string[];

  /**
   * Controls if component should re-request all links from data provider when showing existing
   * graph (via loading the diagram or executing CONSTRUCT query):
   *   - `true`: if link is not found in the data, it is shown as dashed;
   *   - `false`: this setting speeds up initialization and the links on the diagram will
   *     be shown exactly as they were when the diagram was saved;
   *   - `'dismiss'`: works the same as setting it as `true` and additionally removes all
   *     links that were not found in the data;
   *
   * @default "true"
   */
  requestLinksOnInit?: boolean | 'dismiss';

  /**
   * Additional turtle data that will be parsed and attached to the saved diagram.
   */
  metadata?: string;
  /**
   * URI to navigate after diagram created.
   * Newly created diagram IRI will be appended as `diagram` query parameter.
   */
  navigateTo?: string;
  /**
   * Query parameters that will be appended to URL after diagram created.
   */
  queryParams?: { [key: string]: string; };
  /**
   * `true` if persisted component should be added to the default set of the current user
   *
   * @default false
   */
  addToDefaultSet?: boolean;

  /**
   * Custom images and colors of the elements
   */
  nodeStyles?: {
    [type: string]: OntodiaNodeStyle
  };

  /**
   * Default node style to apply to all elements, unless overridden
   */
  defaultNodeStyle?: OntodiaNodeStyle

  /**
   * Whether the diagram specified with `diagram` is the default diagram.
   */
  defaultDiagram?: boolean;

  /**
   * If the diagram was not already saved, this is used as the diagram name instead
   * of prompting the user.
   */
  defaultDiagramName?: string;

  /**
   * Additional turtle data that will be parsed and attached to the saved default diagram.
   */
  defaultDiagramMetadata?: string;

  /**
   * Links to group the nodes
   */
  groupBy?: {linkType: string; linkDirection: 'in' | 'out'}[];
  /**
   * Custom options for the links
   */
  linkSettings?: ReadonlyArray<{
    property: string;
    visible: boolean;
    showLabel?: boolean;
  }>;

  /**
   * SPARQL CONSTRUCT query to find a relationship between two elements.
   *
   * The query is expected to return a set of linked triples that should be added
   * to the diagram after being sorted to follow from source to target element.
   *
   * Parametrized inputs:
   *   - `?in` - source resource;
   *   - `?target` - target resource;
   */
  findRelationshipQuery?: string;

  /**
   * Disable navigation confirmation dialog, resource links will be followed without confirmation.
   */
  hideNavigationConfirmation?: boolean;

  /**
   * Controls whether Ontodia should navigate to a newly saved diagram.
   */
  postSaving?: 'navigate' | 'none';

  /**
   * Custom workspace layout, data provider and authoring config.
   */
  children?: {};
}

export interface OntodiaProps extends BaseOntodiaConfig, ClassAttributes<Ontodia> {
  onLoadWorkspace?: (workspace: Workspace) => void;
  children?: React.ReactNode;
}

export interface OntodiaNodeStyle {
  image?: string;
  color?: string;
  stylePropertyIri?: string;
}

interface State {
  readonly label?: string;
  readonly fieldConfiguration?: FieldConfiguration;
  readonly configurationError?: any;
  readonly diagramIri?: string;
  readonly defaultDiagram?: boolean;
}

const DEBOUNCE_DELAY = 300;

type DefaultProps = Pick<OntodiaProps,
  'navigateTo' | 'queryParams' | 'addToDefaultSet' | 'postSaving'
>;

interface SaveDiagramOptions {
  successMessage?: string;
  errorMessage?: string;
}

export class Ontodia extends Component<OntodiaProps, State> {
  static defaultProps: DefaultProps = {
    navigateTo: 'http://www.metaphacts.com/resource/assets/OntodiaView',
    queryParams: {},
    addToDefaultSet: false,
    postSaving: 'navigate',
  };

  static childContextTypes = {
    ...Component.childContextTypes,
    ...OntodiaContextTypes,
  };
  getChildContext(): ComponentChildContext & OntodiaContextWrapper {
    const {id} = this.props;
    const baseContext = super.getChildContext();
    const ontodiaContext: OntodiaContext = {
      ontodiaId: id,
      inAuthoringMode: () => {
        if (!this.workspace) { return false; }
        const {editor} = this.workspace.getContext();
        return editor.inAuthoringMode;
      },
      useLinkConfiguration: () => this.fieldConfiguration !== undefined,
      onSaveDiagram: this.onSaveDiagramPressed,
      onSaveDiagramAs: this.openSaveModal,
      onPersistChanges: this.onPersistAuthoredChanges,
      onPersistChangesAndSaveDiagram: this.onPersistChangesAndSaveDiagram,
      onShowInfo: this.onShowInfo,
      getFieldConfiguration: () => this.state.fieldConfiguration,
      makePersistence: () => {
        return makePersistenceFromConfig(this.state.fieldConfiguration.persistence);
      },
      loadDiagram: this.loadDiagram,
      getDiagramIri: () => this.state.diagramIri,
    };
    return {...baseContext, ontodiaContext};
  }

  private readonly cancellation = new Cancellation();
  private readonly listener = new EventObserver();

  private metadataApi: FieldBasedMetadataApi;
  private validationApi: FieldBasedValidationApi;
  private parsedMetadata: Kefir.Property<ReadonlyArray<Rdf.Quad>>;
  private parsedDefaultDiagramMetadata: Kefir.Property<ReadonlyArray<Rdf.Quad>>;

  workspace: Workspace;
  private dataProvider: DataProvider;

  private navigationListenerUnsubscribe?: () => void;

  private readonly fieldConfiguration: ReactElement<OntodiaFieldConfigurationProps>;

  private dataProvidersComponent: OntodiaDataProviders | null = null;

  constructor(props: OntodiaProps, context: any) {
    super(props, context);

    this.state = {
      diagramIri: props.diagram,
      defaultDiagram: props.defaultDiagram,
    };

    this.loadFieldConfiguration(deriveCancellationToken(this.cancellation));
    this.parsedMetadata = this.parseMetadata(props.metadata);
    this.parsedDefaultDiagramMetadata = this.parseMetadata(props.defaultDiagramMetadata);
  }

  componentDidUpdate(prevProps: OntodiaProps) {
    const {diagram} = this.props;
    if (diagram !== prevProps.diagram) {
      this.setState({diagramIri: diagram});
    }
  }

  private async loadFieldConfiguration(ct: CancellationToken) {
    const fieldConfigElement = Children.toArray(this.props.children).find(
      child => componentHasType(child, OntodiaFieldConfiguration)
    ) as ReactElement<OntodiaFieldConfigurationProps>;

    let fieldConfiguration: FieldConfiguration | undefined;
    let configurationError: unknown;
    try {
      fieldConfiguration = await extractFieldConfiguration(
        fieldConfigElement ? fieldConfigElement.props : undefined, ct
      );
    } catch (err) {
      // err also could be a CancellationError
      configurationError = err;
    }

    if (!ct.aborted) {
      if (fieldConfiguration) {
        const {
          startInAuthoringMode, generatePlaceholderLabel, entities, links,
        } = fieldConfiguration;
        this.metadataApi = new FieldBasedMetadataApi(entities, links, {generatePlaceholderLabel});
        this.validationApi = fieldConfiguration.enableValidation
          ? new FieldBasedValidationApi(entities, links)
          : undefined;
        this.setState({fieldConfiguration}, () => {
          trigger({
            source: this.props.id,
            eventType: OntodiaEvents.InAuthoringMode,
            data: {inAuthoringMode: startInAuthoringMode},
          });
        });
      } else {
        this.setState({configurationError});
      }
    }
  }

  render() {
    if (this.state.configurationError) {
      return createElement(ErrorNotification, {errorMessage: this.state.configurationError});
    } else if (OntodiaExtension.isLoading() || !this.state.fieldConfiguration) {
      return createElement(Spinner, {});
    }

    const preferredLanguage = getPreferredUserLanguage();

    const {groupBy, nodeStyles} = this.props;

    const {createWorkspace} = OntodiaExtension.get() || DEFAULT_FACTORY;

    let useDefaultDataProvider = true;
    let children = Children.map(this.props.children, child => {
      if (componentHasType(child, OntodiaFieldConfiguration)) {
        return null;
      }
      if (componentHasType(child, OntodiaDataProviders)) {
        useDefaultDataProvider = false;
        return cloneElement<OntodiaDataProvidersProps & ClassAttributes<OntodiaDataProviders>>(
          child,
          {ref: this.onDataProvidersMounted}
        );
      }
      return child;
    }) as Array<ReactElement<any>>;
    if (useDefaultDataProvider) {
      const defaultDataProvider = (
        <OntodiaDataProviders key='default-data-provider' ref={this.onDataProvidersMounted}>
          <OntodiaSparqlDataProvider/>
        </OntodiaDataProviders>
      );
      children = children ? [...children, defaultDataProvider] : [defaultDataProvider];
    }
    const useDefaultLayout = Children.count(children) === 1 &&
      componentHasType(children[0], OntodiaDataProviders);
    const props: WorkspaceProps & ClassAttributes<Workspace> = {
      ref: this.initWorkspace,
      language: preferredLanguage,
      factory: Rdf.DATA_FACTORY,
      metadataApi: this.metadataApi,
      validationApi: this.validationApi,
      onIriClick: this.onIriClick,
      groupBy,
      typeStyleResolver: nodeStyles ? this.resolveNodeStyles : undefined,
      elementStyleResolver: nodeStyles ? this.resolveElementStyles : undefined,
      selectLabelLanguage,
      propertyEditor: this.onEditEntity,
      linkEditor: this.onEditLink,
      children: Children.count(children) ? children : undefined,
    };
    return createWorkspace(this.props, props, useDefaultLayout);
  }

  componentDidMount() {
    OntodiaExtension.loadAndUpdate(this, this.cancellation);

    this.registerEventSources();

    const {id} = this.props;
    this.cancellation.map(
      listen({eventType: OntodiaEvents.Save, target: id})
    ).observe({
      value: (event) => {
        const {
          saveDiagram, saveDiagramAs, persistChanges, successMessage, errorMessage
        } = event.data ?? {};
        if (saveDiagramAs) {
          this.openSaveModal();
        } else if (saveDiagram ?? true) {
          if (persistChanges) {
            this.onPersistChangesAndSaveDiagram({ successMessage, errorMessage });
          } else {
            this.onSaveDiagramPressed({ successMessage, errorMessage });
          }
        } else if (persistChanges) {
          this.onPersistAuthoredChanges();
        }
      }
    });
    this.cancellation.map(
      listen({eventType: OntodiaEvents.Undo, target: id})
    ).observe({
      value: () => {
        if (this.workspace) {
          this.workspace.getModel().history.undo();
        }
      },
    });
    this.cancellation.map(
      listen({eventType: OntodiaEvents.Redo, target: id})
    ).observe({
      value: () => {
        if (this.workspace) {
          this.workspace.getModel().history.redo();
        }
      },
    });
    this.cancellation.map(
      listen({eventType: OntodiaEvents.ClearAll, target: id})
    ).observe({
      value: () => this.workspace.clearAll(),
    });
    this.cancellation.map(
      listen({eventType: OntodiaEvents.SetAuthoringMode, target: id})
    ).observe({
      value: ({data}) => this.trySetAuthoringMode(data.authoringMode),
    });
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
    this.listener.stopListening();
    if (this.navigationListenerUnsubscribe) {
      this.navigationListenerUnsubscribe();
    }
  }

  private onEditEntity = (options: PropertyEditorOptions): React.ReactElement<any> | null => {
    const {id} = this.props;
    trigger({
      source: id,
      eventType: OntodiaEvents.StopEditing,
      data: {},
    });
    const openEditPanel = (target: ElementIri) => {
      trigger({
        source: id,
        eventType: OntodiaEvents.StartEntityEditing,
        data: {
          iri: target,
        },
      });
    };
    if (options.afterCreate) {
      const {fieldConfiguration} = this.state;
      const metadata = getEntityMetadata(options.elementData, fieldConfiguration.entities);
      const hasCreateForm = Boolean(
        metadata &&
        getOverriddenForm(fieldConfiguration, {entityType: metadata.entityType}, 'create')
      );
      if (hasCreateForm) {
        return (
          <SubjectSuggestionForm
            editOptions={{
              type: 'entity',
              model: options.elementData,
              onSubmit: (newModel, originalIri) => {
                options.onFinish();
                openEditPanel(originalIri);
              },
              onCancel: () => options.onFinish(),
            }}
            applyState='create'
          />
        );
      }
    }
    openEditPanel(options.elementData.id);
    return null;
  }

  private onEditLink = (options: LinkEditorOptions): React.ReactElement<any> | null => {
    const {id} = this.props;
    trigger({
      source: id,
      eventType: OntodiaEvents.StopEditing,
      data: {},
    });
    const openEditPanel = (target: LinkModel) => {
      trigger({
        source: id,
        eventType: OntodiaEvents.StartLinkEditing,
        data: {
          iri: target.linkIri,
          sourceIri: target.sourceId,
          targetIri: target.targetId,
          typeIri: target.linkTypeId,
        },
      });
    };
    if (options.afterCreate) {
      const {fieldConfiguration} = this.state;
      const metadata = getLinkMetadata(options.linkData, fieldConfiguration.links);
      const hasCreateForm = Boolean(
        metadata &&
        getOverriddenForm(fieldConfiguration, {linkType: metadata.linkType}, 'create')
      );
      if (hasCreateForm) {
        return (
          <SubjectSuggestionForm
            editOptions={{
              type: 'link',
              model: options.linkData,
              onSubmit: newModel => {
                options.onFinish();
                openEditPanel(newModel);
              },
              onCancel: () => options.onFinish(),
            }}
            applyState='create'
          />
        );
      }
    }
    openEditPanel(options.linkData);
    return null;
  }

  private onDataProvidersMounted = (dataProviders: OntodiaDataProviders | null) => {
    if (dataProviders) {
      this.dataProvidersComponent = dataProviders;
    }
  }

  private registerEventSources() {
    const {id} = this.props;
    registerEventSource({
      source: id,
      eventType: OntodiaEvents.DiagramChanged,
      cancellation: this.cancellation,
    });
    registerEventSource({
      source: id,
      eventType: OntodiaEvents.DiagramIsDirty,
      cancellation: this.cancellation,
    });
    registerEventSource({
      source: id,
      eventType: OntodiaEvents.InAuthoringMode,
      cancellation: this.cancellation,
    });
    registerEventSource({
      source: id,
      eventType: OntodiaEvents.SelectedElements,
      cancellation: this.cancellation,
    });
    registerEventSource({
      source: id,
      eventType: OntodiaEvents.SelectedLinks,
      cancellation: this.cancellation,
    });
  }

  private onIriClick = ({iri: elementIri, clickIntent, originalEvent}: IriClickEvent) => {
    const iri = Rdf.iri(elementIri);
    if (clickIntent === 'jumpToEntity' || clickIntent === 'openEntityIri') {
      if (isSimpleClick(originalEvent)) {
        navigateToResource(iri).onEnd(() => { /* nothing */ });
      } else {
        openResourceInNewWindow(iri);
      }
    } else {
      const {target = '_blank'} = originalEvent.target as HTMLAnchorElement;
      openExternalLink(URI(iri.value), target).onEnd(() => { /* nothing */ });
    }
  }

  /**
   * Initializes workspace
   */
  private initWorkspace = (workspace: Workspace) => {
    if (workspace) {
      const {onLoadWorkspace, hideNavigationConfirmation} = this.props;
      const {fieldConfiguration} = this.state;

      this.workspace = workspace;
      if (onLoadWorkspace) {
        onLoadWorkspace(workspace);
      }

      const {editor} = workspace.getContext();
      editor.setAuthoringMode(fieldConfiguration.startInAuthoringMode);

      const params: CreateDataProviderParams = {fieldConfiguration};
      const {
        dataProvider,
        initializeDataProvider,
      } = createDataProvider(this.dataProvidersComponent.dataProviders, params);

      this.dataProvider = dataProvider;
      if (this.validationApi) {
        this.validationApi.setDataProvider(this.dataProvider);
      }

      initializeDataProvider().observe({
        value: () => this.importLayout(),
        error: err => this.setState({configurationError: err}),
      });

      if (!hideNavigationConfirmation) {
        this.registerNavigationConfirmation();
      }

      this.subscribeOnEvents();
      this.subscribeOnAuthoringEvents();
    }
  }

  private subscribeOnEvents() {
    const {id} = this.props;
    const {model, editor} = this.workspace.getContext();

    const triggerEvent = debounce(() => {
      trigger({
        source: id,
        eventType: OntodiaEvents.DiagramChanged,
        data: {
          model: model,
          authoringState: editor.authoringState,
          temporaryState: editor.temporaryState,
        },
      });
    }, DEBOUNCE_DELAY);

    this.listener.listen(model.events, 'changeCells', triggerEvent);
    this.listener.listen(model.events, 'elementEvent', event => {
      if (event.key === 'changeData') {
        triggerEvent();
      }
    });
    this.listener.listen(editor.events, 'changeAuthoringState', triggerEvent);
    this.listener.listen(editor.events, 'changeTemporaryState', triggerEvent);
    this.listener.listen(editor.events, 'changeSelection', this.onChangeSelection);

    this.cancellation.map(
      listen({
        eventType: OntodiaEvents.FocusOnElement,
        target: id,
      })
    ).observe({
      value: ({data}) => {
        const element = model.elements.find(({iri}) => iri === data.iri);
        if (element) {
          this.workspace.forEachCanvas(canvas => {
            canvas.getCommands().trigger('zoomToContent', {elements: [element], links: []});
          });
          editor.setSelection([element]);
        }
      }
    });
  }

  private onChangeSelection = () => {
    const {id: source} = this.props;
    const {editor: {selection}} = this.workspace.getContext();

    const elements: Array<{ iri: string }> = [];
    const links: Array<{
      linkIri?: string, linkTypeIri: string; sourceIri: string; targetIri: string
    }> = [];
    selection.forEach(item => {
      if (item instanceof Element) {
        elements.push({iri: item.iri});
      } else if (item instanceof Link) {
        const {linkIri, linkTypeId, sourceId, targetId} = item.data;
        links.push({linkIri, linkTypeIri: linkTypeId, sourceIri: sourceId, targetIri: targetId});
      }
    });
    trigger({
      eventType: OntodiaEvents.SelectedElements,
      source,
      data: {elements: elements.length ? elements : undefined},
    });
    trigger({
      eventType: OntodiaEvents.SelectedLinks,
      source,
      data: {links: links.length ? links : undefined},
    });
  }

  private subscribeOnAuthoringEvents() {
    const {id} = this.props;
    const {model, editor} = this.workspace.getContext();
    this.cancellation.map(
      listen({
        eventType: OntodiaEvents.CreateElement,
        target: id,
      })
    ).map((event): typeof event.data & { elementModel: ElementModel } => {
      const elementData = event.data.elementData as ElementModel;
      return {
        ...event.data,
        elementModel: {
          ...elementData,
          id: this.metadataApi.generateIriForModel(elementData),
        }
      };
    }).observe({
      value: ({elementModel, targets}) => {
        const element = editor.createNewEntity({elementModel: elementModel as ElementModel});
        targets.forEach(({targetIri, linkTypeIri}) => {
          const target = model.elements.find(el => el.iri === targetIri);
          if (target) {
            const linkModel: LinkModel = {
              linkTypeId: linkTypeIri as LinkTypeIri,
              sourceId: element.iri,
              targetId: target.iri,
              properties: {},
            };
            const link = new Link({
              id: linkTypeIri as LinkTypeIri,
              sourceId: element.id,
              targetId: target.id,
              data: linkModel,
            });
            editor.createNewLink({link});
          }
        });
      }
    });

    this.cancellation.map(
      listen({
        eventType: OntodiaEvents.EditElement,
        target: id,
      })
    ).observe({
      value: event => {
        const {targetIri, elementData} = event.data;
        editor.changeEntityData(targetIri as ElementIri, elementData as ElementModel);
      },
    });

    this.cancellation.map(
      listen({
        eventType: OntodiaEvents.DeleteElement,
        target: id,
      })
    ).observe({
      value: event => {
        editor.deleteEntity(event.data.iri as ElementIri);
      },
    });
  }

  private trySetAuthoringMode(authoringMode: boolean) {
    const {model, editor} = this.workspace.getContext();
    if (!editor.inAuthoringMode && authoringMode) {
      editor.setAuthoringMode(true);
      this.notifyAuthoringModeChanged();
    } else if (editor.inAuthoringMode && !authoringMode) {
      if (AuthoringState.isEmpty(editor.authoringState)) {
        editor.setAuthoringMode(false);
        this.notifyAuthoringModeChanged();
      } else {
        this.confirmDiscardChanges(() => {
          this.discardAuthoringState();
          editor.setAuthoringMode(false);
          this.notifyAuthoringModeChanged();
        });
      }
    }
  }

  private discardAuthoringState() {
    const { editor } = this.workspace.getContext();
    const events: AuthoringEvent[] = [];
    editor.authoringState.elements.forEach(e => events.push(e));
    editor.authoringState.links.forEach(e => events.push(e));

    editor.discardChanges(events);
  }

  private notifyAuthoringModeChanged() {
    const {id} = this.props;
    const {editor} = this.workspace.getContext();
    if (!editor.inAuthoringMode) {
      // send event to self to cancel entity editing
      trigger({
        source: id,
        targets: id ? [id] : [],
        eventType: OntodiaEvents.StopEditing,
      });
    }
    trigger({
      source: this.props.id,
      eventType: OntodiaEvents.InAuthoringMode,
      data: {inAuthoringMode: editor.inAuthoringMode},
    });
  }

  private confirmDiscardChanges(action: () => void) {
    const dialogRef = 'ontodia-confirm-discard-changes';
    const hideDialog = () => getOverlaySystem().hide(dialogRef);
    const dialog = (
      <ConfirmationDialog
        message='Are you sure to discard unsaved changes?'
        confirmLabel='Discard'
        confirmVariant='danger'
        onHide={hideDialog}
        onConfirm={confirm => {
          hideDialog();
          if (confirm) {
            action();
          }
        }}
      />
    );
    getOverlaySystem().show(dialogRef, dialog);
  }

  private importLayout() {
    const layoutImporting = Kefir.combine([
      Kefir.fromPromise(this.setLayout()),
      this.parsedMetadata,
      this.parsedDefaultDiagramMetadata,
    ]);
    this.cancellation.map(layoutImporting).observe({
      error: configurationError => this.setState({configurationError}),
      end: () => {
        if (this.props.id) {
          trigger({eventType: BuiltInEvents.ComponentLoaded, source: this.props.id});
        }
      }
    });
    if (this.props.id) {
      trigger({
        eventType: BuiltInEvents.ComponentLoading,
        source: this.props.id,
        data: layoutImporting.toProperty(),
      });
    }
  }

  private registerNavigationConfirmation() {
    const model = this.workspace.getModel();
    this.listener.listen(model.history.events, 'historyChanged', ({hasChanges}) => {
      if (hasChanges && this.props.id) {
        trigger({
          eventType: OntodiaEvents.DiagramIsDirty,
          source: this.props.id,
          data: {hasChanges},
        });
      }
      if (hasChanges && !this.navigationListenerUnsubscribe) {
        const message = 'Changes you made to the diagram will not be saved.';
        this.navigationListenerUnsubscribe = navigationConfirmation(message);
      } else if (!hasChanges && this.navigationListenerUnsubscribe) {
        this.navigationListenerUnsubscribe();
        this.navigationListenerUnsubscribe = undefined;
      }
    });
  }

  private parseMetadata(metadata: string): Kefir.Property<ReadonlyArray<Rdf.Quad>> {
    if (metadata) {
      return this.cancellation.map(
        turtle.deserialize.turtleToTriples(metadata)
          .mapErrors(error => new WrappingError(`Invalid metadata format`, error))
      );
    } else {
      return Kefir.constant([]);
    }
  }

  private onSaveDiagramPressed = (options?: SaveDiagramOptions) => {
    const {diagramIri} = this.state;
    if (diagramIri || this.props.defaultDiagramName) {
      const layout = this.workspace.getModel().exportLayout();
      const label = this.state.label ?? this.props.defaultDiagramName;

      let saveAction: Kefir.Observable<void>;
      if (diagramIri) {
        const parsedMetadata = this.state.defaultDiagram ?
          this.parsedDefaultDiagramMetadata : this.parsedMetadata;
        saveAction = parsedMetadata.flatMap(metadata =>
          DiagramService.updateDiagram(diagramIri, layout, label, metadata)
        ).map(results => {
          trigger({
            eventType: OntodiaEvents.DiagramSaved,
            source: this.props.id,
            data: {resourceIri: this.state.diagramIri},
          });
          trigger({
            eventType: OntodiaEvents.DiagramIsDirty,
            source: this.props.id,
            data: {hasChanges: false},
          });
          return results;
        });
      } else {
        saveAction = this.onSaveModalSubmit(this.props.defaultDiagramName, layout, true)
          .map(() => { /*void*/ });
      }

      this.cancellation.map(saveAction).observe({
        value: () => {
          this.workspace.getModel().history.reset();
          addNotification({
            level: 'success',
            message: options?.successMessage ?? `Saved diagram ${label}`,
          });
        },
        error: error => addNotification({
          level: 'error',
          message: options?.errorMessage ?? `Error saving diagram ${label}`,
        }, error)
      });
    } else {
      this.openSaveModal();
    }
  }

  private onPersistAuthoredChanges = () => {
    this.workspace.showWaitIndicatorWhile(
      this.persistAuthoredChanges()
    );
  }

  private onPersistChangesAndSaveDiagram = (options?: SaveDiagramOptions) => {
    this.workspace.showWaitIndicatorWhile(
      this.persistAuthoredChanges().then(
        () => this.onSaveDiagramPressed(options)
      )
    );
  }

  private persistAuthoredChanges(): Promise<void> {
    const {model, editor} = this.workspace.getContext();
    const {fieldConfiguration} = this.state;
    const persistence = makePersistenceFromConfig(fieldConfiguration.persistence);

    const existingModels = new Map<ElementIri, ElementModel>();
    model.elements.forEach(element => existingModels.set(element.iri, element.data));

    const fetchModel = (iri: ElementIri): Kefir.Property<ElementModel> => {
      if (existingModels.has(iri)) {
        return Kefir.constant(existingModels.get(iri));
      }
      return Kefir.fromPromise(
        model.dataProvider.elementInfo({elementIds: [iri]})
          .then(result => result[iri])
      ).toProperty();
    };

    return persistence.persist({
      dataProvider: model.dataProvider,
      entityMetadata: fieldConfiguration.entities,
      state: editor.authoringState,
      fetchModel,
    }).map(this.onChangesPersisted).toPromise();
  }

  private onChangesPersisted = (result: OntodiaPersistenceResult) => {
    const {model, editor} = this.workspace.getContext();

    for (const element of [...model.elements]) {
      const changed = result.finalizedEntities.get(element.iri);
      if (changed) {
        element.setData(changed);
      } else if (changed === null) {
        model.removeElement(element.id);
      }
    }

    for (const link of [...model.links]) {
      const event = editor.authoringState.links.get(link.data);
      if (event && event.deleted) {
        model.removeLink(link.id);
      }
    }

    editor.setAuthoringState(AuthoringState.empty);
    editor.cancelSelection();
    model.history.reset();

    trigger({
      source: this.props.id,
      eventType: OntodiaEvents.ChangesPersisted,
    });
    trigger({
      source: this.props.id,
      eventType: OntodiaEvents.DiagramChanged,
      data: {
        model: model,
        authoringState: editor.authoringState,
        temporaryState: editor.temporaryState,
      },
    });
  }

  /**
   * Set diagram layout
   */
  private setLayout(): Promise<void> {
    const {query, iri, linkSettings, iris, graph} = this.props;
    const {diagramIri} = this.state;

    let importingLayout: Promise<void>;
    if (diagramIri) {
      importingLayout = this.setLayoutByDiagram(diagramIri);
    } else if (query) {
      importingLayout = this.setLayoutBySparqlQuery(query);
    } else if (graph) {
      importingLayout = this.setLayoutByProvisionData(graph);
    } else if (iri) {
      importingLayout = this.setLayoutByIri(iri);
    } else if (iris) {
      importingLayout = this.setLayoutByIris(iris);
    } else {
      importingLayout = this.importModelLayout({
        preloadedElements: {},
        diagram: makeSerializedDiagram({
          linkTypeOptions: linkSettings as ReadonlyArray<LinkTypeOptions>
        })
      });
    }

    return importingLayout.then(() => {
      this.workspace.getModel().history.reset();
    });
  }

  /**
   * Sets diagram layout by sparql query
   */
  private setLayoutBySparqlQuery(query: string): Promise<void> {
    const {
      performInitialLayout: performDiagramLayout,
    } = OntodiaExtension.get() || DEFAULT_FACTORY;
    const {queryRepository = 'default'} = this.props;
    const loadingLayout = getGraphBySparqlQuery(query, [queryRepository]).then(graph => {
      const layoutProvider = new GraphBuilder(this.dataProvider);
      return layoutProvider.getGraphFromRDFGraph(graph);
    });
    this.workspace.showWaitIndicatorWhile(loadingLayout);

    return loadingLayout.then(res =>
      this.importModelLayout({
        preloadedElements: res.preloadedElements,
        diagram: {
          ...res.diagram,
          linkTypeOptions: this.props.linkSettings as ReadonlyArray<LinkTypeOptions>,
        },
      })
    ).then(() => {
      performDiagramLayout(this.props, this.workspace);
    });
  }

  /**
   * Sets diagram layout by diagram id
   */
  private setLayoutByDiagram(diagram: string): Promise<void> {
    const loadingLayout = DiagramService.getDiagramByIri(diagram, {repository: 'assets'});
    this.workspace.showWaitIndicatorWhile(loadingLayout);

    return loadingLayout.then(res => {
      this.setState({label: res.label});
      return this.importModelLayout({
        diagram: res.diagram,
      });
    }).then(() => {
      this.workspace.forEachCanvas(canvas => {
        canvas.getCommands().trigger('zoomToFit', {});
      });
    });
  }

  private setLayoutByProvisionData(graph: string): Promise<void> {
    const quads = parseTurtleText(graph, Rdf.DATA_FACTORY);
    const {performInitialLayout} = OntodiaExtension.get() || DEFAULT_FACTORY;
    const layoutProvider = new GraphBuilder(this.dataProvider);
    const loadingLayout = layoutProvider.getGraphFromRDFGraph(quads);
    this.workspace.showWaitIndicatorWhile(loadingLayout);

    return loadingLayout.then(res =>
      this.importModelLayout({
        preloadedElements: res.preloadedElements,
        diagram: {
          ...res.diagram,
          linkTypeOptions: this.props.linkSettings as ReadonlyArray<LinkTypeOptions>,
        },
      })
    ).then(() => {
      performInitialLayout(this.props, this.workspace);
    });
  }

  private setLayoutByIri(iri: string): Promise<void> {
    return this.setLayoutByIris([iri]).then(() => {
      const {id} = this.props;
      const {model} = this.workspace.getContext();
      const element = model.elements.find(({data}) => data.id === iri);
      if (element) {
        // shift canvas to the right to encompass newly opened connections menu
        this.workspace.forEachCanvas(canvas => {
          const {width, height} = canvas.canvasState.getElementSize(element);
          const position = {
            x: element.position.x + width / 2 + 500,
            y: element.position.y + height / 2,
          };
          canvas.getCommands().trigger('centerTo', {position});
        });
        trigger({
          source: id,
          eventType: OntodiaEvents.OpenConnectionsMenu,
          targets: id ? [id] : undefined,
          data: {id: element.id},
        });
      }
    });
  }
  private setLayoutByIris(iris: string[]): Promise<void> {
    const {
      performInitialLayout: performDiagramLayout,
    } = OntodiaExtension.get() || DEFAULT_FACTORY;
    const layoutProvider = new GraphBuilder(this.dataProvider);
    const buildingGraph = layoutProvider.createGraph({
      elementIds: iris.map(iri => iri as ElementIri),
      links: []
    });
    this.workspace.showWaitIndicatorWhile(buildingGraph);

    return buildingGraph.then(res => this.importModelLayout({
      preloadedElements: res.preloadedElements,
      diagram: {
        ...res.diagram,
        linkTypeOptions: this.props.linkSettings as ReadonlyArray<LinkTypeOptions>,
      },
    }).then(() => {
      performDiagramLayout(this.props, this.workspace);
    }));
  }

  /**
   * Imports layout to diagram model
   */
  private importModelLayout = (layout: {
    preloadedElements?: Dictionary<ElementModel>;
    diagram?: SerializedDiagram;
  } = {}): Promise<void> => {
    const {requestLinksOnInit = true} = this.props;
    const model = this.workspace.getModel();
    return model.importLayout({
      dataProvider: this.dataProvider,
      preloadedElements: layout.preloadedElements ?? {},
      diagram: layout.diagram,
      validateLinks: requestLinksOnInit,
    });
  }

  private loadDiagram = (diagramIri: string, diagramIsDefault: boolean) => {
    return this.setLayoutByDiagram(diagramIri).then(() => {
      this.discardAuthoringState();
      this.workspace.getModel().history.reset();
      this.setState({ diagramIri, defaultDiagram: diagramIsDefault });
    });
  }

  private onShowInfo = (target: Element): void => {
    trigger({
      source: this.props.id,
      eventType: OntodiaEvents.ShowElementInfo,
      data: {
        iri: target.iri
      },
    });
  }

  /**
   * Opens save modal
   */
  private openSaveModal = (): void => {
    const dialogRef = 'create-new-resource';
    const layout = this.workspace.getModel().exportLayout();

    getOverlaySystem().show(
      dialogRef,
      createElement(CreateResourceDialog, {
        onSave: label => this.onSaveModalSubmit(label, layout, false),
        onHide: () => getOverlaySystem().hide(dialogRef),
        show: true,
        title: 'Save Ontodia diagram',
        placeholder: 'Enter diagram name',
      })
    );
  }


  private onSaveModalSubmit(
    label: string,
    layout: SerializedDiagram,
    diagramIsDefault: boolean
  ): Kefir.Property<{}> {
    this.setState({label});
    return this.cancellation.map(
      (diagramIsDefault ? this.parsedDefaultDiagramMetadata : this.parsedMetadata).flatMap(
        metadata => DiagramService.saveDiagram(label, layout, metadata)
      )
    ).flatMap(
      res => this.props.addToDefaultSet ? addToDefaultSet(res, this.props.id) : Kefir.constant(res)
    ).flatMap(diagramIri => {
      this.workspace.getModel().history.reset();
      if (this.props.postSaving === 'navigate') {
        const props = {...this.props.queryParams, diagram: diagramIri.value};
        return navigateToResource(Rdf.iri(this.props.navigateTo), props);
      }
      this.setState({diagramIri: diagramIri.value, defaultDiagram: diagramIsDefault});
      return Kefir.constant(undefined);
    }).map(results => {
      trigger({
        eventType: OntodiaEvents.DiagramSaved,
        source: this.props.id,
        data: {resourceIri: this.state.diagramIri},
      });
      trigger({
        eventType: OntodiaEvents.DiagramIsDirty,
        source: this.props.id,
        data: {hasChanges: false},
      });
      return results;
    }).mapErrors(error => {
      addNotification({level: 'error', message: `Error saving diagram ${label}`}, error);
      return error;
    }).toProperty();
  }

  private resolveNodeStyles = (types: string[]): CustomTypeStyle => {
    const {nodeStyles, defaultNodeStyle} = this.props;
    for (const type in nodeStyles) {
      if (!Object.prototype.hasOwnProperty.call(nodeStyles, type)) { continue; }
      if (types.indexOf(type) >= 0) {
        const {image, color} = nodeStyles[type];
        if (!defaultNodeStyle) {
          return {icon: image, color};
        } else {
          return {
            icon: image ? image : defaultNodeStyle.image,
            color: color ? color : defaultNodeStyle.color
          };
        }
      }
    }
    return defaultNodeStyle;
  }

  private resolveElementStyles = (element: ElementModel): CustomTypeStyle => {
    const {nodeStyles, defaultNodeStyle} = this.props;
    for (const type in nodeStyles) {
      if (!Object.prototype.hasOwnProperty.call(nodeStyles, type)) { continue; }
      if ((element.types).indexOf(type as ElementTypeIri) >= 0) {
        const nodeStyle = nodeStyles[type];
        const { stylePropertyIri } = nodeStyle;
        if (stylePropertyIri) {
          const term = element.properties[stylePropertyIri]?.values[0];
          if (term) {
            const stylePropertyValue = term.value;
            let color: string;
            let image: string;
            // Check if a static style is defined for property value.
            // Otherwise property value will be used to generate the color
            if (stylePropertyValue in nodeStyles) {
              const styleForPropertyValue = nodeStyles[stylePropertyValue];
              color = styleForPropertyValue.color;
              image = styleForPropertyValue.image;
            } else {
              color = getColorForValues([stylePropertyValue], 0x0BADBEEF);
              image = nodeStyle.image;
            }
            return { color, icon: image };
          }
          // else view.ts#resolveElementStyle will fall back to type style
        }
      }
    }
    return undefined;
  }
}

function makePersistenceFromConfig(
  mode: OntodiaPersistenceMode = {type: 'form'}
) {
  const factory = OntodiaExtension.get() || DEFAULT_FACTORY;
  return factory.getPersistence(mode);
}

const selectLabelLanguage: LabelLanguageSelector = (labels, language) => {
  return selectPreferredLabel(labels, language);
};

/**
 * Returns graph to build diagram by sparql query
 * Will run on default context
 */
function getGraphBySparqlQuery(
  query: string, repositories: string[]
): Promise<Rdf.Quad[]> {
  return Kefir.combine(
    repositories.map(repository => SparqlClient.construct(query, {context: {repository}}))
  ).map(triples => {
    const quadSet = new InternalApi.HashSet(OntodiaRdf.hashQuad, OntodiaRdf.equalQuads);
    const uniqueQuads: Rdf.Quad[] = [];

    for (const repositoryGraph of triples) {
      for (const t of repositoryGraph) {
        if (!quadSet.has(t)) {
          quadSet.add(t);
          uniqueQuads.push(t);
        }
      }
    }

    return uniqueQuads;
  }).toPromise();
}

export default Ontodia;
