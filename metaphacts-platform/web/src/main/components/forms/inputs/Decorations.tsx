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
import { Popover, OverlayTrigger } from 'react-bootstrap';
import * as classnames from 'classnames';
import * as Immutable from 'immutable';

import { Component } from 'platform/api/components';

import { Spinner } from 'platform/components/ui/spinner';

import { getPreferredLabel } from '../FieldDefinition';
import { DataState, FieldError } from '../FieldValues';
import { MultipleValuesProps } from './MultipleValuesInput';

export interface ValidationMessagesProps {
  errors: ReadonlyArray<FieldError>;
}

const VALIDATION_CLASS = 'semantic-form-validation-messages';

export class ValidationMessages extends Component<ValidationMessagesProps, {}> {
  render() {
    const errorClassName = `${VALIDATION_CLASS}__error`;
    return (
      <ul className={VALIDATION_CLASS}>
        {this.props.errors.map((err, index) => (
          <li key={index} className={classnames(
            errorClassName,
            `${errorClassName}--${FieldError.kindToString(err.kind)}`
          )}>
            {err.message}
          </li>
        ))}
      </ul>
    );
  }
}

const DECORATOR_CLASS = 'semantic-form-input-decorator';

export class InputDecorator extends Component<MultipleValuesProps, {}> {
  static defaultProps: Partial<MultipleValuesProps> = {
    renderHeader: true,
  };

  render() {
    const {renderHeader, errors} = this.props;
    const className = classnames(DECORATOR_CLASS, {
      [`${DECORATOR_CLASS}--with-header`]: renderHeader,
    });
    return (
      <div className={className}>
        {renderHeader ? this.renderHeader() : null}
        {this.props.children}
        <ValidationMessages errors={errors} />
      </div>
    );
  }

  private renderHeader() {
    const {definition, dataState} = this.props;
    const isRequired = definition.minOccurs !== 0;
    const isReady = dataState === DataState.Ready;
    return (
      <div className={`${DECORATOR_CLASS}__header`}>
        {definition.label && definition.label.length ? (
          <span className={`${DECORATOR_CLASS}__label`}>
              {getPreferredLabel(definition.label)}
              {isRequired ? (
                <span className={`${DECORATOR_CLASS}__label-required`}
                  title='Required field' />
              ) : null}
          </span>
        ) : null}
        {definition.description ? (
          <OverlayTrigger trigger={['hover', 'focus']} overlay={
              <Popover id='tooltip'>{definition.description}</Popover>
            }>
              <sup className={`${DECORATOR_CLASS}__description-icon`} />
          </OverlayTrigger>
        ) : null}
        {isReady ? null : (
          <Spinner className={`${DECORATOR_CLASS}__spinner`}
            spinnerDelay={1000}
            messageDelay={30000}
          />
        )}
      </div>
    );
  }
}
