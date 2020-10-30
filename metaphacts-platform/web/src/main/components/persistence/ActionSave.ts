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
import { createFactory, cloneElement, Children } from 'react';
import * as D from 'react-dom-factories';
import * as ReactBootstrap from 'react-bootstrap';
import * as Kefir from 'kefir';

import { Component } from 'platform/api/components';
import { trigger } from 'platform/api/events';
import { componentToGraph } from 'platform/api/persistence/ComponentPersistence';
import { Rdf } from 'platform/api/rdf';
import { VocabPlatform, rdfs } from 'platform/api/rdf/vocabularies/vocabularies';
import { SetManagementEvents  } from 'platform/api/services/ldp-set/SetManagementEvents';
import { ldpc } from 'platform/api/services/ldp';
import { addToDefaultSet } from 'platform/api/services/ldp-set';

import { Spinner } from 'platform/components/ui/spinner/Spinner';
import { isValidChild } from 'platform/components/utils';
import {
  ResourceLinkComponent
} from 'platform/components/navigation/ResourceLinkComponent';

const Button = createFactory(ReactBootstrap.Button);
const Modal = createFactory(ReactBootstrap.Modal);
const ModalHeader = createFactory(ReactBootstrap.ModalHeader);
const ModalFooter = createFactory(ReactBootstrap.ModalFooter);
const ModalBody = createFactory(ReactBootstrap.ModalBody);
const FormControl = createFactory(ReactBootstrap.FormControl);
const ResourceLink = createFactory(ResourceLinkComponent);


interface Props {
  id: string
  component?: any


  /**
   * `true` if persisted component should be added to the default set of the current user
   *
   * @default false
   */
  addToDefaultSet?: boolean
}

interface State {
  show: '' | 'editor' | 'saving' | 'success'
  savedIri?: string
  label?: string
  description?: string
}

export class ActionSaveComponent extends Component<Props, State> {
  static defaultProps: Partial<Props> = {
    addToDefaultSet: false,
  };

  constructor(props: Props, context: any) {
    super(props, context);
    this.state = {show: ''};
    this.onClick = this.onClick.bind(this);
    this.onSave = this.onSave.bind(this);
    this.onCancel = this.onCancel.bind(this);
  }

  onClick() {
    this.setState({show: 'editor'});
  }

  onSave() {
    this.setState({show: 'saving'});

    const componentGraph = componentToGraph({
      component: this.props.component,
      componentRoot: Rdf.iri(''),
      parentTemplateScope: this.appliedTemplateScope,
      semanticContext: this.context.semanticContext,
    });

    const {label, description} = this.state;
    const {graph} = addLabelAndDescription(componentGraph, label, description);

    ldpc(VocabPlatform.PersistedComponentContainer.value).addResource(graph)
      .flatMap(
        res => this.props.addToDefaultSet ?
          addToDefaultSet(res, this.props.id) : Kefir.constant(res)
      )
      .onValue(resourceIri => {
        trigger(
          {eventType: SetManagementEvents.ItemAdded, source: this.props.id}
        );
        this.setState({show: 'success', savedIri: resourceIri.value});
      });
  }

  onCancel() {
    this.setState({
      show: '',
      savedIri: undefined,
      label: undefined,
      description: undefined,
    });
  }

  renderModal() {
    switch (this.state.show) {
      case 'editor':
        return Modal({show: true, onHide: this.onCancel},
          ModalHeader({}, 'Save visualization'),
          ModalBody({},
            'Label:', FormControl({
              value: this.state.label ? this.state.label : '',
              onChange: (e) => {
                const newValue = (e.target as any).value;
                this.setState({label: newValue});
              },
            }),
            'Description:', FormControl({
              type: 'textarea',
              value: this.state.description ? this.state.description : '',
              onChange: (e) => {
                const newValue = (e.target as any).value;
                this.setState({description: newValue});
              },
            })
          ),
          ModalFooter({},
            Button({disabled: !this.state.label, onClick: this.onSave}, 'OK'),
            Button({onClick: this.onCancel}, 'Cancel')
          )
        );
      case 'saving':
        return Modal({show: true, onHide: this.onCancel},
          ModalHeader({}, 'Saving in progress'),
          ModalBody({}, Spinner())
        );
      case 'success':
        return Modal({show: true, onHide: this.onCancel},
          ModalHeader({}, 'Success'),
          ModalBody({}, 'Visualization ',
            ResourceLink({uri: this.state.savedIri}),
            'has been saved successfully!'
          ),
          ModalFooter({},
            Button({onClick: this.onCancel}, 'OK')
          )
        );
      case '':
        return null;
    }
  }

  render() {
    if (isValidChild(this.props.children)) {
      const child = Children.only(this.props.children);
      return cloneElement(
        child, {...child.props, onClick: this.onClick}, ...child.props.children, this.renderModal()
      );
    }
    return Button(
      {
        title: 'Save into default set',
        onClick: this.onClick,
      },
      D.i({className: 'fa fa-save'}),
      this.renderModal()
    );
  }
}

function addLabelAndDescription(
  {pointer, graph}: Rdf.PointedGraph,
  label: string | undefined,
  description: string | undefined
): Rdf.PointedGraph {
  if (Rdf.isLiteral(pointer)) {
    throw new Error('Cannot create pointed graph with literal pointer term');
  }
  let triples = graph.triples;
  if (label) {
    triples = triples.add(Rdf.triple(pointer, rdfs.label, Rdf.literal(label)));
  }
  if (description) {
    triples = triples.add(Rdf.triple(pointer, rdfs.comment, Rdf.literal(description)));
  }
  return Rdf.pg(pointer, Rdf.graph(triples));
}

export default ActionSaveComponent;
