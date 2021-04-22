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
import * as Kefir from 'kefir';
import * as React from 'react';
import * as Ontodia from 'ontodia';
import * as classnames from 'classnames';

import { Cancellation } from 'platform/api/async';
import { ContextTypes, ComponentContext } from 'platform/api/components';
import { Rdf } from 'platform/api/rdf';

import * as Forms from 'platform/components/forms';
import { ErrorNotification } from 'platform/components/ui/notification';
import { Spinner } from 'platform/components/ui/spinner';

import { deriveCancellationToken } from '../AsyncAdapters';
import { OntodiaContextTypes, OntodiaContextWrapper } from '../OntodiaContext';

import {
  LoadedEntity, generateAuthoredEntity, loadAuthoredEntity, validateSubject, noCompositeChanges,
} from './AuthoringDataAccess';
import {
  FieldConfiguration, EntityMetadata, ApplyOnState, isObjectProperty, filterOverriddenInputs,
  getOverriddenForm,
} from './FieldConfigurationCommon';
import {
  convertCompositeValueToElementModel, convertElementModelToCompositeValue,
  convertElementModelToAtomicValue, addEmptyValuesForRequiredFields,
} from './OntodiaPersistenceCommon';
import { SuggestEntitySelector, EditEntityButton } from './SuggestEntitySelector';

import * as styles from './InlineEntityInput.scss';

interface OntodiaInlineEntityInputConfig extends Forms.SingleValueInputConfig {
  entityTypeIri: string;
  allowSelectExisting?: boolean;
  allowEditExisting?: boolean;
  /**
   * Sets entity as deleted when removed from editing form.
   *
   * @default false
   */
  deleteOnDiscard?: boolean;
  applyState?: ApplyOnState;
}

export interface InlineEntityInputProps
  extends OntodiaInlineEntityInputConfig, Forms.SingleValueInputProps {}

interface State {
  loadingMetadata?: boolean;
  loadingEntity?: boolean;
  loadingError?: unknown;
  suggestedEntities?: ReadonlyArray<Forms.AtomicValue>;
}

export class InlineEntityInput extends Forms.SingleValueInput<InlineEntityInputProps, State> {
  static readonly inputGroupType = 'composite';

  static contextTypes = {
    ...ContextTypes,
    ...OntodiaContextTypes,
    ...Ontodia.WorkspaceContextTypes,
  };
  declare readonly context:
    ComponentContext & OntodiaContextWrapper & Ontodia.WorkspaceContextWrapper;

  private compositeRef: Forms.CompositeInput | null = null;

  private readonly onValueChangeLoader = new Forms.OnValueChangeLoader();
  private loadingEntityCancellation = Cancellation.cancelled;

  private cachedValues = new Map<ValueMode, Forms.FieldValue>();

  constructor(props: InlineEntityInputProps, context: any) {
    super(props, context);
    this.state = {
      loadingMetadata: true,
      loadingEntity: false,
    };
  }

  static makeHandler(
    props: Forms.SingleValueHandlerProps<InlineEntityInputProps>
  ): Forms.SingleValueHandler {
    return new InlineEntityInputHandler(props);
  }

  dataState(): Forms.DataState {
    const {loadingMetadata, loadingEntity} = this.state;
    if (loadingMetadata || loadingEntity) {
      return Forms.DataState.Loading;
    }
    if (this.compositeRef) {
      return this.compositeRef.dataState();
    }
    return Forms.DataState.Ready;
  }

  inspect(): Forms.InspectedInputTree {
    const inspectedComposite: Forms.InspectedInputTree[] = [];
    if (this.compositeRef) {
      inspectedComposite.push(this.compositeRef.inspect());
    }
    return {...super.inspect(), children: {composite: inspectedComposite}};
  }

  componentDidMount() {
    const {getFieldConfiguration} = this.context.ontodiaContext;
    const {editor} = this.context.ontodiaWorkspace;
    const {handler: passedHandler} = this.props;

    const handler = passedHandler as InlineEntityInputHandler;
    handler.initialize(getFieldConfiguration(), editor);

    let loadingEntity = this.shouldLoadEntity();
    this.setState({loadingMetadata: false, loadingEntity});
    if (loadingEntity) {
      this.onValueChangeLoader.markLoaded();
      this.loadEntity();
    }
  }

