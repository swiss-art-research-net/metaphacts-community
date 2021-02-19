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
import { ReactElement, cloneElement, Children } from 'react';
import {
  FormGroup, FormControl, OverlayTrigger, Popover, Button, FormCheck, FormLabel, Modal
} from 'react-bootstrap';

import {Rdf} from 'platform/api/rdf';
import { Component, ComponentContext } from 'platform/api/components';
import * as http from 'platform/api/http';
import { ResourceLinkComponent } from 'platform/components/navigation';
import {refresh, navigateToResource} from 'platform/api/navigation';
import { LdpService } from 'platform/api/services/ldp';
import { ResourceLabel } from 'platform/components/ui/resource-label';
import { Spinner } from 'platform/components/ui/spinner/Spinner';

/**
 * Imports LDP resource.
 *
 * **Example**:
 * ```
 * <mp-ldp-import-resource>
 *   <button class="btn btn-secondary">Import resource</button>
 * </mp-ldp-import-resource>
 * ```
 */
interface LdpImportResourceConfig {
  /**
   * Explicitly target container IRI, if not specify the best suitable container will be
   * found automatically.
   */
  container?: string;
  /**
   * Force import ignoring warning about dangling resources.
   */
  force?: boolean;
  /**
   * @default "reload"
   */
  postAction?: 'redirect' | 'reload' | string;
}

export interface ImportResourceProps extends LdpImportResourceConfig {}

interface State {
  show?: boolean
  wait?: boolean
  serverError?: string
  serverDialog?: any
  serverDone?: any
  selectedContainer?: string
}

// See description of import process in comment to
// com.metaphacts.data.rdf.container.LDPApi.importLDPResource
export class ImportResource extends Component<ImportResourceProps, State> {
  constructor(props: ImportResourceProps, context: ComponentContext) {
    super(props, context);
    this.state = {
      show: false,
      wait: false,
    };
  }

  private performPostAction = (createdResource: string) => {
    if (!this.props.postAction || this.props.postAction === 'reload') {
      refresh();
    } else if (this.props.postAction === 'redirect') {
      navigateToResource(Rdf.iri(createdResource)).onValue(v => v);
    } else {
      navigateToResource(Rdf.iri(this.props.postAction)).onValue(v => v);
    }
  };

  getLDPService() {
    return new LdpService('', this.context.semanticContext);
  }

  importFromText = (text: string) => {
    this.setState({wait: true});
    const ldpService = this.getLDPService();
    ldpService
      .importFromText(text, this.props.container, this.props.force)
      .onValue(this.onServerResponse)
      .onError(this.onServerError);
  };

  importFromURL = (url: string) => {
    const ldpService = this.getLDPService();
    ldpService
      .importGetTextFromURL(url)
      .flatMap(text => {
        return ldpService.
          importFromText(text, this.props.container, this.props.force)
          .onValue(this.onServerResponse)
          .onError(this.onServerError);
      })
      .onError(this.onServerError);
  };

  importFromDelayedId = (delayedId: string, containerIRI: string) => {
    const ldpService = this.getLDPService();
    ldpService
      .importFromDelayedId(delayedId, containerIRI)
      .onValue(this.onServerResponse)
      .onError(this.onServerError);
  };

  onServerResponse = (response: http.Response) => {
    if (response.status === 202) {
      this.setState({serverDialog: response.text});
    } else if (response.status === 201) {
      this.setState({serverDone: response.header['location'], wait: false});
    }
  };

  onServerError = (error: any) => {
    console.error('Error during import: ' + JSON.stringify(error));
    this.setState({serverError: error, wait: false});
  };

  public renderContainerList(selectedContainer: string, possibleContainers: any[]) {
    return <FormGroup>
      Select container to import into
      <FormGroup>
        {possibleContainers.map(containerIRI =>
          <FormCheck name='select-container'
                 type='radio'
                 value={containerIRI['@id']}
                 checked={selectedContainer === containerIRI['@id']}
                 onChange={() => this.setState({selectedContainer: containerIRI['@id']})}>
                      <span title={containerIRI['@id']}>
                        <ResourceLabel iri={containerIRI['@id']} />
                      </span>
          </FormCheck>
        )}
      </FormGroup>
    </FormGroup>;
  }

