/*
 * Copyright (C) 2015-2019, metaphacts GmbH
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
import * as ReactDropzone from 'react-dropzone';

import { Alert, AlertConfig, AlertType } from 'platform/components/ui/alert';
import * as Kefir from 'kefir';
import { FileManagerService } from 'platform/api/services/file-manager';

import * as styles from './FileManager.scss';
import { AtomicValueInputProps, AtomicValueInput } from '../inputs';
import { EmptyValue, CompositeValue, AtomicValue, FieldValue } from '../FieldValues';
import { Rdf } from 'platform/api/rdf';
import FileVisualizer from './FileVisualizer';
import { Cancellation } from 'platform/api/async';

interface FileInputConfig {
  /** Target storage ID. */
  storage: string;

  /** Temporary storage ID. */
  tempStorage: string;

  /**
   * Media type pattern to allow only specific types of files.
   * See https://github.com/okonet/attr-accept for more information.
   */
  acceptPattern?: string;

  /**
   * SPARQL select query which is used to generate unique IRI for the uploaded file.
   * The query should have only one projection variable `?resourceIri` with the IRI.
   *
   * Also the query can use some variables which will be bound with values at runtime:
   * * `?__mediaType__`: media type: `image/png`, etc
   * * `?__fileName__`: file name, including extension
   */
  generateIriQuery?: string;

  /**
   * SPARQL construct query which is used to generate extra data that should be associated with
   * uploaded file.
   *
   * Also the query can use some variables which will be bound with values at runtime:
   * * `?__resourceIri__`: IRI generated with `generate-id-query`
   * * `?__mediaType__`: media type: `image/png`, etc
   * * `?__fileName__`: file name, including extension
   */
  resourceQuery?: string;

  /**
   * Required to be specified if file name predicate in the `resource-query`
   * is different from the default.
   */
  namePredicateIri?: string;

  /**
   * Required to be specified if media type predicate in the `resource-query`
   * is different from the default.
   */
  mediaTypePredicateIri?: string;

  /**
   * Placeholder for the drop zone. It's also possible to provide
   * custom placeholder by passing a child component.
   */
  placeholder?: string;
}

export interface FileInputProps extends AtomicValueInputProps, FileInputConfig {}

interface State {
  alertState?: AlertConfig;
  progress?: number;
  progressText?: string;
}

/**
 * File uploader which works in a couple with field and is used as an input components on forms page.
 * (See documentation page for semantic forms.)
 */
export class FileInput extends AtomicValueInput<FileInputProps, State> {
  private readonly cancellation = new Cancellation();

  constructor(props: FileInputProps, context: any) {
    super(props, context);
    this.state = {
      alertState: undefined,
      progress: undefined,
      progressText: undefined,
    };
  }

  finalize(owner: EmptyValue | CompositeValue, value: EmptyValue | AtomicValue): Kefir.Property<FieldValue> {
    if (value.type === EmptyValue.type) {
      return Kefir.constant(value);
    }
    const stringIri = FieldValue.asRdfNode(value).value;
    if (!FileManagerService.isTemporaryResourceIri(stringIri)) {
      return Kefir.constant(value);
    } else {
      return FileManagerService.getFileResourceByIri(stringIri).flatMap(resource => {
        return FileManagerService.createResourceFromTemporaryFile({
          fileName: resource.fileName,
          storage: this.props.storage,
          temporaryStorage: this.props.tempStorage,
          generateIriQuery: this.props.generateIriQuery,
          resourceQuery: this.props.resourceQuery,
          mediaType: resource.mediaType,
        }).map(resource => {
          return AtomicValue.set(value, {value:  Rdf.iri(resource.iri)});
        });
      }).toProperty();
    }
  }

  onDropAccepted(files: File[]) {
    this.setState({ alertState: null, progress: null });
    const file = files[0];

    // upload file to the temporal storage
    this.cancellation.map(
      FileManagerService.uploadFileTemporary({
        storage: this.props.tempStorage,
        file: file,
        onProgress: percent => this.setState({
          progress: percent,
          progressText: 'Uploading ...',
        }),
      })
    ).observe({
      value: temporaryResource => {
        this.setState({
          alertState: null,
          progress: null,
        });
        const newValue = AtomicValue.set(this.props.value, {value: new Rdf.Iri(temporaryResource.iri)});
        this.props.updateValue(() => newValue);
      },
      error: error => {
        this.setState({
          alertState: {
            alert: AlertType.WARNING,
            message: `File: ${file.name} uploading failed (${error} - ${error.response.text}).`,
          },
          progress: null,
        });
      },
    });
  }

