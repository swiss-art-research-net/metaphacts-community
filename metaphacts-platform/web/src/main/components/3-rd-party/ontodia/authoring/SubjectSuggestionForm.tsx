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
import * as Ontodia from 'ontodia';

import { Component, ComponentContext, ContextTypes } from 'platform/api/components';
import { Rdf } from 'platform/api/rdf';

import * as Forms from 'platform/components/forms';
import {addNotification, ErrorNotification} from 'platform/components/ui/notification';
import { isValidChild, universalChildren } from 'platform/components/utils';

import { OntodiaContextTypes, OntodiaContextWrapper } from '../OntodiaContext';

import { validateSubject, noCompositeChanges } from './AuthoringDataAccess';
import {
  EntityMetadata, LinkMetadata, ApplyOnState, isObjectProperty, filterOverriddenInputs,
  getOverriddenForm,
} from './FieldConfigurationCommon';
import {
  convertCompositeValueToElementModel, convertElementModelToCompositeValue,
  convertCompositeValueToLinkModel, convertLinkModelToCompositeValue,
  getEntityMetadata, getLinkMetadata, addEmptyValuesForRequiredFields,
} from './OntodiaPersistenceCommon';

import * as styles from './SubjectSuggestionForm.scss';

export interface SubjectSuggestionFormProps {
  editOptions: EntityEditOptions | LinkEditOptions;
  applyState: ApplyOnState;
}

export type EditOptions = EntityEditOptions | LinkEditOptions;

interface EntityEditOptions {
  type: 'entity';
  model: Ontodia.ElementModel;
  onSubmit: (newModel: Ontodia.ElementModel, originalIri: Ontodia.ElementIri) => void;
  onCancel: () => void;
}

interface LinkEditOptions {
  type: 'link';
  model: Ontodia.LinkModel;
  onSubmit: (newModel: Ontodia.LinkModel) => void;
  onCancel: () => void;
}

interface State {
  readonly context?: OntodiaContextWrapper & Ontodia.WorkspaceContextWrapper;
  readonly data?: EditElementData | EditLinkData;
  readonly model?: Forms.CompositeValue;
  readonly dataState?: Forms.DataState;
  readonly error?: any;
}

interface BaseData {
  readonly convertedModel: Forms.CompositeValue;
  readonly formKey: number;
  readonly formBody: React.ReactNode;
}

interface EditElementData extends BaseData {
  readonly type: EntityMetadata['type'];
  readonly metadata: EntityMetadata;
  readonly model: Ontodia.ElementModel;
  /* if undefined then the link is new */
  readonly initialIri?: Ontodia.ElementIri;
}

interface EditLinkData extends BaseData {
  readonly type: LinkMetadata['type'];
  readonly metadata: LinkMetadata;
  readonly model: Ontodia.LinkModel;
  /* if undefined then the link is new */
  readonly initialIri?: Ontodia.LinkIri;
}

export class SubjectSuggestionForm extends Component<SubjectSuggestionFormProps, State> {
  static contextTypes = {
    ...ContextTypes,
    ...OntodiaContextTypes,
    ...Ontodia.WorkspaceContextTypes,
  };

  declare readonly context:
    ComponentContext & OntodiaContextWrapper & Ontodia.WorkspaceContextWrapper;

  private formRef: Forms.SemanticForm;

  constructor(props: SubjectSuggestionFormProps, context: any) {
    super(props, context);
    this.state = {
      context: this.context,
    };
  }

  static getDerivedStateFromProps(
    props: SubjectSuggestionFormProps,
    state: State
  ): Partial<State> | null {
    if (props.editOptions.type === 'entity') {
      const target = props.editOptions.model;
      const current = state.data && state.data.type === 'entity'
        ? state.data.model : undefined;
      if (!(current && current.id === target.id)) {
        return SubjectSuggestionForm.setEntityByModel(
          target,
          state.context,
          props.applyState,
          state.data ? (state.data.formKey + 1) : 0
        );
      }
    } else if (props.editOptions.type === 'link') {
      const target = props.editOptions.model;
      const current = state.data && state.data.type === 'link'
        ? state.data.model : undefined;
      if (!(current && Ontodia.sameLink(current, target))) {
        return SubjectSuggestionForm.setLinkByModel(
          target,
          state.context,
          props.applyState,
          state.data ? (state.data.formKey + 1) : 0
        );
      }
    }
    return null;
  }

