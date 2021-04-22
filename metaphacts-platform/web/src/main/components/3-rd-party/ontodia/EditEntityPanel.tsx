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
import * as Ontodia from 'ontodia';

import { Cancellation } from 'platform/api/async';
import { Component, ComponentContext, ContextTypes } from 'platform/api/components';
import { listen } from 'platform/api/events';

import { ErrorNotification } from 'platform/components/ui/notification';

import { loadAuthoredEntity } from './authoring/AuthoringDataAccess';
import { SubjectSuggestionForm, EditOptions } from './authoring/SubjectSuggestionForm';

import { deriveCancellationToken } from './AsyncAdapters';
import { OntodiaContextTypes, OntodiaContextWrapper } from './OntodiaContext';
import * as OntodiaEvents from './OntodiaEvents';
import * as styles from './EditEntityPanel.scss';

export interface EditEntityPanelProps {}

export interface State {
  readonly editOptions?: EditOptions;
  readonly error?: any;
}

export class EditEntityPanel extends Component<EditEntityPanelProps, State> {
  static attachment = Ontodia.WidgetAttachment.Viewport;
  static contextTypes = {
    ...Ontodia.WorkspaceContextTypes,
    ...OntodiaContextTypes,
    ...ContextTypes,
  };

  declare readonly context:
    Ontodia.WorkspaceContextWrapper & OntodiaContextWrapper & ComponentContext;

  private readonly commandListener = new Ontodia.EventObserver();
  private readonly cancellation = new Cancellation();
  private settingTarget = Cancellation.cancelled;

  constructor(props: EditEntityPanelProps, context: any) {
      super(props, context);
      this.state = {};
  }

  componentDidMount() {
    const {ontodiaId} = this.context.ontodiaContext;
    const {editor} = this.context.ontodiaWorkspace;
    this.commandListener.listen(editor.events, 'changeAuthoringState', e => {
      const {editOptions} = this.state;
      if (!editOptions) { return; }
      if (editOptions.type === 'entity') {
        const currentState = editor.authoringState.elements.get(editOptions.model.id);
        if (!currentState) {
          this.setState({editOptions: undefined, error: undefined});
        }
      } else if (editOptions.type === 'link') {
        const currentState = editor.authoringState.links.get(editOptions.model);
        if (!currentState) {
          this.setState({editOptions: undefined, error: undefined});
        }
      }
    });

    this.cancellation.map(
      listen({source: ontodiaId, eventType: OntodiaEvents.StartEntityEditing})
    ).observe({
      value: ({data: target}) => this.setEntityByIri(target),
    });
    this.cancellation.map(
      listen({source: ontodiaId, eventType: OntodiaEvents.StartLinkEditing})
    ).observe({
      value: ({data: target}) => this.setLinkByIri(target),
    });
    this.cancellation.map(
      listen({source: ontodiaId, eventType: OntodiaEvents.StopEditing})
    ).observe({
      value: () => this.setState({editOptions: undefined, error: undefined}),
    });
  }

  private setEntityByIri(target: OntodiaEvents.OntodiaEventData['Ontodia.StartEntityEditing']) {
    this.settingTarget.cancelAll();
    const {model: diagramModel, editor} = this.context.ontodiaWorkspace;

    const iri = target.iri as Ontodia.ElementIri;
    const element = diagramModel.elements.find(el => el.iri === iri);
    const elementState = editor.authoringState.elements.get(iri);
    const model = (
      element ? element.data :
      elementState ? elementState.after :
      undefined
    );

    if (model) {
      const editOptions: EditOptions = {
        type: 'entity',
        model,
        onSubmit: () => {/* nothing */},
        onCancel: this.onClose,
      };
      this.setState({editOptions, error: undefined});
    } else {
      this.setState({editOptions: undefined, error: undefined});
      this.loadAndSetEntity(iri);
    }
  }