  onDropRejected(files: File[]) {
    const file = files[0];
    this.setState({
      alertState: {
        alert: AlertType.WARNING,
        message: `Incompatible file type! Expected ${this.props.acceptPattern}, got ${file.type}`,
      },
      progress: null,
    });
  }

  render() {
    const hasValue = !FieldValue.isEmpty(this.props.value);
    const resourceIri = hasValue ? FieldValue.asRdfNode(this.props.value).value : null;
    const temporaryIri = hasValue && FileManagerService.isTemporaryResourceIri(resourceIri)

    return <div className={styles.FileManager}>
      <div className={styles.header}>
        {
          this.state.progress ? <ReactBootstrap.ProgressBar
            active={true}
            min={0}
            max={100}
            now={this.state.progress}
            label={this.state.progressText}>
          </ReactBootstrap.ProgressBar> :
          resourceIri && !temporaryIri ?
            <a className={styles.uploadedImageIri}
              title={resourceIri}
              href={resourceIri}>
              {resourceIri}
            </a> :
          resourceIri ?
            <div
              className={styles.uploadedImageIri}
              title='File is loaded'>
              File is loaded
            </div>
          : null
        }
      </div>
      {resourceIri ?
        <div className={styles.fileContainer}>
          <FileVisualizer
            iri={resourceIri}
            storage={temporaryIri ? this.props.tempStorage : this.props.storage}
            namePredicateIri={this.props.namePredicateIri}
            mediaTypePredicateIri={this.props.mediaTypePredicateIri}>
          </FileVisualizer>
          <span
            className={`${styles.caRemoveFile} fa fa-times`}
            onClick={this.removeFile}
          ></span>
        </div> :
        this.renderBody()
      }
    </div>;
  }

  renderBody = () => {
    if (FieldValue.isEmpty(this.props.value)) {
      return this.renderDropZone();
    } else if (this.state.alertState) {
      return this.renderError();
    } else {
      return this.renderProgress();
    }
  };

  renderProgress() {
    return <div className={styles.emptyBody}>
      Loading..
    </div>
  }

  renderError() {
    return <div className={styles.emptyBody}>
      Error
    </div>
  }

  renderDropZone() {
    const alert = this.state.alertState ? <Alert {...this.state.alertState}></Alert> : null;
    const placeholder = this.props.placeholder || 'Please drag&drop your file here.';
    return <div className={styles.FileUploader}>
      <ReactDropzone
        accept={this.props.acceptPattern}
        onDropAccepted={this.onDropAccepted.bind(this)}
        onDropRejected={this.onDropRejected.bind(this)}
        disableClick={Boolean(this.state.progress)}
        >
          {
            this.props.children ||
            <div className = {styles.mpDropZonePlaceHolder}>{placeholder}</div>
          }
      </ReactDropzone>
      {alert ? <div className={styles.alertComponent}>{alert}</div> : null}
    </div>;
  }

  removeFile = () => {
    const iri = FieldValue.asRdfNode(this.props.value).value;
    if (FileManagerService.isTemporaryResourceIri(iri)) {
      FileManagerService.deleteFileResource(iri, this.props.storage).observe({
        value: () => this.props.updateValue(() => FieldValue.empty),
        error: (error) => {
          this.setState({
            alertState: {
              alert: AlertType.WARNING,
              message: 'Deleting failed: (' + error + ').',
            },
            progress: null,
          });
        }
      });
    } else {
      this.props.updateValue(() => FieldValue.empty);
    }
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
    if (this.props && this.props.value.type !== 'empty') {
      const iri = FieldValue.asRdfNode(this.props.value).value;
      if (FileManagerService.isTemporaryResourceIri(iri)) {
        FileManagerService.removeTemporaryFile(iri, this.props.storage);
      }
    }
  }
}
export default FileInput;