  componentDidUpdate(prevProps: InlineEntityInputProps) {
    if (this.props.value !== prevProps.value) {
      this.onValueChangeLoader.markChanged();
    }
    if (this.shouldLoadEntity()) {
      this.setState({loadingError: undefined, loadingEntity: true});
      this.onValueChangeLoader.markLoaded();
      this.loadEntity();
    }
  }

  componentWillUnmount() {
    this.loadingEntityCancellation.cancelAll();
  }

  private shouldLoadEntity(): boolean {
    const {dataState, value} = this.props;
    if (this.onValueChangeLoader.shouldLoadInState(dataState)) {
      const loadedEntity = getLoadedFromEntity(value);
      return !(loadedEntity || Forms.FieldValue.isComposite(value));
    }
    return false;
  }

  private loadEntity() {
    this.tryLoadEntity().catch(loadingError => {
      this.setState({loadingError});
    });
  }

  private async tryLoadEntity() {
    const targetValue = this.props.value;
    const handler = this.props.handler as InlineEntityInputHandler;
    const entityIri = Forms.FieldValue.asRdfNode(targetValue);
    if (entityIri && !Rdf.isIri(entityIri)) {
      throw new Error('Cannot load entity from non-IRI field value');
    }

    this.loadingEntityCancellation.cancelAll();
    this.loadingEntityCancellation = new Cancellation();
    const ct = deriveCancellationToken(this.loadingEntityCancellation);
    const context = this.context.ontodiaWorkspace;
    const inlineEntity = await Ontodia.CancellationToken.mapCancelledToNull(
      ct,
      entityIri
        ? loadAuthoredEntity(entityIri.value as Ontodia.ElementIri, ct, context)
        : generateAuthoredEntity(handler.metadata, ct, context)
    );
    if (inlineEntity === null) { return; }

    let targetMode = getValueMode(targetValue);
    if (targetMode === undefined) {
      const selectExisting = this.props.allowSelectExisting && inlineEntity.status !== 'new';
      targetMode = selectExisting ? 'select' : 'create';
    }

    let converted: Forms.FieldValue = targetValue;
    if (!Forms.FieldValue.isEmpty(converted)) {
      converted = convertElementModelToAtomicValue(inlineEntity.model, handler.metadata);
    }

    converted = setValueMode(converted, targetMode);
    converted = setLoadedFromEntity(converted, inlineEntity);

    const editSource = getEditSource(targetValue);
    if (editSource) {
      converted = setEditSource(converted, targetValue);
    }

    if (targetMode === 'create') {
      converted = this.transformIntoComposite(converted);
    }

    // update internal state before calling `updateValue()` because
    // `this.dataState()` will be called synchronously to propagate loading state changes
    this.setState({loadingEntity: false});
    this.props.updateValue(() => converted);
  }

  private transformIntoComposite(value: Forms.FieldValue): Forms.CompositeValue {
    const inlineEntity = getLoadedFromEntity(value);
    if (!inlineEntity) {
      throw new Error('Missing metadata about where entity was loaded from');
    }
    const handler = this.props.handler as InlineEntityInputHandler;
    let transformed = convertElementModelToCompositeValue(inlineEntity.model, handler.metadata);
    transformed = addEmptyValuesForRequiredFields(transformed);
    if (inlineEntity.newIri) {
      const subject = Rdf.iri(inlineEntity.newIri);
      transformed = Forms.CompositeValue.set(transformed, {subject});
    }

    const {makePersistence} = this.context.ontodiaContext;
    const persistence = makePersistence();
    if (inlineEntity.status === 'new' || persistence.supportsIriEditing) {
      transformed = Forms.computeIfSubjectWasSuggested(
        transformed,
        handler.metadata.newSubjectTemplate,
        handler.metadata.newSubjectTemplateSettings
      );
    }

    transformed = setLoadedFromEntity(transformed, inlineEntity);
    transformed = setValueMode(transformed, getValueMode(value));
    transformed = setEditSource(transformed, getEditSource(value));
    return transformed;
  }

