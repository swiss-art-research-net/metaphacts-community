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
import * as _ from 'lodash';
import * as ReactBootstrap from 'react-bootstrap';
import { FileRejection, DropEvent } from 'react-dropzone';

import { Component } from 'platform/api/components';
import { Alert, AlertConfig, AlertType } from 'platform/components/ui/alert';
import { Dropzone } from 'platform/components/ui/dropzone';
import { FileManager } from 'platform/api/services/file-manager';

import * as styles from './FileManager.scss';
import { Cancellation } from 'platform/api/async';
import { addNotification } from 'platform/components/ui/notification';


interface FileUploaderState {
  alertState?: AlertConfig;
  progress?: number;
  progressText?: string;
  uploadCompleted?: boolean;
}

interface FileUploaderProps {
  /**
   * Allow specific types of files.
   * Several pattern can be concatenated by a comma.
   * See https://github.com/okonet/attr-accept for more information
   * @example
   *  'application/json,video/*'
   */
  acceptPattern?: string;

  /**
   * Context variable that will be propagated to the `resourceQuery` and `generateIdQuery`.
   */
  contextUri: string

  /**
   * SPARQL select query to generate a unique IRI for the file to be uploaded.
   * The must have exactly one projection variable *?newId* with the IRI.
   *
   * Also the query can use some variables which will be bound with values at runtime:
   * * __contextUri__ - see `contextUri` property
   * * __mediaType__ - Medai type: jpg, pdf. By default = 'auto'xw
   * * __fileName__ - Name of the file
   */
  generateIriQuery?: string

  /**
   * SPARQL construct query to generate additional meta-data which will be stored toghether with the file meta-data.
   *
   * Also the query can use some variables which will be bound with values at runtime:
   * * __contextUri__ - see `contextUri` property
   * * __resourceIri__ - IRI generated with `generateIdQuery`
   * * __mediaType__ - Medai type: jpg, pdf. By default = 'auto'
   * * __fileName__ - Name of the file
   */
  resourceQuery?: string

  /**
   * Placeholder for the dropzone. If html child components of the mp-file-uploader are defined, those will be be used as dropzone placeholder.
   */
  placeholder?: string;

  /**
   * ID of the storage to upload the file to.
   */
  storage: string;
}

/**
 * File uploader which uploads a file into a storage and
 * creates RDF meta-data, which is managed as a LDP resource.
 * @example:
 * <mp-file-uploader
 *   placeholder="Please drag&drop your image-file here"
 *   accept-pattern='image/*'
 *   resource-query='
 *    CONSTRUCT {
 *      ?__resourceIri__ a <${VocabPlatform.fileTypePredicate}>.
 *      ?__resourceIri__ <${VocabPlatform.fileNamePredicate}> ?__fileName__.
 *      ?__resourceIri__ <${VocabPlatform.mediaTypePredicate}> ?__mediaType__.
 *      ?__resourceIri__ <${VocabPlatform.fileContextPredicate}> ?__contextUri__.
 *    } WHERE {}
 *   '
 *   generate-iri-query='
 *     SELECT ?resourceIri WHERE {
 *       BIND(URI(CONCAT(STR(?__contextUri__), "/", ?__fileName__)) as ?resourceIri)
 *     }
 *   '
 *   context-uri='[[this]]'
 *   storage='file-storage'
 * ></mp-file-uploader>
 */
export class FileUploader extends Component<FileUploaderProps, FileUploaderState> {
  private readonly cancellation = new Cancellation();

  constructor(props: FileUploaderProps, context: any) {
    super(props, context);
    this.state = {
      alertState: undefined,
      progress: undefined,
      progressText: undefined,
      uploadCompleted: false,
    };
  }

  private getFileManager() {
    const {repository} = this.context.semanticContext;
    return new FileManager({repository});
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  onDropAccepted(files: File[]) {
    this.setState({ alertState: null, progress: null, uploadCompleted: false });
    const file = files[0];

    this.cancellation.map(
      this.getFileManager().uploadFileAsResource({
        file: file,
        storage: this.props.storage,
        generateIriQuery: this.props.generateIriQuery,
        resourceQuery: this.props.resourceQuery,
        contextUri: this.props.contextUri,
        onProgress: percent => this.setState({
          progress: percent,
          progressText: 'Uploading ...',
        }),
      }),
    ).observe({
      value: resource => {
        addNotification({
          message: 'File succesfully uploaded.',
          level: 'success',
        });
        this.setState({
          alertState: {
            alert: AlertType.SUCCESS,
            message: `File "${file.name}" has been successfully uploaded.`,
          },
          progress: null,
          uploadCompleted: true,
        });
      },
      error: error => {
        addNotification({
          message: 'Failed to upload file.',
          level: 'error',
        });
        this.setState({
          alertState: {
            alert: AlertType.WARNING,
            message: `Failed to upload file "${file.name}": ${error} - ${error.response.text}`,
          },
          progress: null,
          uploadCompleted: false,
        });
      },
    });
  }

  onDropRejected = (fileRejections: FileRejection[], event: DropEvent) => {
    const msg = fileRejections.map(r => 
        `Incompatible file type: expected ${this.props.acceptPattern}, got ${r.file.type}`
    ).join('\n');
    this.setState({
      alertState: {
        alert: AlertType.WARNING,
        message: msg
      },
      progress: null
    });
  }

  render() {
    const alert = this.state.alertState ? <Alert {...this.state.alertState}></Alert> : null;

    return <div className={styles.FileUploader}>
      {this.state.progress ? <ReactBootstrap.ProgressBar
        className={styles.progress}
        active={true}
        min={0}
        max={100}
        now={this.state.progress}
        label={this.state.progressText}>
      </ReactBootstrap.ProgressBar> : null}
      <Dropzone
        accept={this.props.acceptPattern}
        onDropAccepted={this.onDropAccepted}
        onDropRejected={this.onDropRejected}
        noClick={Boolean(this.state.progress)}>
        <div className={`${styles.mpDropZonePlaceHolder}`}>{
          this.props.children ||
          <div className = {styles.mpDropZonePlaceHolder}>{this.props.placeholder || 'Please drag&drop your file here.'}</div>
        }</div>
      </Dropzone>
      {alert ? <div className={styles.alertComponent}>{alert}</div> : null}
    </div>;
  }
}

export default FileUploader;
