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
  PropertySuggestionParams,
  PropertyScore,
  AuthoringState,
  AuthoringKind,
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
} from 'ontodia';
import * as URI from 'urijs';

import {
  BuiltInEvents, trigger, listen, registerEventSource, unregisterEventSource,
} from 'platform/api/events';
import { Cancellation, WrappingError } from 'platform/api/async';
import { Component, ComponentChildContext } from 'platform/api/components';
import { Rdf, turtle } from 'platform/api/rdf';
import { SparqlClient } from 'platform/api/sparql';
import {
  navigateToResource, openResourceInNewWindow, openExternalLink,
} from 'platform/api/navigation';
import { navigationConfirmation } from 'platform/components/navigation';
import {
  isSimpleClick,
} from 'platform/components/navigation/ResourceLink';

import * as Forms from 'platform/components/forms';
import { CreateResourceDialog } from 'platform/components/ldp';
import { addToDefaultSet } from 'platform/api/services/ldp-set';
import { getOverlaySystem } from 'platform/components/ui/overlay';
import { addNotification, ErrorNotification } from 'platform/components/ui/notification';
import { Spinner } from 'platform/components/ui/spinner';
import { componentHasType } from 'platform/components/utils';
import { getPreferredUserLanguage, selectPreferredLabel } from 'platform/api/services/language';

import { OntodiaExtension } from './extensions';
import { DEFAULT_FACTORY } from './DefaultFactory';

import * as DiagramService from './data/DiagramService';
import {
  OntodiaDataProviders, OntodiaDataProvidersProps, CreateDataProviderParams, createDataProvider,
} from './data/OntodiaDataProviders';
import { OntodiaSparqlDataProvider } from './data/OntodiaSparqlDataProvider';

import { EntityForm, EntityFormProps } from './authoring/EntityForm';
import { FieldBasedMetadataApi } from './authoring/FieldBasedMetadataApi';
import { FieldBasedValidationApi } from './authoring/FieldBasedValidationApi';
import {
  FieldConfiguration, OntodiaPersistenceMode, isObjectProperty,
} from './authoring/FieldConfigurationCommon';
import {
  OntodiaFieldConfiguration, OntodiaFieldConfigurationProps, extractFieldConfiguration,
} from './authoring/OntodiaFieldConfiguration';
import { OntodiaPersistenceResult } from './authoring/OntodiaPersistence';
import {
  getEntityMetadata, convertCompositeValueToElementModel, convertElementModelToCompositeValue
} from './authoring/OntodiaPersistenceCommon';

import { deriveCancellationToken } from './AsyncAdapters';
import * as OntodiaEvents from './OntodiaEvents';
import { OntodiaContext, OntodiaContextWrapper, OntodiaContextTypes } from './OntodiaContext';

export interface BaseOntodiaConfig {
  /**
   * Used as source id for emitted events.
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
   * @default 'default'
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
   * graph (via loading the diagram or executing CONSTRUCT query), if link is not found in the
   * data, it is shown as dashed. Setting this to false speeds up initialization and the links on
   * the diagram will be shown exactly as they were when the diagram was saved.
   * @default true
   */
  requestLinksOnInit?: boolean;
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
  nodeStyles?: {[type: string]: {image: string; color: string}};

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
   * Sparql query to get suggested properties of elements.
   */
  propertySuggestionQuery?: string;