  private async loadAndSetEntity(iri: Ontodia.ElementIri): Promise<void> {
    const cancellation = new Cancellation();
    this.settingTarget = cancellation;

    const token = deriveCancellationToken(cancellation);
    const loadedEntity = await Ontodia.CancellationToken.mapCancelledToNull(
      token,
      loadAuthoredEntity(iri, token, this.context.ontodiaWorkspace)
    );
    if (loadedEntity === null) {
      return;
    }

    if (loadedEntity.status === 'missing') {
      throw new Error(`Failed to get entity <${iri}>`);
    }
    const loadedModel = loadedEntity.model;
    const { editor } = this.context.ontodiaWorkspace;
    const editOptions: EditOptions = {
      type: 'entity',
      model: loadedModel,
      onSubmit: (changedModel) => {
        editor.setAuthoringState(
          Ontodia.AuthoringState.changeElement(editor.authoringState, loadedModel, changedModel)
        );
      },
      onCancel: this.onClose,
    };
    this.setState({ editOptions, error: undefined });
  }

  private setLinkByIri(target: OntodiaEvents.OntodiaEventData['Ontodia.StartLinkEditing']) {
    this.settingTarget.cancelAll();
    const {model: diagramModel, editor} = this.context.ontodiaWorkspace;

    const linkIri = target.iri as Ontodia.LinkIri;
    const sourceIri = target.sourceIri as Ontodia.ElementIri;
    const targetIri = target.targetIri as Ontodia.ElementIri;
    const typeIri = target.typeIri as Ontodia.LinkTypeIri;

    const matchLink = (data: Ontodia.LinkModel): boolean => {
      return (typeof linkIri !== 'string' || data.linkIri === linkIri)
        && (typeof sourceIri !== 'string' || data.sourceId === sourceIri)
        && (typeof targetIri !== 'string' || data.targetId === targetIri)
        && (typeof typeIri !== 'string' || data.linkTypeId === typeIri);
    };

    let foundModel: Ontodia.LinkModel | undefined;
    let foundMultiple = false;
    let foundDeleted = false;

    for (const link of diagramModel.links) {
      if (matchLink(link.data)) {
        foundMultiple = foundMultiple || foundModel && !Ontodia.sameLink(foundModel, link.data);
        foundModel = link.data;
      }
    }
    editor.authoringState.links.forEach(state => {
      if (matchLink(state.after)) {
        foundMultiple = foundMultiple || foundModel && !Ontodia.sameLink(foundModel, state.after);
        foundModel = state.after;
        foundDeleted = state.deleted;
      }
    });

    if (foundModel) {
      if (foundMultiple) {
        console.warn('Found multiple matches when trying to edit link: ', target);
      } else if (foundDeleted) {
        console.warn('Cannot edit deleted link: ', target);
      } else {
        const editOptions: EditOptions = {
          type: 'link',
          model: foundModel,
          onSubmit: () => {/* nothing */},
          onCancel: this.onClose,
        };
        this.setState({editOptions, error: undefined});
      }
    } else {
      this.setState({
        error: new Error(
          `There is no match for link target ${JSON.stringify(target)}`
        )
      });
    }
  }

  componentWillUnmount() {
    this.commandListener.stopListening();
    this.cancellation.cancelAll();
    this.settingTarget.cancelAll();
  }

  render() {
    const {editOptions, error} = this.state;
    if (error) {
      return <ErrorNotification
        title={'Error loading edit entity panel'}
        errorMessage={error}
      />;
    } else if (!editOptions) {
      return null;
    }
    return (
      <div className={styles.body}>
        <button onClick={editOptions.onCancel} className={styles.closeButton} aria-label='Close'>
          <i className='fa fa-times' aria-hidden='true'></i>
        </button>
        <SubjectSuggestionForm editOptions={editOptions} applyState='edit' />
      </div>
    );
  }

  private onClose = () => {
    this.setState({editOptions: undefined});
  }
}

export default EditEntityPanel;
