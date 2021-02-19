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
import { EventMaker } from 'platform/api/events';

// Workaround: 'typescript-json-schema' doesn't support void type.
export type OpaqueElementModel = {};
export type OpaqueDiagramModel = {};
export type OpaqueAuthoringState = {};
export type OpaqueTemporaryState = {};

/**
 * `ontodia` triggers events.
 */
export interface OntodiaTriggerEventData {
  /**
   * Event which should be triggered when diagram has been saved.
   */
  'Ontodia.DiagramSaved': {
    /**
     * Saved diagram IRI.
     */
    resourceIri: string;
  };
  /**
   * Observable property which tracks whether diagram has been changed.
   */
  'Ontodia.DiagramIsDirty': {
    /**
     * `true` if a diagram has been changed; otherwise `false`.
     */
    hasChanges: boolean;
  };
  'Ontodia.InAuthoringMode': {
    /**
     * `true` if OntodiA is currently in authoring mode; otherwise `false`.
     */
    inAuthoringMode: boolean;
  };
  /**
   * Event which should be triggered when changes to the data are persisted.
   */
  'Ontodia.ChangesPersisted': {};
  /**
   * Observable property which tracks selected elements.
   */
  'Ontodia.SelectedElements': {
    elements: ReadonlyArray<{ iri: string }> | undefined;
  };
  /**
   * Observable property which tracks selected links.
   */
  'Ontodia.SelectedLinks': {
    links: ReadonlyArray<{
      linkIri?: string, linkTypeIri: string; sourceIri: string; targetIri: string
    }> | undefined;
  };
}

/**
 * `ontodia` listens to events.
 */
export interface BaseOntodiaListenEventData {
  /**
   * Event which should be triggered to focus on an element.
   */
  'Ontodia.FocusOnElement': {
    /**
     * IRI of an entity to be focused on.
     */
    iri: string;
  };
  /**
   * Event which should be triggered to save the diagram.
   */
  'Ontodia.Save': {
    /**
     * Persist changes, if changes are available
     *
     * @default false
     */
    persistChanges?: boolean;
    /**
     * Save current diagram. Cannot be used together with saveDiagramAs.
     *
     * @default true
     */
    saveDiagram?: boolean;
    /**
     * Save diagram as. Cannot be used together with saveDiagram or persistChanges.
     *
     * @default false
     */
    saveDiagramAs?: boolean;
    /**
     * Custom notification message to show when the diagram has been saved.
     */
    successMessage?: string;
    /**
     * Custom notification message to show when saving the diagram failed.
     */
    errorMessage?: string;
  };
  /**
   * Event which should be triggered to delete all elements from the diagram.
   */
  'Ontodia.ClearAll': {};
  /**
   * Event which should be triggered to toggle between view and authoring mode.
   */
  'Ontodia.SetAuthoringMode': {
    /**
     * `true` to use authoring mode; otherwise `false` to use view mode.
     */
    authoringMode: boolean;
  };
  /**
   * Event which should be triggered to open navigation menu for target element.
   */
  'Ontodia.OpenConnectionsMenu': {
    /**
     * ID of element to open navigation menu for.
     * If provided ID is `undefined` the dialog will be hidden on event.
     */
    id: string | undefined;
  };
  /**
   * Event which should be triggered when user requests to show information about an element.
   */
  'Ontodia.ShowElementInfo': {
    /**
     * IRI of an entity to show information dialog for.
     * If provided IRI is `undefined` the dialog will be hidden on event.
     */
    iri: string | undefined;
  };
  /**
   * Event which should be triggered when user initiates editing an entity.
   */
  'Ontodia.StartEntityEditing': {
    /**
     * IRI of the entity to start editing with.
     *
     * If provided IRI is undefined the editing will be stopped.
     */
    iri?: string;
  };
  /**
   * Event which should be triggered when user initiates editing a link.
   *
   * If multiple links matches specified restrictions the editing will be stopped.
   */
  'Ontodia.StartLinkEditing': {
    /** IRI of the link to start editing with. */
    iri?: string;
    /** Source of the link to start editing with. */
    sourceIri?: string;
    /** Target of the link to start editing with. */
    targetIri?: string;
    /** Type of the link to start editing with. */
    typeIri?: string;
  };
  /**
   * Event which should be triggered to stop editing an entity or a link.
   */
  'Ontodia.StopEditing': {};
}

/**
 * `ontodia` listens to events.
 */
export interface OntodiaListenEventData extends BaseOntodiaListenEventData {
  /**
   * Event which should be triggered to undo changes on the diagram.
   */
  'Ontodia.Undo': {};
  /**
   * Event which should be triggered to redo changes on the diagram.
   */
  'Ontodia.Redo': {};
}

export type OntodiaEventData = OntodiaTriggerEventData & OntodiaListenEventData;

export interface InternalOntodiaEventData {
  /**
   * Observable property which tracks changes on the diagram.
   */
  'Ontodia.DiagramChanged': {
    model: OpaqueDiagramModel;
    authoringState: OpaqueAuthoringState;
    temporaryState: OpaqueTemporaryState;
  };
  /**
   * Event which should be triggered to create a new entity and edges from it to target entities.
   */
  'Ontodia.CreateElement': {
    /**
     * New entity data.
     */
    elementData: OpaqueElementModel;
    /**
     * New connections from new entity to target entities.
     */
    targets: ReadonlyArray<{
      /**
       * Target IRI.
       */
      targetIri: string;
      /**
       * New connection IRI.
       */
      linkTypeIri: string;
    }>;
  };
  /**
   * Event which should be triggered to edit an entity.
   */
  'Ontodia.EditElement': {
    /**
     * IRI of an entity to be edited.
     */
    targetIri: string;
    /**
     * New data of an entity.
     */
    elementData: OpaqueElementModel;
  };
  /**
   * Event which should be triggered to delete an entity.
   */
  'Ontodia.DeleteElement': {
    /**
     * IRI of an entity to be deleted.
     */
    iri: string;
  };
}

const event: EventMaker<OntodiaEventData & InternalOntodiaEventData> = EventMaker;

export const DiagramSaved = event('Ontodia.DiagramSaved');
export const DiagramChanged = event('Ontodia.DiagramChanged');
export const DiagramIsDirty = event('Ontodia.DiagramIsDirty');
export const InAuthoringMode = event('Ontodia.InAuthoringMode');
export const ChangesPersisted = event('Ontodia.ChangesPersisted');
export const SelectedElements = event('Ontodia.SelectedElements');
export const SelectedLinks = event('Ontodia.SelectedLinks');

export const FocusOnElement = event('Ontodia.FocusOnElement');
export const Save = event('Ontodia.Save');
export const ClearAll = event('Ontodia.ClearAll');
export const SetAuthoringMode = event('Ontodia.SetAuthoringMode');
export const OpenConnectionsMenu = event('Ontodia.OpenConnectionsMenu');
export const ShowElementInfo = event('Ontodia.ShowElementInfo');
export const StartEntityEditing = event('Ontodia.StartEntityEditing');
export const StartLinkEditing = event('Ontodia.StartLinkEditing');
export const StopEditing = event('Ontodia.StopEditing');

export const Undo = event('Ontodia.Undo');
export const Redo = event('Ontodia.Redo');

export const CreateElement = event('Ontodia.CreateElement');
export const EditElement = event('Ontodia.EditElement');
export const DeleteElement = event('Ontodia.DeleteElement');
