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
import * as _ from 'lodash';
import * as ReactBootstrap from 'react-bootstrap';
import ReactSelect from 'react-select';
import { FileRejection, DropEvent } from 'react-dropzone';

import { Cancellation } from 'platform/api/async';
import { Component } from 'platform/api/components';
import { getStorageStatus, ConfigStorageStatus } from 'platform/api/services/config';
import { FileManager } from 'platform/api/services/file-manager';

import { Alert, AlertConfig, AlertType } from 'platform/components/ui/alert';
import { Dropzone } from 'platform/components/ui/dropzone';
import { addNotification } from 'platform/components/ui/notification';

import { getFileIcon } from './FileVisualizer';

import * as styles from './FileManager.scss';

const OBJECT_KINDS =[
  'assets',
  'templates',
  'config',
  'file',
]

interface FilePath {
  objectKind: string;
  folder: string;
  name: string;
}

/**
 * Component which is used for uploading files directly into a storage.
 * Supports any kind of storage type (file/system/app).
 *
 * You can redefine inner body by passing custom element as a child component.
 *
 * To have ability to upload files into storage you have to have permissions on this action.
 * Permission should be defined this way in `shiro.ini`:
 * ```
 * storage:{write}:{storage-id}
 * ```
 *
 * **Example**:
 * ```
 * <mp-direct-file-uploader
 *   placeholder='Test placeholder'
 *   accept-pattern='application/*'
 *   default-storage-id='runtime'
 *   default-object-kind='file'
 *   default-folder='/'>
 * </mp-direct-file-uploader>
 * ```
 */
export interface DirectFileUploaderConfig {
  /**
   * Allow specific types of files. See https://github.com/okonet/attr-accept for more information
   */
  acceptPattern?: string;

  /**
   * Placeholder for the dropzone. You can use react children as well.
   */
  placeholder?: string;

  /**
   * Object storage id. Used to detect upload folder based on object sotrages which are
   * defined in `/runtime-data/config/data-storage.prop`.
   */
  defaultStorageId?: string;

  /**
   * Path to a destination folder in the storage. (It should start with an Object.Kind prefix).
  */
  defaultFolder?: string;

  /**
   * Path to a destination folder in the storage. (It should start with an Object.Kind prefix).
  */
  defaultObjectKind?: string;
}

export type DirectFileUploaderProps = DirectFileUploaderConfig;

interface State {
  alertState?: AlertConfig;
  progress?: number;
  progressText?: string;

  storages?: ConfigStorageStatus[];
  storageId?: string;
  path?: FilePath;
  file?: File;
}

export class DirectFileUploader extends Component<DirectFileUploaderProps, State> {
  private readonly cancellation = new Cancellation();

  constructor(props: DirectFileUploaderProps, context: any) {
    super(props, context);
    const objectKind = props.defaultObjectKind && OBJECT_KINDS.indexOf(props.defaultObjectKind) !== -1 ?
      props.defaultObjectKind : OBJECT_KINDS[0];
    this.state = {
      alertState: undefined,
      progress: undefined,
      progressText: undefined,
      storageId: props.defaultStorageId,
      path: {
        folder: props.defaultFolder || '/',
        objectKind,
        name: undefined,
      },
    };
  }