  private static setEntityByModel(
    model: Ontodia.ElementModel,
    context: OntodiaContextWrapper & Ontodia.WorkspaceContextWrapper,
    applyState: ApplyOnState,
    nextFormKey: number
  ): Partial<State> {
    const fieldConfiguration = context.ontodiaContext.getFieldConfiguration();
    const metadata = getEntityMetadata(model, fieldConfiguration.entities);
    if (metadata) {
      const elementState = context.ontodiaWorkspace.editor.authoringState.elements.get(model.id);
      const isNew = Boolean(elementState && !elementState.before);
      const elementNewIri = elementState ? elementState.newIri : undefined;

      const rawModel = convertElementModelToCompositeValue(model, metadata);
      let convertedModel: Forms.CompositeValue = {
        ...rawModel,
        subject: typeof elementNewIri === 'string'
          ? Rdf.iri(elementNewIri) : rawModel.subject,
      };
      convertedModel = addEmptyValuesForRequiredFields(convertedModel);

      const persistence = context.ontodiaContext.makePersistence();
      if (isNew || persistence.supportsIriEditing) {
        convertedModel = Forms.computeIfSubjectWasSuggested(
          convertedModel, metadata.newSubjectTemplate
        );
      }

      let formBody = getOverriddenForm(
        fieldConfiguration, {entityType: metadata.entityType}, applyState
      );
      if (!formBody) {
        const generated = Forms.generateFormFromFields({
          fields: metadata.fields.filter(f => !isObjectProperty(f, metadata)),
          overrides: filterOverriddenInputs(fieldConfiguration.inputOverrides, applyState),
          omitFooter: true,
        });
        generated.unshift(
          <Forms.SubjectInput key='EditEntityPanel.subjectInput' />
        );
        formBody = generated;
      }
      formBody = addFormFooter(formBody);

      return {
        data: {
          type: metadata.type,
          metadata,
          model,
          initialIri: isNew ? undefined : model.id,
          convertedModel,
          formKey: nextFormKey,
          formBody,
        },
        model: convertedModel,
        error: undefined,
      };
    } else {
      return {
        error: new Error(
          `<ontodia-entity-metadata> is not defined for the ` +
          `'${model.types.join(', ')}' types`
        )
      };
    }
  }

  private static setLinkByModel(
    model: Ontodia.LinkModel,
    context: OntodiaContextWrapper & Ontodia.WorkspaceContextWrapper,
    applyState: ApplyOnState,
    nextFormKey: number
  ): Partial<State> {
    const fieldConfiguration = context.ontodiaContext.getFieldConfiguration();
    const metadata = getLinkMetadata(model, fieldConfiguration.links);
    if (metadata) {
      let convertedModel = convertLinkModelToCompositeValue(model, metadata);
      convertedModel = addEmptyValuesForRequiredFields(convertedModel);

      let formBody = getOverriddenForm(
        fieldConfiguration, {linkType: metadata.linkType}, applyState
      );
      if (!formBody) {
        formBody = Forms.generateFormFromFields({
          fields: metadata.fields.filter(f => !isObjectProperty(f, metadata)),
          overrides: filterOverriddenInputs(fieldConfiguration.inputOverrides, applyState),
          omitFooter: true,
        });
      }
      formBody = addFormFooter(formBody);

      return {
        data: {
          type: metadata.type,
          metadata,
          model,
          convertedModel,
          formKey: nextFormKey,
          formBody,
        },
        model: convertedModel,
        error: undefined,
      };
    } else {
      return {
        error: new Error(`There is no metadata for link type "${model.linkTypeId}"`)
      };
    }
  }

  render() {
    const {data, model, error} = this.state;
    if (error) {
      return (
        <ErrorNotification
          title={'Error loading editor form'}
          errorMessage={error}
        />
      );
    } else if (!data) {
      return null;
    }
    const {metadata, formKey, formBody} = data;
    const mapped = this.mapChildren(formBody);
    return (
      <div className={styles.dialog}>
        <div className={styles.content}>
          <Forms.SemanticForm
            key={formKey}
            ref={this.onFormMount}
            newSubjectTemplate={metadata.newSubjectTemplate}
            fields={metadata.fields}
            model={model}
            onChanged={this.onModelUpdate}
            onUpdateState={this.onUpdateState}
            onValidateSubject={this.onValidateSubject}>
            {mapped}
          </Forms.SemanticForm>
        </div>
      </div>
    );
  }