  render() {
    const {allowSelectExisting, value} = this.props;
    const mode = getValueMode(value);
    const {loadingMetadata, loadingEntity, loadingError} = this.state;
    return (
      <>
        {allowSelectExisting ? (
          <ButtonTabs
            tabs={[
              {key: 'select', label: 'Select existing'},
              {key: 'create', label: 'Create new', primary: true},
            ]}
            selectedTab={mode}
            onSelectTab={tab => this.setMode(tab)}
            disabled={Boolean(loadingMetadata || loadingEntity || loadingError)}
          />
        ) : null}
        {this.renderValue()}
      </>
    );
  }

  private renderValue() {
    const {handler: passedHandler, allowSelectExisting, ...inputProps} = this.props;
    const {loadingMetadata, loadingEntity, loadingError} = this.state;
    if (loadingError) {
      return <ErrorNotification errorMessage={loadingError} />;
    } else if (loadingMetadata) {
      return <Spinner />;
    }
    const handler = passedHandler as InlineEntityInputHandler;
    const inlineEntity = getLoadedFromEntity(inputProps.value);
    const className = classnames(styles.component, (
      !inlineEntity || inlineEntity.status === 'new' ? styles.statusNew :
      inlineEntity.status === 'changed' ? styles.statusChanged :
      inlineEntity.status === 'deleted' ? styles.statusDeleted :
      inlineEntity.status === 'missing' ? styles.statusDeleted :
      undefined
    ));
    const mode = getValueMode(inputProps.value);
    const showForm = !loadingEntity && Forms.FieldValue.isComposite(inputProps.value) && (
      mode === 'create' || getEditSource(inputProps.value) !== undefined
    );
    return (
      <>
        {mode === 'select' ? this.renderExistingEntitySelector() : null}
        {this.renderMissingOrDeletedWarning()}
        {showForm ? (
          <Forms.CompositeInput ref={this.onCompositeMount}
            {...inputProps}
            className={className}
            fields={handler.fields}
            handler={handler.compositeHandler}
            newSubjectTemplate={handler.metadata.newSubjectTemplate}
            newSubjectTemplateSettings={handler.metadata.newSubjectTemplateSettings}
            onValidateSubject={this.onValidateSubject}>
            {inlineEntity?.status === 'deleted' ? '(deleted)' : handler.formMarkup}
          </Forms.CompositeInput>
        ) : null}
        {mode === 'select' ? this.renderEditSelectedValueToggle() : null}
      </>
    );
  }

  private onCompositeMount = (composite: Forms.CompositeInput | null) => {
    this.compositeRef = composite;
  }

  private renderExistingEntitySelector() {
    const {view} = this.context.ontodiaWorkspace;
    const {value} = this.props;
    const inlineEntity = Forms.FieldValue.isEmpty(value)
      ? undefined : getLoadedFromEntity(value);

    let selectedValue: Forms.LabeledValue | undefined;
    if (inlineEntity) {
      const label = view.formatLabel(
        inlineEntity.model.label.values,
        inlineEntity.newIri ?? inlineEntity.model.id
      );
      selectedValue = {value: Rdf.iri(inlineEntity.model.id), label};
    }

    return (
      <SuggestEntitySelector
        value={selectedValue}
        onSelect={this.onSelectedExistingEntity}
        loadSuggestions={this.loadSuggestions}
      />
    );
  }

  private onSelectedExistingEntity = (option: Forms.LabeledValue | undefined) => {
    if (option) {
      this.props.updateValue(() => Forms.FieldValue.fromLabeled(option));
    } else {
      this.props.updateValue(() => setValueMode(Forms.FieldValue.empty, 'select'));
    }
  }

