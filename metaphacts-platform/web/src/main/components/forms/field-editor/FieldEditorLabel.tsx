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
import { FormGroup, InputGroup, FormControl, Button, Row, Col } from 'react-bootstrap';
import ReactSelect, { OnChangeHandler } from 'react-select';

import { LocalizedValue } from './FieldEditorState';

export interface Props {
  label: LocalizedValue;
  isRequired: boolean;
  langOptions: Array<{ value: string; label: string; disabled: boolean; }>;
  onChangeLabelValue: (value: string) => void;
  onChangeLabelLang: (lang: string) => void;
  onDeleteLabel: () => void;
}

export class FieldEditorLabel extends React.Component<Props, {}> {
  render() {
    const {
      label, isRequired, langOptions, onChangeLabelValue, onChangeLabelLang, onDeleteLabel,
    } = this.props;
    const {value, lang} = label;
    return (
      <FormGroup>
        <InputGroup>
          <FormControl placeholder='Label' value={value.value} onChange={e => {
            const {value: newLabelValue} = (e.target as HTMLInputElement);
            onChangeLabelValue(newLabelValue);
          }} />
          <div className='input-group-btn' style={{fontSize: 'inherit'}}>
            <div className='field-editor__lang-selector-holder'>
              <ReactSelect value={lang} options={langOptions} clearable={false}
                onChange={(
                  (opt: { value: string }) => onChangeLabelLang(opt.value)
                ) as OnChangeHandler<string>}
              />
            </div>
            {!isRequired ? (
              <Button className='field-editor__delete-label-button'
                onClick={() => onDeleteLabel()}>
                <i className='fa fa-times'/>
              </Button>
            ) : null}
          </div>
        </InputGroup>
        {value.error ? (
          <Row className='field-editor__error'>
            <Col md={12}>{value.error.message}</Col>
          </Row>
        ) : null}
      </FormGroup>
    );
  }
}