  /**
   * Sparql query to find a relationship between two elements.
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
  children?: JSX.Element | ReadonlyArray<JSX.Element>;
}

export interface OntodiaProps extends BaseOntodiaConfig, ClassAttributes<Ontodia> {
  onLoadWorkspace?: (workspace: Workspace) => void;
}

interface State {
  readonly label?: string;
  readonly fieldConfiguration?: FieldConfiguration;
  readonly configurationError?: any;
  readonly diagramIri?: string;
}

const DEBOUNCE_DELAY = 300;

/**
 * This component will render Ontodia diagram,
 * load and save it from VocabPlatform.OntodiaDiagramContainer.
 * This component _MUST_ be wrapped in HTML element with defined height.
 *
 * Ontodia will listen to `SemanticContext` and will load and save diagram layouts into specified
 * repository. However, Data will always be loaded from default repository.
 *
 * @example
 * Display component with empty canvas:
 * ```
 * <ontodia></ontodia>
 * ```
 *
 * Load diagram from resource and display it:
 * ```
 * <ontodia diagram=[[this]]></ontodia>
 * ```
 *
 * Display diagram with result elements and links created by construct query:
 * ```
 * <ontodia
 *   query='
 *     CONSTRUCT { <[[this.value]]> ?p ?o }
 *     WHERE {
 *       <[[this.value]]> ?p ?o
 *       FILTER (ISIRI(?o))
 *     } LIMIT 50
 * '></ontodia>
 * ```
 *
 * Display diagram with only one element to start with
 * ```
 * <ontodia iri="http://www.cidoc-crm.org/cidoc-crm/E22_Man-Made_Object"></ontodia>
 * ```
 *
 * Specify a property to display image for elements:
 * ```
 * <ontodia
 * query='
 *   CONSTRUCT {
 *     ?inst ?propType1 ?propValue1.
 *   } WHERE {
 *     BIND (<http://www.cidoc-crm.org/cidoc-crm/E22_Man-Made_Object> as ?inst)
 *     OPTIONAL {?propValue1 ?propType1 ?inst.  FILTER(isURI(?propValue1)). }
 *   } LIMIT 100
 * ' image-iris='["http://collection.britishmuseum.org/id/ontology/PX_has_main_representation"]'>
 * </ontodia>
 * ```
 *
 * Specifying a query to resolve image URLs:
 * ```
 * <ontodia
 * query='
 *   CONSTRUCT {
 *     ?inst ?propType1 ?propValue1.
 *   } WHERE {
 *     BIND (<http://www.cidoc-crm.org/cidoc-crm/E22_Man-Made_Object> as ?inst)
 *     OPTIONAL {?propValue1 ?propType1 ?inst.  FILTER(isURI(?propValue1)). }
 *   } LIMIT 100
 * '
 * '
 * >
 *  <ontodia-data-providers>
 *    <ontodia-sparql-provider image-query='
 *      SELECT ?element ?image {
 *      ?element <http://collection.britishmuseum.org/id/ontology/PX_has_main_representation> ?image
 *      }'>
 *    </ontodia-sparql-provider>
 *  </ontodia-data-providers>
 * </ontodia>
 * ```
 */
export class Ontodia extends Component<OntodiaProps, State> {
  static defaultProps: Partial<OntodiaProps> = {
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
    const baseContext = super.getChildContext();
    const ontodiaContext: OntodiaContext = {
      inAuthoringMode: () => {
        return this.state.fieldConfiguration && this.state.fieldConfiguration.authoringMode;
      },
      useLinkConfiguration: () => this.fieldConfiguration !== undefined,
      onSaveDiagram: this.onSaveDiagramPressed,
      onSaveDiagramAs: this.openSaveModal,
      onPersistChanges: this.onPersistAuthoredChanges,
      onPersistChangesAndSaveDiagram: this.onPersistChangesAndSaveDiagram,
      onShowInfo: this.onShowInfo,
    };
    return {...baseContext, ontodiaContext};
  }

  private readonly cancellation = new Cancellation();
  private readonly listener = new EventObserver();

  private metadataApi: FieldBasedMetadataApi;
  private validationApi: FieldBasedValidationApi;
  private parsedMetadata: Kefir.Property<ReadonlyArray<Rdf.Triple>>;

  workspace: Workspace;
  private dataProvider: DataProvider;

  private navigationListenerUnsubscribe?: () => void;

  private readonly fieldConfiguration: ReactElement<OntodiaFieldConfigurationProps>;

  private dataProvidersComponent: OntodiaDataProviders | null = null;

  constructor(props: OntodiaProps, context: any) {
    super(props, context);

    this.state = {
      diagramIri: props.diagram,
    };

    this.loadFieldConfiguration(deriveCancellationToken(this.cancellation));
    this.parsedMetadata = this.parseMetadata();
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
        if (fieldConfiguration.authoringMode) {
          this.metadataApi = new FieldBasedMetadataApi(fieldConfiguration.metadata);
          this.validationApi = new FieldBasedValidationApi(fieldConfiguration.metadata);
        }
        this.setState({fieldConfiguration});
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

    const {groupBy, propertySuggestionQuery, nodeStyles} = this.props;
    const {fieldConfiguration} = this.state;

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
      suggestProperties: propertySuggestionQuery ? this.suggestProperties : undefined,
      typeStyleResolver: nodeStyles ? this.resolveNodeStyles : undefined,
      selectLabelLanguage,
      propertyEditor: this.renderPropertyEditor,
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
      value: this.onSaveDiagramPressed,
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
      listen({eventType: OntodiaEvents.OpenConnectionsMenu, target: id})
    ).observe({
      value: event => {
        const editor = this.workspace.getEditor();
        const model = this.workspace.getModel();
        const {id: elementId} = event.data;
        if (elementId) {
          const element = model.getElement(elementId);
          if (element) {
            editor.showConnectionsMenu(element);
          }
        } else {
          editor.hideDialog();
        }
      },
    });
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
    this.listener.stopListening();
    if (this.navigationListenerUnsubscribe) {
      this.navigationListenerUnsubscribe();
    }