  private loadSuggestions = (token: string): Kefir.Property<Forms.LabeledValue[]> => {
    const {entityTypeIri} = this.props;
    const {model, editor, view} = this.context.ontodiaWorkspace;
    return Kefir.fromPromise(
      model.dataProvider.filter({
        elementTypeId: entityTypeIri as Ontodia.ElementTypeIri,
        text: token.length > 0 ? token : undefined,
        offset: 0,
      })
    ).map(linkedElements => {
      const authoringState = editor.authoringState;
      return linkedElements.map((linkedElement): Forms.LabeledValue => {
        const authoringEvent = authoringState.elements.get(linkedElement.element.id);
        const suggestionModel = authoringEvent ? authoringEvent.after : linkedElement.element;
        const label = view.formatLabel(suggestionModel.label.values, linkedElement.element.id);
        return {value: Rdf.iri(linkedElement.element.id), label};
      });
    }).toProperty();
  }

  private renderEditSelectedValueToggle() {
    const {allowEditExisting, value, updateValue, definition} = this.props;
    const {editor} = this.context.ontodiaWorkspace;
    const inlineEntity = Forms.FieldValue.isEmpty(value)
      ? undefined : getLoadedFromEntity(value);
    const editSource = getEditSource(value);
    return (
      <>
        {(allowEditExisting && inlineEntity && inlineEntity.status === 'changed' && !editSource) ? (
          <EditEntityButton entityIri={Rdf.iri(inlineEntity.model.id)}
            entityLabel={this.getEntityTypeLabel()}
            loadCanEdit={cancellation => {
              const ct = deriveCancellationToken(cancellation);
              return editor.metadataApi.canEditElement(inlineEntity.model, ct);
            }}
            onEdit={() => updateValue(v => {
              const composite = this.transformIntoComposite(v);
              return setEditSource(composite, v);
            })}
          />
        ) : null}
        {editSource ? (
          <a href='#'
            onClick={e => {
              e.preventDefault();
              updateValue(() => editSource);
            }}>
            <span className='fa fa-times' /> Cancel editing
          </a>
        ) : null}
      </>
    );
  }

  private getEntityTypeLabel(): string {
    const {definition} = this.props;
    return (Forms.getPreferredLabel(definition.label) ?? 'entity').toLowerCase();
  }

  private setMode(nextMode: ValueMode) {
    this.props.updateValue(v => {
      const currentMode = getValueMode(v);
      if (currentMode === nextMode) { return v; }
      if (currentMode !== undefined) {
        this.cachedValues.set(currentMode, v);
      }
      const nextValue = this.cachedValues.get(nextMode) ?? Forms.FieldValue.empty;
      return setValueMode(nextValue, nextMode);
    });
  }

  private renderMissingOrDeletedWarning() {
    const {value} = this.props;
    const inlineEntity = getLoadedFromEntity(value);
    let message: React.ReactNode | undefined;
    switch (inlineEntity?.status) {
      case 'deleted':
        message = <>Selected {this.getEntityTypeLabel()} was deleted.</>;
        break;
      case 'missing':
        message = <>Selected {this.getEntityTypeLabel()} is missing.</>;
        break;
    }
    if (message === undefined) {
      return null;
    }
    return <div className={styles.entityWarning}>&#x26A0;&nbsp;{message}</div>;
  }

  private onValidateSubject = (
    validatedModel: Forms.CompositeValue
  ): Kefir.Property<Forms.CompositeChange> => {
    const {editor} = this.context.ontodiaWorkspace;
    const validatedSubject = validatedModel.subject;

    const inlineEntity = getLoadedFromEntity(validatedModel);
    if (inlineEntity
      && inlineEntity.status === 'changed'
      && validatedSubject.value === inlineEntity.model.id
    ) {
      return noCompositeChanges();
    }

    return validateSubject(validatedModel, editor.authoringState);
  }
}

interface ButtonTabsProps<Key> {
  tabs: ReadonlyArray<{ key: Key; label: React.ReactNode; primary?: boolean }>;
  selectedTab: Key;
  onSelectTab: (key: Key) => void;
  disabled?: boolean;
}

