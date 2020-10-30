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
import * as RDF from '../core/Rdf';

module platform {
  export const _NAMESPACE = 'http://www.metaphacts.com/ontologies/platform#';

  export const SyntheticJsonDatatype = RDF.iri(_NAMESPACE + 'syntheticJson');

  // LDP
  export const UserSetContainer = RDF.iri(_NAMESPACE + 'userSetContainer');
  export const SetContainer = RDF.iri(_NAMESPACE + 'setContainer');
  export const VisibilityContainer = RDF.iri(_NAMESPACE + 'visibilityContainer');
  export const FieldDefinitionContainer = RDF.iri(_NAMESPACE + 'fieldDefinitionContainer');
  export const FormContainer = RDF.iri(_NAMESPACE + 'formContainer');
  export const OntodiaDiagramContainer = RDF.iri(_NAMESPACE + 'ontodiaDiagramContainer');
  export const QueryContainer = RDF.iri(_NAMESPACE + 'queryContainer');
  export const QueryTemplateContainer = RDF.iri(_NAMESPACE + 'queryTemplateContainer');
  export const PersistedComponentContainer = RDF.iri(_NAMESPACE + 'persistedComponentContainer');
  export const WorkflowContainer = RDF.iri(_NAMESPACE + 'workflowContainer');
  export const WorkflowDefinitionContainer = RDF.iri(_NAMESPACE + 'workflowDefinitionContainer');

  export const Set = RDF.iri(_NAMESPACE + 'Set');
  export const SetItem = RDF.iri(_NAMESPACE + 'SetItem');

  // SET Container can have set-container of resources
  export const containerType = RDF.iri(_NAMESPACE + 'containerType');
  export const setItem = RDF.iri(_NAMESPACE + 'setItem');
  export const setItemIndex = RDF.iri(_NAMESPACE + 'setItemIndex');
  export const clipboardItem = RDF.iri(_NAMESPACE + 'clipboardItem');
  export const visibilityItem = RDF.iri(_NAMESPACE + 'visibilityItem');

  /**
   * Specifies visibility of the resource.
   * Possible values are publicVisibility, privateVisibility, sharedVisibility and groupVisibility
   * from bellow.
   */
  export const visibility = RDF.iri(_NAMESPACE + 'visibility');

  /**
   * Resource can be visible to everyone, including anonymous user.
   */
  export const publicVisibility = RDF.iri(_NAMESPACE + 'visibilityPublic');

  /**
   * Resource can be visible only to the original author.
   */
  export const privateVisibility = RDF.iri(_NAMESPACE + 'visibilityPrivate');

  /**
   * Resource can be visible to any logged-in user.
   */
  export const sharedVisibility = RDF.iri(_NAMESPACE + 'visibilityShared');

  /**
   * Resource can be visible to any groups specified with visibleToGroups predicate.
   */
  export const groupVisibility = RDF.iri(_NAMESPACE + 'visibilityGroup');

  /**
   * Specifies groups that resource is visible to in case of groupVisibility.
   */
  export const visibleToGroups = RDF.iri(_NAMESPACE + 'visibleToGroups');

  // property which points to UI state for the saved query
  export const searchState = RDF.iri(_NAMESPACE + 'searchState');
  export const searchResultCategory = RDF.iri(_NAMESPACE + 'searchResultCategory');

  /** Resource type for an uplodaded file. */
  export const File = RDF.iri(_NAMESPACE + 'File');
  export const fileName = RDF.iri(_NAMESPACE + 'fileName');
  export const mediaType = RDF.iri(_NAMESPACE + 'mediaType');
  export const fileContext = RDF.iri(_NAMESPACE + 'fileContext');
}

export default platform;