    this.unregisterEventSources();
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
    });
    registerEventSource({
      source: id,
      eventType: OntodiaEvents.DiagramIsDirty,
    });
    registerEventSource({
      source: id,
      eventType: OntodiaEvents.SelectedElements,
    });
    registerEventSource({
      source: id,
      eventType: OntodiaEvents.SelectedLinks,
    });
  }

  private unregisterEventSources() {
    const {id} = this.props;
    unregisterEventSource({
      source: id,
      eventType: OntodiaEvents.DiagramChanged,
    });
    unregisterEventSource({
      source: id,
      eventType: OntodiaEvents.DiagramIsDirty,
    });
    unregisterEventSource({
      source: id,
      eventType: OntodiaEvents.SelectedElements,
    });
    unregisterEventSource({
      source: id,
      eventType: OntodiaEvents.SelectedLinks,
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
      });

      if (!hideNavigationConfirmation) {
        this.registerNavigationConfirmation();
      }

      this.subscribeOnEvents();
      if (fieldConfiguration.authoringMode) {
        this.subscribeOnAuthoringEvents();
      }
    }
  }

  private subscribeOnEvents() {
    const {id} = this.props;
    const model = this.workspace.getModel();
    const editor = this.workspace.getEditor();

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
    const {selection} = this.workspace.getEditor();

    const elements: Array<{ iri: string }> = [];
    const links: Array<{ linkTypeIri: string; sourceIri: string; targetIri: string }> = [];
    selection.forEach(item => {
      if (item instanceof Element) {
        elements.push({iri: item.iri});
      } else if (item instanceof Link) {
        const {linkTypeId, sourceId, targetId} = item.data;
        links.push({linkTypeIri: linkTypeId, sourceIri: sourceId, targetIri: targetId});
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
    const editor = this.workspace.getEditor();
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
          const target = editor.model.elements.find(el => el.iri === targetIri);
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

  private importLayout() {
    const layoutImporting = Kefir.combine([
      Kefir.fromPromise(this.setLayout()),
      this.parsedMetadata,
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

  private parseMetadata(): Kefir.Property<ReadonlyArray<Rdf.Triple>> {
    const {metadata} = this.props;
    if (metadata) {
      return this.cancellation.map(
        turtle.deserialize.turtleToTriples(this.props.metadata)
          .mapErrors(error => new WrappingError(`Invalid metadata format`, error))
      );
    } else {
      return Kefir.constant([]);
    }
  }

  private onSaveDiagramPressed = () => {
    const {diagramIri} = this.state;
    if (diagramIri) {
      const layout = this.workspace.getModel().exportLayout();
      const {label} = this.state;
      this.cancellation.map(
        this.parsedMetadata.flatMap(metadata =>
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
        })
      ).observe({
        value: () => {
          this.workspace.getModel().history.reset();
          addNotification({
            level: 'success',
            message: `Saved diagram ${label}`,
          });
        },
        error: error => addNotification({
          level: 'error',
          message: `Error saving diagram ${label}`,
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

  private onPersistChangesAndSaveDiagram = () => {
    this.workspace.showWaitIndicatorWhile(
      this.persistAuthoredChanges().then(
        () => this.onSaveDiagramPressed()
      )
    );
  }

  private persistAuthoredChanges(): Promise<void> {
    const {fieldConfiguration} = this.state;
    const persistence = makePersistenceFromConfig(fieldConfiguration.persistence);
    const model = this.workspace.getModel();
    const editor = this.workspace.getEditor();

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
      entityMetadata: fieldConfiguration.metadata,
      state: editor.authoringState,
      fetchModel,
    }).map(this.onChangesPersisted).toPromise();
  }

  private onChangesPersisted = (result: OntodiaPersistenceResult) => {
    const model = this.workspace.getModel();
    const editor = this.workspace.getEditor();

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
      onNewDigaramInitialized: performDiagramLayout,
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
        diagram: res.diagram,
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
    const {
      onNewDigaramInitialized: performDiagramLayout,
    } = OntodiaExtension.get() || DEFAULT_FACTORY;
    const layoutProvider = new GraphBuilder(this.dataProvider);
    const loadingLayout = layoutProvider.getGraphFromRDFGraph(quads);
    this.workspace.showWaitIndicatorWhile(loadingLayout);

    return loadingLayout.then(res =>
      this.importModelLayout({
        preloadedElements: res.preloadedElements,
        diagram: res.diagram,
      })
    ).then(() => {
      performDiagramLayout(this.props, this.workspace);
    });
  }

  private setLayoutByIri(iri: string): Promise<void> {
    return this.setLayoutByIris([iri]).then(() => {
      const editor = this.workspace.getEditor();
      const element = editor.model.elements.find(({data}) => data.id === iri);
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
        editor.showConnectionsMenu(element);
      }
    });
  }
  private setLayoutByIris(iris: string[]): Promise<void> {
    const {
      onNewDigaramInitialized: performDiagramLayout,
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
  private importModelLayout = (layout?: {
    preloadedElements?: Dictionary<ElementModel>;
    diagram?: SerializedDiagram;
  }): Promise<void> => {
    const validateLinks =
      (this.props.requestLinksOnInit === undefined) ? true : this.props.requestLinksOnInit;
    const model = this.workspace.getModel(),
      params = layout || {};
    return model.importLayout({
      dataProvider: this.dataProvider,
      preloadedElements: params.preloadedElements || {},
      diagram: params.diagram,
      validateLinks: validateLinks,
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
        onSave: label => this.onSaveModalSubmit(label, layout),
        onHide: () => getOverlaySystem().hide(dialogRef),
        show: true,
        title: 'Save Ontodia diagram',
        placeholder: 'Enter diagram name',
      })
    );
  }

  private renderPropertyEditor = (options: PropertyEditorOptions) => {
    const {fieldConfiguration} = this.state;
    const metadata = getEntityMetadata(options.elementData, fieldConfiguration.metadata);
    const authoringState = this.workspace.getEditor().authoringState;

    if (metadata) {
      let rawModel = convertElementModelToCompositeValue(options.elementData, metadata);
      const elementState = authoringState.elements.get(rawModel.subject.value as ElementIri);

      let isNewElement = false;
      let elementNewIri: ElementIri | undefined;
      if (elementState && elementState.type === AuthoringKind.ChangeElement) {
        isNewElement = !elementState.before;
        elementNewIri = elementState.newIri;
      }

      const model: Forms.CompositeValue = {
        ...rawModel,
        subject: typeof elementNewIri === 'string'
          ? Rdf.iri(elementNewIri) : rawModel.subject,
      };

      const persistence = makePersistenceFromConfig(fieldConfiguration.persistence);
      const props: EntityFormProps = {
        acceptIriAuthoring: isNewElement || persistence.supportsIriEditing,
        fields: metadata.fieldByIri.toArray(),
        newSubjectTemplate: metadata.newSubjectTemplate,
        model,
        onSubmit: newData => {
          const editedModel = convertCompositeValueToElementModel(newData, metadata);
          options.onSubmit(editedModel);
        },
        onCancel: () => options.onCancel && options.onCancel(),
      };
      const formBody = metadata.formChildren || Forms.generateFormFromFields({
        fields: metadata.fields.filter(f => !isObjectProperty(f, metadata)),
        overrides: fieldConfiguration.inputOverrides,
      });
      return createElement(EntityForm, props, formBody);
    } else {
      return createElement(ErrorNotification, {
        errorMessage: `<ontodia-entity-metadata> is not defined for the ` +
          `'${options.elementData.types.join(', ')}' types`,
      });
    }
  }

  private onSaveModalSubmit(label: string, layout: SerializedDiagram): Kefir.Property<{}> {
    this.setState({label});
    return this.cancellation.map(
      this.parsedMetadata.flatMap(
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
      this.setState({diagramIri: diagramIri.value});
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

  private suggestProperties = (
    params: PropertySuggestionParams
  ): Promise<Dictionary<PropertyScore>> => {
    const {propertySuggestionQuery} = this.props;

    if (!params.token) {
      const model = this.workspace.getModel();
      const diagram = this.workspace.getDiagram();
      const element = model.getElement(params.elementId);

      params.token = element ? diagram.formatLabel(element.data.label.values, element.data.id) : '';
    }

    return DiagramService.suggestProperties(params, propertySuggestionQuery);
  }

  private resolveNodeStyles = (types: string[]): CustomTypeStyle => {
    const {nodeStyles} = this.props;
    for (const type in nodeStyles) {
      if (types.indexOf(type) >= 0) {
        const {image, color} = nodeStyles[type];
        return {icon: image, color};
      }
    }
    return undefined;
  }
}

function makePersistenceFromConfig(mode: OntodiaPersistenceMode = {type: 'form'}) {
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
): Promise<Rdf.Triple[]> {
  return Kefir.combine(
    repositories.map(repository => SparqlClient.construct(query, {context: {repository}}))
  ).map(triples => {
    const quadSet = new InternalApi.HashSet(OntodiaRdf.hashQuad, OntodiaRdf.equalQuads);
    const uniqueQuads: Rdf.Triple[] = [];

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