function ButtonTabs<Key extends string>(props: ButtonTabsProps<Key>) {
  return (
    <div className={styles.modeSelector}>
      {props.tabs.map(tab => (
        <button key={tab.key}
          disabled={props.disabled}
          className={classnames(styles.modeButton,
            tab.key === props.selectedTab
              ? (tab.primary ? styles.primaryModeButton : styles.secondaryModeButton)
              : undefined
          )}
          onClick={tab.key === props.selectedTab ? undefined : () => props.onSelectTab(tab.key)}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

class InlineEntityInputHandler implements Forms.SingleValueHandler {
  private readonly entityTypeIri: Ontodia.ElementTypeIri;
  private readonly deleteOnDiscard: boolean;
  private readonly applyState: ApplyOnState | undefined;
  private readonly definition: Forms.FieldDefinition;

  private initialized = false;
  private editor: Ontodia.EditorController;
  private _metadata: EntityMetadata | undefined;
  private _compositeHandler: Forms.SingleValueHandler;
  private _fields: ReadonlyArray<Forms.FieldDefinition> = [];
  private _formMarkup: React.ReactNode;

  private readonly discardedEntities: Forms.CompositeValue[] = [];

  constructor(props: Forms.SingleValueHandlerProps<InlineEntityInputProps>) {
    this.entityTypeIri = props.baseInputProps.entityTypeIri as Ontodia.ElementTypeIri;
    this.deleteOnDiscard = props.baseInputProps.deleteOnDiscard;
    this.applyState = props.baseInputProps.applyState;
    this.definition = props.definition;
    this._compositeHandler = Forms.CompositeInput.makeHandler({
      definition: props.definition,
      baseInputProps: {fields: []},
    });
  }

  initialize(
    fieldConfiguration: FieldConfiguration,
    editor: Ontodia.EditorController
  ) {
    if (this.initialized) {
      return;
    }
    this.editor = editor;
    const metadata = fieldConfiguration.entities.get(this.entityTypeIri);
    if (!metadata) {
      throw new Error(`Cannot find metadata for entity type: ${this.entityTypeIri}`);
    }
    this._metadata = metadata;
    this._fields = metadata.fields;
    this._formMarkup = getOverriddenForm(
      fieldConfiguration, {entityType: this.entityTypeIri}, this.applyState
    );
    if (!this._formMarkup) {
      const generated = Forms.generateFormFromFields({
        fields: metadata.fields.filter(f => !isObjectProperty(f, metadata)),
        overrides: filterOverriddenInputs(fieldConfiguration.inputOverrides, this.applyState),
        omitFooter: true,
      });
      generated.unshift(
        <Forms.SubjectInput key='InlineEntityInput.subjectInput' />
      );
      this._formMarkup = generated;
    }
    this._compositeHandler = Forms.CompositeInput.makeHandler({
      definition: this.definition,
      baseInputProps: {
        fields: this._fields,
        children: this._formMarkup,
        newSubjectTemplate: metadata.newSubjectTemplate,
        newSubjectTemplateSettings: metadata.newSubjectTemplateSettings,
      },
    });
    this.initialized = true;
  }

  get compositeHandler(): Forms.SingleValueHandler {
    return this._compositeHandler;
  }

  get metadata(): EntityMetadata | undefined {
    return this._metadata;
  }

  get fields(): ReadonlyArray<Forms.FieldDefinition> {
    return this._fields;
  }

  get formMarkup(): React.ReactNode {
    return this._formMarkup;
  }

  validate(value: Forms.FieldValue): Forms.FieldValue {
    return this.compositeHandler.validate(value);
  }

  discard(value: Forms.FieldValue): void {
    this.compositeHandler.discard?.(value);

    if (this.deleteOnDiscard && Forms.FieldValue.isComposite(value)) {
      const entity = getLoadedFromEntity(value);
      if (entity && (entity.status === 'new' || entity.status === 'changed')) {
        this.discardedEntities.push(value);
      }
    }
  }

  beforeFinalize(): void {
    this.compositeHandler.beforeFinalize?.();

    if (this.initialized) {
      let nextAuthoringState = this.editor.authoringState;
      for (const model of this.discardedEntities) {
        const loadedEntity = getLoadedFromEntity(model);
        if (loadedEntity) {
          nextAuthoringState = Ontodia.AuthoringState.deleteElement(
            nextAuthoringState,
            loadedEntity.model
          );
        }
      }
      this.editor.setAuthoringState(nextAuthoringState);
    }
  }

  finalize(
    value: Forms.FieldValue,
    owner: Forms.CompositeValue | Forms.EmptyValue
  ): Kefir.Property<Forms.FieldValue> {
    if (!Forms.FieldValue.isComposite(value)) {
      return Kefir.constant(value);
    }
    return this.compositeHandler.finalize(value, owner).map(result => {
      if (!Forms.FieldValue.isComposite(result)) {
        return result;
      }
      const entityAfter = convertCompositeValueToElementModel(result, this.metadata);
      const loadedEntity = getLoadedFromEntity(result);
      let nextAuthoringState = this.editor.authoringState;
      let resultSubject: Rdf.Iri;
      if (loadedEntity && loadedEntity.status === 'changed') {
        nextAuthoringState = Ontodia.AuthoringState.changeElement(
          nextAuthoringState,
          loadedEntity.model,
          entityAfter
        );
        // use original IRI before rename as subject
        resultSubject = Rdf.iri(loadedEntity.model.id);
      } else {
        if (loadedEntity && loadedEntity.status === 'new') {
          // discard previous authoring event if exists for new entity
          const change = nextAuthoringState.elements.get(loadedEntity.model.id);
          if (change) {
            nextAuthoringState = Ontodia.AuthoringState.discard(nextAuthoringState, [change]);
          }
        }
        // create authoring event for new entity with new subject IRI
        nextAuthoringState = Ontodia.AuthoringState.addElement(nextAuthoringState, entityAfter);
        resultSubject = Rdf.iri(entityAfter.id);
      }
      this.editor.setAuthoringState(nextAuthoringState);
      return Forms.FieldValue.fromLabeled({value: resultSubject});
    });
  }

  finalizeSubject?(
    value: Forms.FieldValue,
    owner: Forms.CompositeValue | Forms.EmptyValue
  ): Forms.CompositeValue {
    return this.compositeHandler.finalizeSubject(value, owner);
  }
}

const VALUE_MODE: unique symbol = Symbol('InlineEntityInput.valueMode');
type ValueMode = 'select' | 'create';
interface ValueModeExtension { [VALUE_MODE]?: ValueMode; }

function getValueMode(model: Forms.FieldValue & ValueModeExtension): ValueMode | undefined {
  return model[VALUE_MODE];
}

function setValueMode<V extends Forms.FieldValue & ValueModeExtension>(
  model: V, mode: ValueMode | undefined
): V {
  return {...model, [VALUE_MODE]: mode};
}

const EDIT_SOURCE: unique symbol = Symbol('InlineEntityInput.editSource');
interface EditSourceExtension { [EDIT_SOURCE]?: Forms.FieldValue }

function getEditSource(
  model: Forms.FieldValue & EditSourceExtension
): Forms.FieldValue {
  return model[EDIT_SOURCE];
}

function setEditSource<V extends Forms.FieldValue & EditSourceExtension>(
  model: V,
  editSource: Forms.FieldValue | undefined
): V {
  return {...model, [EDIT_SOURCE]: editSource};
}

const LOADED_FROM_ENTITY: unique symbol = Symbol('InlineEntityInput.loadedFromEntity');
interface LoadedFormEntityExtension { [LOADED_FROM_ENTITY]?: LoadedEntity }

function getLoadedFromEntity(
  model: Forms.FieldValue & LoadedFormEntityExtension
): LoadedEntity | undefined {
  return model[LOADED_FROM_ENTITY];
}

function setLoadedFromEntity<V extends Forms.FieldValue & LoadedFormEntityExtension>(
  model: V,
  entity: LoadedEntity | undefined
): V {
  return {...model, [LOADED_FROM_ENTITY]: entity};
}

Forms.SingleValueInput.assertStatic(InlineEntityInput);
Forms.SingleValueInput.assertInputGroup(InlineEntityInput);

export default InlineEntityInput;
