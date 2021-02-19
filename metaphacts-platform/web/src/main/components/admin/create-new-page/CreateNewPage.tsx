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
import { trim } from 'lodash';
import { Component } from 'platform/api/components';
import { getPrefixedUri } from 'platform/api/services/namespace';
import { SparqlUtil } from 'platform/api/sparql';
import { ResourceLinkAction } from 'platform/components/navigation';
import * as Kefir from 'kefir';
import {
  FormControl, FormGroup, InputGroup, Button, Form,
} from 'react-bootstrap';
import { Rdf } from 'platform/api/rdf';
import { navigateToResource } from 'platform/api/navigation';
import * as styles from './CreateNewPage.scss';

const commonSchemes: ReadonlySet<string> = new Set(['http', 'https', 'urn', 'email', 'isbn']);

export interface CreateNewPageProps {
  placeholder?: string;
  buttonCaption?: string;
}

export interface IriDetails {
  fullIri?: string;
  abbreviatedIri?: string;
  isValid?: boolean;
}

interface State {
  value: string;
  iriDetails: IriDetails;
}

/**
 * Validates if the given string represents an IRI and returns information
 * on the resolved IRI.
 * Example results:

 * {isValid: true, fullIri: http://example.org/someResource}
 * {isValid: true, abbreviatedIri: foaf:Person, fullIri: http://xmlns.com/foaf/0.1/Person}
 * {isValid: false}
 *
 * NOTE: Not yet to be exposed globally.
 * TODO: Add this logic to backend instead of having it in client side.
 * @param iriToResolve User entered IRI.
 */
export function validateAndGuessIRI(iriToResolve: string): Kefir.Property<IriDetails> {
  try {
    const [iri] = SparqlUtil.resolveIris([iriToResolve]);
    return vaildateInternal(iri, iriToResolve);
  } catch (e) {
    // fallback case for vaild IRI not enclosed in < >.
    // Valid IRIs' not enclosed in < > throws parser exception.
    if (!e.message.toString().toLowerCase().includes('parse error')) {
      const bracketedIri = '<' + iriToResolve + '>';
      try {
        const [iri] = SparqlUtil.resolveIris([bracketedIri]);
        return vaildateInternal(iri, bracketedIri);
      } catch (error) {
        return Kefir.constantError<IriDetails>({isValid: false});
      }
    } else {
      return Kefir.constantError<IriDetails>({isValid: false});
    }
  }
}

/**
* Validates if an abbriviated form is present or if the prefix is registered
* in our platform.
*
* NOTE: Not yet to be exposed globally.
* TODO: Add this logic to backend instead of having it in client side.
* @param resolvedIri SparqlUtil resolved IRI.
* @param iriToResolve User entered IRI from getting the prefix.
* @returns iriDetails if vaild else isValid: false
*/
function vaildateInternal(resolvedIri: Rdf.Iri,
    iriToResolve: string): Kefir.Property<IriDetails> {

  const prefix = iriToResolve.split(':')[0].replace('<', '');
  const registeredPrefixes = SparqlUtil.RegisteredPrefixes;
  const iriWithoutBrackets = resolvedIri.value.replace('<', '').replace('>', '');

  return getPrefixedUri(Rdf.iri(iriWithoutBrackets))
    .map(abbreviatedIri => {
      if (Object.prototype.hasOwnProperty.call(registeredPrefixes, prefix)
          || commonSchemes.has(prefix)) {
        const iriDetails: IriDetails = {
          abbreviatedIri: abbreviatedIri.isJust ? abbreviatedIri.get() : '',
          fullIri: resolvedIri.value,
          isValid: true
        };
        return iriDetails;
      } else {
        return {isValid: false};
      }
  });
}

export class CreateNewPage extends Component<CreateNewPageProps, State> {

  constructor(props: {}, context: any) {
    super(props, context);
    this.state = {
      value: '',
      iriDetails: {
        fullIri: '',
        abbreviatedIri: '',
        isValid: null
      }
    };
  }

  static defaultProps: Required<Pick<CreateNewPageProps, 'placeholder' | 'buttonCaption'>> = {
    placeholder:
      'Enter an abbreviated IRI e.g Admin:Security or enter a full IRI ' +
      'e.g http://help.metaphacts.com/resource/Start',
    buttonCaption: 'Create Page'
  };

  render() {
    return (
      <Form onSubmit={this.onClick}>
        <FormGroup>
          <InputGroup>
            <FormControl
              type='text' placeholder={this.props.placeholder}
              value={this.state.value} onChange={this.onValueChange}
              isValid={this.state.iriDetails.isValid}
              isInvalid={this.state.iriDetails.isValid === null ? null :
                !this.state.iriDetails.isValid}
              />
            <InputGroup.Append>
              <Button
                variant='primary'
                onClick={this.onClick}
              >Validate</Button>
              <Button
                variant='primary'
                disabled={this.isCreateDisabled()}
                onClick={() => this.createNewPage()}
              >{this.props.buttonCaption}</Button>
            </InputGroup.Append>
            {
              this.state.iriDetails.isValid === null ? '' :
                this.state.iriDetails.isValid ?
                  <FormControl.Feedback type='valid'>
                    <div className={styles.topPadding}>
                      <span className={styles.valid}>Valid IRI. </span>
                      <span
                        className={styles.leftPadding}>
                        Fully Qualified IRI: <span className={styles.underline}>
                          {this.state.iriDetails.fullIri}</span>
                      </span>
                      {
                        this.state.iriDetails.abbreviatedIri !== '' ?
                          <span
                            className={styles.leftPadding}>
                            Abbreviated IRI: <span className={styles.underline}>
                              {this.state.iriDetails.abbreviatedIri}</span>
                          </span> :
                          ''
                      }
                    </div>
                  </FormControl.Feedback> :
                  <FormControl.Feedback type='invalid'>The value is not a valid IRI.</FormControl.Feedback>
            }
          </InputGroup>
        </FormGroup>
      </Form>
    );
  }

  private createNewPage = () => {
    const query = { action: ResourceLinkAction[ResourceLinkAction.edit] };
    navigateToResource(Rdf.iri(this.state.iriDetails.fullIri), query)
      .onValue(() => {/**/ });
  }

  private onValueChange = (event: React.ChangeEvent<any>) => {
    this.setState({
      value: trim(event.target.value),
      iriDetails: {
        isValid: null
      }
    });
  }

  private isCreateDisabled = () => this.state.iriDetails.isValid !== true;

  private onClick = (event: React.SyntheticEvent<any>) => {
    event.preventDefault();
    validateAndGuessIRI(this.state.value).observe({
      value: (value) => {
        this.setState({
          iriDetails: {
            fullIri: value.fullIri,
            abbreviatedIri: value.abbreviatedIri,
            isValid: value.isValid
          }
        });
      },
      error: (err) => {
        this.setState({
          iriDetails: {
            isValid: false
          }
        });
      }
    });
  }
}

export default CreateNewPage;