  private mapChildren(children: React.ReactNode): React.ReactNode {
    return React.Children.map(children, child => {
      if (isValidChild(child)) {
        if (child.type === 'button') {
          if (child.props.name === 'reset') {
            return React.cloneElement(child, {onClick: this.onReset});
          } else if (child.props.name === 'submit') {
            return React.cloneElement(child, {
              disabled: this.state.dataState !== Forms.DataState.Ready,
              onClick: this.onSubmit,
            });
          } else if (child.props.name === 'cancel') {
            return React.cloneElement(child, {onClick: this.onCancel});
          }
        }
        if (child.props.children) {
          return React.cloneElement(child, {}, universalChildren(
            this.mapChildren(child.props.children)));
        }
      }
      return child;
    });
  }

  private onSubmit = () => {
    const {model: diagramModel, editor} = this.context.ontodiaWorkspace;
    const {history} = diagramModel;
    const {data} = this.state;
    const validated = this.formRef.validate(this.state.model);
    if (!Forms.readyToSubmit(validated, Forms.FieldError.isPreventSubmit)) {
      this.setState({model: validated});
      return;
    }
    this.formRef.finalize(this.state.model).observe({
      value: newData => {
        if (data.type === 'entity') {
          const iriOfModelToEdit = getOriginalIri(data);
          const newModel = convertCompositeValueToElementModel(newData, data.metadata);
          const batch = history.startBatch('Submit entity form');
          let originalIri: Ontodia.ElementIri;
          if (editor.temporaryState.elements.has(iriOfModelToEdit)) {
            originalIri = newModel.id;
            history.execute(Ontodia.setElementData(diagramModel, iriOfModelToEdit, newModel));
            editor.setTemporaryState(
              Ontodia.TemporaryState.deleteElement(editor.temporaryState, data.model)
            );
            editor.setAuthoringState(
              Ontodia.AuthoringState.addElement(editor.authoringState, newModel)
            );
          } else {
            originalIri = editor.changeEntityData(iriOfModelToEdit, newModel);
          }
          batch.store();
          const {onSubmit} = this.props.editOptions as EntityEditOptions;
          onSubmit(newModel, originalIri);
          addNotification({
            level: 'success',
            message: `Changes to the node are applied`,
          });
        } else if (data.type === 'link') {
          let newModel = convertCompositeValueToLinkModel(
            newData,
            {
              sourceId: data.model.sourceId,
              targetId: data.model.targetId,
              linkTypeId: data.model.linkTypeId,
            },
            data.metadata
          );
          newModel = {...newModel, linkIri: data.model.linkIri};
          const batch = history.startBatch('Submit link form');
          editor.changeLink(data.model, newModel);
          editor.commitLink(newModel);
          batch.store();
          const {onSubmit} = this.props.editOptions as LinkEditOptions;
          onSubmit(newModel);
          addNotification({
            level: 'success',
            message: `Changes to the edge are applied`,
          });
        }

      },
      error: error => {
        this.setState({error});
      },
    });
  }

  private onFormMount = (formRef: Forms.SemanticForm | null) => {
    this.formRef = formRef;
  }

  private onReset = () => {
    this.setState({model: this.state.data.convertedModel});
  }

  private onCancel = () => {
    const {onCancel} = this.props.editOptions;
    onCancel();
  }

  private onModelUpdate = (newModel: Forms.CompositeValue) => {
    this.setState({model: newModel});
  }

  private onUpdateState = (dataState: Forms.DataState) => {
    this.setState({dataState});
  }

  private onValidateSubject = (
    validatedModel: Forms.CompositeValue
  ): Kefir.Property<Forms.CompositeChange> => {
    const {editor} = this.context.ontodiaWorkspace;
    const {data} = this.state;

    const validatedSubject = validatedModel.subject;
    if (data.type === 'entity') {
      if (data.model.id === validatedSubject.value) {
        return noCompositeChanges();
      }
    } else if (data.type === 'link') {
      if (data.model.linkIri === validatedSubject.value) {
        return noCompositeChanges();
      }
    }

    return validateSubject(validatedModel, editor.authoringState);
  }
}

function getOriginalIri(data: EditElementData) {
  return data.initialIri ?? data.model.id;
}

function addFormFooter(body: React.ReactNode) {
  return (
    <>
      {body}
      <Forms.FormErrors />
      <button name='submit'
        className='btn btn-primary mr-2'>
        Apply
      </button>
      <button name='cancel'
        className='btn btn-secondary'>
        Cancel
      </button>
    </>
  );
}
