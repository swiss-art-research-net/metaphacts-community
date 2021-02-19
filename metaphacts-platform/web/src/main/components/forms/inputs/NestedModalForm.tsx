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
import { Component, Children, ReactElement, ReactNode, cloneElement } from 'react';
import { Modal } from 'react-bootstrap';

import { Cancellation } from 'platform/api/async';
import { Rdf } from 'platform/api/rdf';
import { getLabel } from 'platform/api/services/resource-label';

import { componentHasType } from 'platform/components/utils';

import { FieldDefinition, getPreferredLabel } from '../FieldDefinition';
import { FieldValue, AtomicValue } from '../FieldValues';
import {
  ResourceEditorForm,
  ResourceEditorFormProps,
  performFormPostAction,
  getPostActionUrlQueryParams
} from '../ResourceEditorForm';

export interface NestedModalFormProps {
  definition: FieldDefinition;
  onSubmit: (value: AtomicValue) => void;
  onCancel: () => void;
  children: ReactElement<ResourceEditorFormProps> | undefined;
}

export class NestedModalForm extends Component<NestedModalFormProps, {}> {
  private readonly cancellation = new Cancellation();

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  render() {
    const {definition, onSubmit, onCancel, children} = this.props;
    const propsOverride: Partial<ResourceEditorFormProps> = {
      id: children.props.id,
      browserPersistence: false,
      subject: Rdf.iri(''),
      postAction: (subject: Rdf.Iri) => {
        if (children.props.postAction) {
          performFormPostAction({
            postAction: children.props.postAction,
            subject: subject,
            eventProps: {isNewSubject: true, sourceId: children.props.id},
            queryParams: getPostActionUrlQueryParams(children.props),
          });
        }
        this.cancellation.map(getLabel(subject)).observe({
          value: label => {
            onSubmit(FieldValue.fromLabeled({value: subject, label}));
          }
        });
      },
    };
    return (
      <Modal size='lg' show={true} onHide={onCancel} backdrop={'static'}>
        <Modal.Header closeButton={true}>
          <Modal.Title>{`Create New ${getPreferredLabel(definition.label) || definition.id || 'Value'}`}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {cloneElement(children, propsOverride)}
        </Modal.Body>
      </Modal>
    );
  }
}

export function tryExtractNestedForm(
  children: ReactNode
): ReactElement<ResourceEditorFormProps> | undefined {
  if (Children.count(children) !== 1) {
    return undefined;
  }
  const child = Children.only(children);
  return componentHasType(child, ResourceEditorForm) ? child : undefined;
}