  public renderContainerMessage(selectedContainer: string, possibleContainers: any[]) {
    if (this.props.container) {
      return <FormGroup>
        Import will be made into <ResourceLinkComponent uri={this.props.container} />
      </FormGroup>;
    }

    if (possibleContainers.length === 0) {
      return <FormGroup>
        Suitable for import container not found
      </FormGroup>;
    }

    if (possibleContainers.length === 1) {
      return <FormGroup>
        Import will be made into <ResourceLinkComponent uri={possibleContainers[0]['@id']} />
      </FormGroup>;
    }

    if (possibleContainers.length > 1) {
      return this.renderContainerList(selectedContainer, possibleContainers);
    }

    return null;
  }

  private renderUnknownObjectsMessage(unknownObjects: any[]) {
    if (unknownObjects.length > 0) {
      return <FormGroup>
        These object IRIs are not present in target DB:
        {unknownObjects.map(objectIRI =>
          <div><FormLabel>{objectIRI['@id'] + '\n'}</FormLabel></div>
        )}
      </FormGroup>;
    }
    return null;
  }

  public renderModal() {
    const {wait, serverDone, serverDialog, serverError, selectedContainer} = this.state;
    if (serverDone) {

      return <Modal show={true} onHide={() => {
        this.setState({serverDone: undefined}, () => this.performPostAction(serverDone));
      }}>
        <Modal.Header><Modal.Title>Success</Modal.Title></Modal.Header>
        <Modal.Body>Import successfully done, resource <ResourceLinkComponent uri={serverDone} /> created
        </Modal.Body>
      </Modal>;

    } else if (serverError) {

      return <Modal show={true} onHide={() => {
        this.setState({serverError: undefined});
      }}>
        <Modal.Header><Modal.Title>Error</Modal.Title></Modal.Header>
        <Modal.Body>Unexpected error during import</Modal.Body>
      </Modal>;

    } else if (serverDialog) {

      const {delayedImportRequestId, possibleContainers, unknownObjects} = JSON.parse(serverDialog);
      const canProceed = (this.props.container || possibleContainers.length > 0) && (
        this.state.selectedContainer ||
        this.props.container ||
        !this.props.container && possibleContainers.length === 1
      );
      const proceedIntoContainer = canProceed ?
        this.state.selectedContainer || this.props.container || possibleContainers[0]['@id'] :
        null;

      return <Modal show={true} onHide={() => {
        this.setState({serverDialog: undefined});
      }}>
        <Modal.Header><Modal.Title>Clarification needed</Modal.Title></Modal.Header>
        <Modal.Body>
          {this.renderContainerMessage(selectedContainer, possibleContainers)}
          {this.renderUnknownObjectsMessage(unknownObjects)}
        </Modal.Body>
        <Modal.Footer>
          <Button disabled={!canProceed} onClick={() => {
            this.importFromDelayedId(delayedImportRequestId, proceedIntoContainer);
            this.setState({serverDialog: undefined, selectedContainer: undefined});
          }}>Proceed</Button>
          <Button onClick={() => this.setState({serverDialog: undefined, selectedContainer: undefined, wait: false})}>Cancel</Button>
        </Modal.Footer>
      </Modal>;

    } else if (wait) {

      return <Modal show={true} onHide={() => {}}><Modal.Body><Spinner /></Modal.Body></Modal>;

    }

    return null;
  }

  public render() {
    const child = Children.only(this.props.children) as ReactElement<any>;
    const popover = <Popover id='import-resource'>
      <Popover.Content>
        <FormControl type='file' className='input-sm' onChange={(e) => {
          const files = (e.target as HTMLInputElement).files;
          if (files.length === 1) {
            const file = files[0];
            const fileReader = new FileReader();
            fileReader.onload = (e) => {
              const text = (e.target as any).result;
              this.setState({ show: false });
              this.importFromText(text);
            };
            fileReader.readAsText(file);
          }
        }} />
      </Popover.Content>
    </Popover>;

    return <OverlayTrigger trigger='click' placement='bottom'
      rootClose={true}
      overlay={popover}
      onExit={() => {
        this.setState({show: false});
      }}
    >{
      cloneElement(child, child.props, ...child.props.children ,this.renderModal())
    }</OverlayTrigger>;
  }
}

export default ImportResource;
