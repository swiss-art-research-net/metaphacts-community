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
import { isEmpty, trim } from 'lodash';
import {
  FormControl, FormGroup, InputGroup, Button, Form,
} from 'react-bootstrap';

import { Rdf } from 'platform/api/rdf';
import { navigateToResource } from 'platform/api/navigation';

export interface NavigateToIRIProps {
  placeholder?: string
  buttonCaption?: string
}

interface State {
  value: string
  error?: boolean
}

/**
 * Component that can be used to navigate to the specified IRI resource page.
 */
export class NavigateToIRI extends React.Component<NavigateToIRIProps, State> {

  constructor(props: NavigateToIRIProps, context: any) {
    super(props, context);
    this.state = {
      value: '',
    };
  }

  static defaultProps = {
    placeholder: 'Enter the full IRI to navigate to the resource page, e.g http://example.org/bob#me',
    buttonCaption: 'Navigate',
  };

  render() {
    return (
      <Form onSubmit={this.onClick}>
        <FormGroup>
          <InputGroup>
            <FormControl
              type='text' placeholder={this.props.placeholder}
              value={this.state.value} onChange={this.onValueChange}
              isInvalid={this.state.error}
              />
            <InputGroup.Append>
              <Button
                variant='success'
                disabled={this.isExploreDisabled()}
                onClick={this.onClick}
              >{this.props.buttonCaption}</Button>
            </InputGroup.Append>
            <FormControl.Feedback type='invalid'>
              Can't navigate to the resource. The value is not a valid IRI.
            </FormControl.Feedback>
          </InputGroup>
        </FormGroup>
      </Form>
    );
  }

  private onValueChange = (event: React.ChangeEvent<any>) =>
    this.setState({value: trim(event.target.value)});

  private isExploreDisabled = () => isEmpty(this.state.value);

  private onClick = (event: React.SyntheticEvent<any>) => {
    event.preventDefault();
    navigateToResource(Rdf.iri(this.state.value))
      .onValue(v => {})
      .onError(e => this.setState({error: true}));
  }
}

export default NavigateToIRI;