  componentDidMount() {
    this.loadStoragesList();
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  componentWillReceiveProps(newProps: DirectFileUploaderProps) {
    if (this.state.storages) {
      const storage = this.state.storages.find(storage => storage.appId === newProps.defaultStorageId);
      if (storage) {
        this.setState({storageId: storage.appId})
      }
    }
  }

  private getFileManager() {
    const {repository} = this.context.semanticContext;
    return new FileManager({repository});
  }

  uploadFile() {
    const file = this.state.file;

    this.cancellation.map(
      this.getFileManager().uploadFileDirectlyToStorage({
        storage: this.state.storageId,
        folder: this.getFolder(),
        fileName: this.state.path.name,
        file: file,
        onProgress: percent => {
          this.setState({
            progress: percent,
            progressText: 'Uploading ...',
          });
        },
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
            message:
              `File "${resource}" has been successfully ` +
              `uploaded to the storage "${this.state.storageId}".`
            ,
          },
          progress: null,
          path: {
            ...this.state.path,
            name: ''
          },
          file: undefined,
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
          path: {
            ...this.state.path,
            name: ''
          },
          file: undefined,
        });
      },
    });
  }

  onDropAccepted = (files: File[]) => {
    const {path} = this.state;
    const file = files[0];
    this.setState({
      alertState: null,
      progress: null,
      file: file,
      path: {
        ...path,
        name: file.name,
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

  loadStoragesList() {
    this.cancellation.map(
      getStorageStatus(),
    ).observe({
      value: (storages) => {
        const storage = this.props.defaultStorageId &&
          storages.find(storage => storage.appId === this.props.defaultStorageId);
        this.setState({
          storages,
          storageId: storage ? storage.appId : storages[0].appId,
        });
      },
      error: error => {
        this.setState({
          alertState: {
            alert: AlertType.WARNING,
            message: `Failed to fetch storage list: ${error}`,
          },
          progress: null,
        });
      },
    });
  }

  private getFolder() {
    const {objectKind} = this.state.path;
    let folder = this.state.path.folder;
    // filter following situations: some/path/////folder
    folder = folder.split('/').filter(token => Boolean(token)).join('/');

    if (folder) {
      return `${objectKind}/${folder}`;
    } else {
      return objectKind;
    }
  }

  render() {
    const alert = this.state.alertState ? <div className={styles.alertComponent}>
      <Alert {...this.state.alertState}></Alert>
    </div> : null;
    const {storages: storages, path, file, storageId} = this.state;
    const fileNotSelected = !file;
    const renderedPath = `${storageId}: ${this.getFolder()}/${path.name || 'undefined'}`;

    return <div className={styles.DirectFileUploader}>
      <div className={styles.row}>
        <div className={styles.FileUploader}>
          {this.state.progress ? <ReactBootstrap.ProgressBar
            animated
            min={0}
            max={100}
            now={this.state.progress}
            label={this.state.progressText}>
          </ReactBootstrap.ProgressBar> : null}
          <Dropzone
            accept={this.props.acceptPattern}
            onDropAccepted={this.onDropAccepted}
            onDropRejected={this.onDropRejected}
            noClick={Boolean(this.state.progress || !storages)}>
            {fileNotSelected ? (
              <div className={styles.mpDropZonePlaceHolder}>{
                this.props.children ||
                <div className = {styles.mpDropZonePlaceHolder}>{this.props.placeholder || 'Select file to upload.'}</div>
              }</div>
            ) : (
              <div className={styles.fileIcon}>
                <i className={getFileIcon(file.type)} aria-hidden='true'></i>
              </div>
            )}
          </Dropzone>
        </div>
        <div className={styles.rightInputBar}>
          <label>Target Storage</label>
          <ReactSelect
            className={styles.storageInput}
            clearable={false}
            value={this.state.storageId}
            options={storages ? storages.map(storageStatus => ({
              value: storageStatus.appId,
              label: storageStatus.writable ? storageStatus.appId : `${storageStatus.appId} (readonly)`,
              disabled: !storageStatus.writable,
            })) : []}
            onChange={storageId => {
              if (Array.isArray(storageId) || typeof storageId.value !== 'string') { return; }
              this.setState({storageId: storageId.value});
            }}
          />
          <label>Target Folder</label>
          <div className={styles.storageInput} style={{display: 'flex'}}>
            <ReactSelect
              clearable={false}
              style={{width: 85}}
              value={path.objectKind}
              options={OBJECT_KINDS.map(objectKind => ({
                value: objectKind,
                label: objectKind,
              }))}
              onChange={objectKind => {
                if (Array.isArray(objectKind) || typeof objectKind.value !== 'string') { return; }
                const newPath: FilePath = {...this.state.path, objectKind: objectKind.value};
                this.setState({path: newPath});
              }}
            />
            <input
              value={path.folder}
              style={{borderLeft: 'none'}}
              placeholder='Sub folder'
              title='Sub folder'
              onChange={event => {
                const newPath: FilePath = {...this.state.path, folder: event.target.value};
                this.setState({path: newPath})
              }}
              className={`plain-text-field__text form-control ${styles.storageInput}`}
            />
          </div>
          <label>Target Filename</label>
          <input
            disabled={fileNotSelected}
            value={path.name}
            placeholder={fileNotSelected ? 'Please select first a file to upload...' : 'Input filename...'}
            title={fileNotSelected ? 'Please select first a file to upload' : 'Filename'}
            onChange={event => this.setState({path: {...path, name: event.target.value}})}
            className={`plain-text-field__text form-control ${styles.storageInput}`}
          />
        </div>
      </div>
      <div className={styles.row} style={{flexDirection: 'column', marginTop: '10px'}}>
        <label>Target Path Preview</label>
        <div className={styles.storageInput} style={{display: 'flex'}}>
          <input
            disabled={true}
            value={fileNotSelected ? '' : renderedPath}
            style={{marginRight: 15}}
            placeholder='Please use the file selector to select a file to upload...'
            title={fileNotSelected ? 'Please use the file selector to select a file to upload' :
              'Target path: ' + renderedPath
            }
            className={`plain-text-field__text form-control ${styles.storageInput}`}
          />
          <button
            title={fileNotSelected ? 'Please use the file selector to select a file to upload' :
              `Upload file to storage "${this.state.storageId}" and location "${this.getFolder()}${path.name}"`
            }
            className='btn btn-primary'
            disabled={fileNotSelected || !path.name}
            onClick={() => this.uploadFile()}>
            Upload
          </button>
        </div>
      </div>
      <div className={styles.row}>{alert}</div>
    </div>
  }
}

export default DirectFileUploader;
