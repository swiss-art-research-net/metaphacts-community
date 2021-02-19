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

import { Rdf } from 'platform/api/rdf';

import { FieldValue } from '../FieldValues';

import { StaticComponent, StaticComponentProps } from './StaticComponent';

/**
 * Allows to edit IRI of entity edited by a form or nested composite input.
 *
 * **Example**:
 * ```
 * <semantic-form fields='[...]'
 *   new-subject-template='http://example.com/{{label}}'
 *   default-edit-subject=true
 *   default-suggest-subject=true>
 *   <semantic-form-text-input for='label'></semantic-form-text-input>
 *   <semantic-form-subject-input></semantic-form-subject-input>
 * </semantic-form>
 * ```
 */
interface SemanticFormSubjectInputConfig {}

export interface SubjectInputProvidedProps
  extends SemanticFormSubjectInputConfig, StaticComponentProps {}

export interface SubjectInputProps
  extends SemanticFormSubjectInputConfig, SubjectInputProvidedProps {}

export class SubjectInput extends StaticComponent<SubjectInputProps, {}> {
  constructor(props: SubjectInputProps, context: any) {
    super(props, context);
  }

  render() {
    const {model} = this.props;
    if (!FieldValue.isComposite(model)) {
      return null;
    }
    return (
      <div className='semantic-form-subject-input'>
        <div className='semantic-form-subject-input__header'>
          <label className='semantic-form-subject-input__label'>IRI</label>
          {model.editableSubject ? (
            <label className='semantic-form-subject-input__suggest-label'>
              (Suggest IRI&nbsp;
                <input
                  type='checkbox'
                  checked={model.suggestSubject}
                  onChange={this.onChangeSuggestingMode}
                />
              )
            </label>
          ) : null}
        </div>
        <input className='semantic-form-subject-input__input form-control'
          readOnly={!model.editableSubject}
          value={model.subject.value}
          onChange={this.onChangeSubject}
        />
      </div>
    );
  }

  private onChangeSuggestingMode = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!(FieldValue.isComposite(this.props.model) && this.props.model.editableSubject)) {
      return;
    }
    const {setSuggestSubject} = this.props;
    if (setSuggestSubject) {
      setSuggestSubject(!this.props.model.suggestSubject);
    }
  }

  private onChangeSubject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const {updateSubject} = this.props;
    if (updateSubject) {
      const subject = Rdf.iri(e.currentTarget.value);
      updateSubject(subject);
    }
  }
}

export default SubjectInput;
