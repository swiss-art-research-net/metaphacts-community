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
import * as D from 'react-dom-factories';
import * as classnames from 'classnames';

import { getPreferredLabel } from '../FieldDefinition';
import { ErrorKind, FieldError, FieldValue, CompositeValue } from '../FieldValues';
import { StaticComponent, StaticFieldProps } from './StaticComponent';

export interface FormErrorsProps extends StaticFieldProps {
  hideFieldErrors?: boolean;
}

const CLASSNAME = 'semantic-form-errors';
const ERROR_CLASSNAME = `${CLASSNAME}__error`;

export class FormErrors extends StaticComponent<FormErrorsProps, {}> {
  render() {
    return D.ul(
      {
        className: classnames(CLASSNAME, this.props.className),
        style: this.props.style,
      },
      FieldValue.isComposite(this.props.model) ? this.renderErrors(this.props.model) : null,
    );
  }

  private renderErrors(model: CompositeValue) {
    const errors: CollectedError[] = [];
    collectErrors([], model, errors);

    return errors.map((e, index) => D.li(
      {
        className: classnames(
          ERROR_CLASSNAME, `${ERROR_CLASSNAME}--${FieldError.kindToString(e.kind)}`),
        key: index,
      },
      D.span({className: `${CLASSNAME}__error-source`}, e.path.join(' - ')),
      D.span({className: `${CLASSNAME}__error-message`}, e.message)
    ));
  }
}

export interface CollectedError {
  readonly path: ReadonlyArray<string>;
  readonly kind: ErrorKind;
  readonly message: string;
}

export function collectErrors(
  parentPath: ReadonlyArray<string>,
  composite: CompositeValue,
  collectedErrors: CollectedError[]
) {
  const formPath = [...parentPath, 'Form'];
  composite.errors.forEach(({kind, message}) => {
    collectedErrors.push({path: formPath, kind, message});
  });

  composite.fields.forEach((state, fieldId) => {
    const definition = composite.definitions.get(fieldId);
    const source = definition && getPreferredLabel(definition.label) || fieldId;
    const path = [...parentPath, source];

    state.errors.forEach(({kind, message}) => {
      collectedErrors.push({path, kind, message});
    });

    state.values.forEach(value => {
      FieldValue.getErrors(value).forEach(({kind, message}) => {
        collectedErrors.push({path, kind, message});
      });
      if (FieldValue.isComposite(value)) {
        collectErrors(path, value, collectedErrors);
      }
    });
  });
}

export default FormErrors;
