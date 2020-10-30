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
     * Equals to `true` if a diagram has been changed, otherwise equals to `false`.
     */
    hasChanges: boolean;
  };
  /**
   * Observable property which tracks selected elements.
   */
  'Ontodia.SelectedElements': {
    elements: ReadonlyArray<{ iri: string }> | undefined;
  }
  /**
   * Observable property which tracks selected links.
   */
  'Ontodia.SelectedLinks': {
    links: ReadonlyArray<{ linkTypeIri: string; sourceIri: string; targetIri: string }> | undefined;
  }
  /**
   * Event which should be triggered when user press "showInfoButton".
   */
  'Ontodia.ShowElementInfo': {
    /**
     * IRI of an entity to show information dialog for.
     * If provided IRI is undefined the dialog will be hidden on event.
     */
    iri: string | undefined;
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
  'Ontodia.Save': {};
  /**
   * Event which should be triggered to delete all elements from the diagram.
   */
  'Ontodia.ClearAll': {};
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
  /**
   * Event which should be triggered to open connection menu for target element.
   */
  'Ontodia.OpenConnectionsMenu': {
    id: string | undefined;
  }
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
   * Event which should be triggered to create a new entity and connections from it to target entities.
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
export const SelectedElements = event('Ontodia.SelectedElements');
export const SelectedLinks = event('Ontodia.SelectedLinks');
export const ShowElementInfo = event('Ontodia.ShowElementInfo');

export const CreateElement = event('Ontodia.CreateElement');
export const EditElement = event('Ontodia.EditElement');
export const DeleteElement = event('Ontodia.DeleteElement');

export const OpenConnectionsMenu = event('Ontodia.OpenConnectionsMenu');
export const FocusOnElement = event('Ontodia.FocusOnElement');

export const Save = event('Ontodia.Save');
export const Undo = event('Ontodia.Undo');
export const Redo = event('Ontodia.Redo');
export const ClearAll = event('Ontodia.ClearAll');
