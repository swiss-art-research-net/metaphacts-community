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
import { ProgressBar, FormControl, Button, Card, FormCheck, Tab, Tabs, FormGroup } from 'react-bootstrap';
import * as moment from 'moment';
import * as Kefir from 'kefir';
import * as SparqlJs from 'sparqljs';
import * as classnames from 'classnames';

import { Component } from 'platform/api/components';
import { Cancellation } from 'platform/api/async';
import { navigateToResource, refresh} from 'platform/api/navigation';
import { Rdf } from 'platform/api/rdf';
import { SparqlClient, SparqlUtil } from 'platform/api/sparql';

import { RDFGraphStoreService } from 'platform/api/services/rdf-graph-store';
import {
  getRepositoryInfo, RepositoryType, NeptuneRepositoryType
} from 'platform/api/services/repository';

import { Alert, AlertConfig, AlertType } from 'platform/components/ui/alert';
import { Dropzone } from 'platform/components/ui/dropzone';
import { FileRejection, DropEvent} from 'react-dropzone';
import { ErrorPresenter } from 'platform/components/ui/notification';
import { Spinner } from 'platform/components/ui/spinner';
import { TemplateItem } from 'platform/components/ui/template';

import { RdfUploadExtension } from './extensions';

import './RdfUpload.scss';

// TODO unify across forms etc
export type PostAction = 'reload' | 'redirect' | string;

interface RdfUploadConfig {
  /**
   * Optional IRI string (without brackets) of the target named graph to load the data into.
   *
   * By default this is undefined and supposed to be either provided by the user at runtime or
   * generated automatically.
   *
   * @default undefined
   */
  targetGraph?: string;
  /**
   * Whether the NamedGraphs from the source serialization should be preserved
   * (only applicable to .trig and .nq files).
   */
  keepSourceGraphs?: boolean;
  /**
   * A handlebars template string to shown as placeholder in the drop area.
   *
   * As default context object it will get an object with elements from
   * the current state (`{targetGraph: string}`).
   */
  placeholderTemplate?: string;
  /**
   * Whether advanced options (specifying target named graph, keep source named graphs)
   * should be displayed to the user.
   *
   * @default true
   */
  showAdvancedOptions?: boolean;
  /**
   * Whether the option/input to load data by URL should be displayed to the user.
   *
   * @default true
   */
  showLoadByUrl: boolean;
  /**
   * Accepted file types. If set, the field will only allow to drop or select the
   * specified file types.
   *
   * By default any file type is allowed.
   *
   * Keep in mind that mime type determination is not reliable across
   * platforms. CSV files, for example, are reported as text/plain under macOS but as
   * application/vnd.ms-excel under Windows. In some cases there might not be a
   * mime type set at all. Instead of specifying the mime type, you can also specify file endings.
   *
   * See https://github.com/okonet/attr-accept for more information.
   *
   * **Example**:
   * ```
   * accept='application/rdf+xml'
   * accept='["application/rdf+xml", ".ttl"]'
   * ```
   *
   * @default undefined
   */
  accept?: string | string[];
  /**
   * Action to perform after the data has been uploaded successfully.
   *
   * By default the page will refresh. Other options:
   * - `redirect`: will navigate to `Assets:NamedGraph?graph=<iri of the generated graph>`;
   * - `{any iri string}`: will navigate to the resource IRI;
   *
   * @default "refresh"
   */
  postAction?: PostAction;
  className?: string;
  style?: React.CSSProperties;
  contentType?: string;
}

export type RdfUploadProps = RdfUploadConfig;

interface State {
  messages?: ReadonlyArray<AlertConfig>;
  progress?: number;
  progressText?: string;
  targetGraph?: string;
  keepSourceGraphs?: boolean;
  showOptions?: boolean;
  remoteFileUrl?: string;
  repositoryType?: RepositoryType;
}

interface RdfUploadPlaceholderTemplateData {
  targetGraph?: string;
}

const CLASS_NAME = 'RdfUpload';
const tabClass = `${CLASS_NAME}__tab`;
const noteClass = `${CLASS_NAME}__note`;

type DefaultProps = Required<Pick<RdfUploadProps,
  'showAdvancedOptions' | 'showLoadByUrl' | 'keepSourceGraphs' | 'placeholderTemplate'
>>;

export class RdfUpload extends Component<RdfUploadProps, State> {
  private readonly cancellation = new Cancellation();

  static defaultProps: DefaultProps = {
    showAdvancedOptions: true,
    showLoadByUrl: true,
    keepSourceGraphs: false,
    placeholderTemplate: `
      <div><i style="color:#d4d4d4;" class="fa fa-cloud-upload fa-4x"></i><br>
        <span style="font-size:150%">Drag & Drop your RDF file(s) here</span><br>
        <span style="font-size:75%">OR</span><br>
        <button type="button" style="width:100px;" class="btn btn-light">Browse Files</button><br>
      </div>
    `,
  };

  constructor(props: RdfUploadProps, context: any) {
    super(props, context);
    this.state = {
      messages: [],
      targetGraph: props.targetGraph,
      keepSourceGraphs: props.keepSourceGraphs,
      showOptions: false,
    };
  }

  componentDidMount() {
    RdfUploadExtension.loadAndUpdate(this, this.cancellation);
    this.cancellation.map(
      getRepositoryInfo('default')
    ).onValue(
      info => this.setState({
        repositoryType: info.type,
      })
    );
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  private onDrop = (files: ReadonlyArray<File>) => {
    const {repository} = this.context.semanticContext;

    this.setState({
      messages: [],
      progress: undefined,
    });

    const uploads = files.map((file: File, fileNumber: number) => {
      const contentType = _.isEmpty(this.props.contentType)
        ? SparqlUtil.getMimeType(SparqlUtil.getFileEnding(file))
        : this.props.contentType;
      const targetGraph = this.state.targetGraph
        ? this.state.targetGraph
        : `file:///${file.name}-${createTimestamp()}`;

      const upload = RDFGraphStoreService.createGraphFromFile({
        targetGraph: Rdf.iri(encodeURI(targetGraph)),
        keepSourceGraphs: this.state.keepSourceGraphs,
        file,
        contentType,
        onProgress: (percent) => this.setState({
          progress: ((fileNumber / files.length) + (percent / 100)) * 100,
          progressText: fileNumber + '/' + files.length + ' Files',
        }),
        repository,
      });

      this.cancellation.map(upload).observe({
        value: () => this.appendUploadMessage('File: ' + file.name + ' uploaded.'),
        error: error => {
          this.appendUploadMessage('File: ' + file.name + ' failed.', error);
        },
      });
      return upload;
    });

    this.cancellation.map(Kefir.combine(uploads)).observe({
      value: () => setTimeout(() => this.postAction(), 2000),
    });
  }


  private onRejected = (fileRejections: FileRejection[], event: DropEvent) => {
    fileRejections.map(({ file, errors }) => {
      errors.map(e =>
        this.appendUploadMessage('File: ' + file.name + ' can not be uploaded.', e.message)
      );
    });
  }

  private appendUploadMessage(message: string, uploadError?: any) {
    this.setState((state: State): State => {
      return {
        messages: [...state.messages, {
          alert: uploadError ? AlertType.WARNING : AlertType.SUCCESS,
          message,
          children: uploadError ? <ErrorPresenter error={uploadError} /> : undefined,
        }]
      };
    });
  }

  private onChangeTargetGraph = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const val = e.target.value.trim();
    if (!_.isEmpty(val)) {
      this.setState({ targetGraph: val });
    } else {
      this.setState({ targetGraph: undefined });
    }
  }

  private onChangeKeepSourceGraphs = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ keepSourceGraphs: e.target.checked });
  }

  private postAction = () => {
    const {postAction} = this.props
    if (!postAction || postAction === 'reload') {
      refresh();
    } else if (postAction === 'redirect' && this.state.targetGraph) {
      const ngIri = Rdf.iri(this.state.targetGraph);
      navigateToResource(Rdf.iri('http://www.metaphacts.com/resource/assets/NamedGraph'), {'graph': ngIri.value}).observe({});
    } else if(this.props.postAction) {
      navigateToResource(Rdf.iri(this.props.postAction)).observe({});
    }
  }

  render() {
    if (RdfUploadExtension.isLoading()) {
      return <Spinner />;
    }
    const {className, style} = this.props;

    const messages = this.state.messages.map((config, index) => <Alert key={index} {...config} />);
    const progressBar = this.state.progress ? (
      <ProgressBar animated min={0} max={100}
        now={this.state.progress} label={this.state.progressText ?? 'Uploading Files'}
      />
    ) : null;

    const isInProgress = typeof this.state.progress === "number";

    // extracting parts of the state
    const {targetGraph} = this.state;
    const templateOptions: RdfUploadPlaceholderTemplateData = {targetGraph};

    const uploadTabContent = (
      <>
        {progressBar}
        <Dropzone
          onDropAccepted={this.onDrop}
          accept={this.props.accept}
          onDropRejected={this.onRejected}
          className={`${CLASS_NAME}__rdf-dropzone-content`} >
            <TemplateItem template={{ source: this.props.placeholderTemplate, options: templateOptions} } />
        </Dropzone>
        {messages}
      </>
    )

    const showAdvancedOptions=this.props.showAdvancedOptions;

    // if it is neither neptune nor url upload enabled, show simply the upload dnd field
    if (!this.props.showLoadByUrl) {
      return (
        <div className={classnames(CLASS_NAME, className)} style={style}>
          {showAdvancedOptions ? this.renderAdvancedOptions() : null}
          {uploadTabContent}
        </div>);
    }
    return (
      <div className={classnames(CLASS_NAME, className)} style={style}>
        {showAdvancedOptions ? this.renderAdvancedOptions() : null}
        <Tabs id='rdf-upload-tabs' unmountOnExit={true}>
          {this.renderTabExtensions()}
          <Tab eventKey='1' className={tabClass} title='File Upload' disabled={isInProgress}>
            {uploadTabContent}
          </Tab>
          {/* load by URL doesn't make any sense for Neptune repository */}
          {this.state.repositoryType !== NeptuneRepositoryType ?
            <Tab eventKey='2' className={tabClass} title='Load by HTTP/FTP/File URL'
                disabled={isInProgress}>
              {progressBar}
              <FormControl type='text' value={this.state.remoteFileUrl || ''}
                placeholder='Please enter publicly accessible HTTP/FTP URL'
                onChange={e => this.setState({
                  remoteFileUrl: e.currentTarget.value,
                })}
              />
              <div className={noteClass}>
                The database must support the SPARQL LOAD command and must allow outgoing
                network connections to the publicly accessible HTTP/FTP URLs or must have access to the File URL respectively (files must be available in the database file system).
              </div>
              <Button variant='primary' className={`${CLASS_NAME}__load-button`}
                disabled={!this.state.remoteFileUrl || isInProgress}
                onClick={this.onClickLoadByUrl}>
                Load by URL
              </Button>
              {messages}
            </Tab> : null
            }
        </Tabs>
      </div>
    );
  }

  private renderTabExtensions() {
    const tabs = RdfUploadExtension.get();
    if (!tabs) {
      return null;
    }
    const tabKeys = Object.keys(tabs);
    tabKeys.sort();

    const {repositoryType, targetGraph} = this.state;
    return tabKeys.map((tabKey, index) => {
      const tab = tabs[tabKey]({repositoryType, targetGraph});
      if (tab) {
        return (
          <Tab eventKey={String(3 + index)} className={tabClass} title={tab.title}>
            {tab.content}
          </Tab>
        );
      } else {
        return null;
      }
    });
  }

  private renderAdvancedOptions() {

    const {showOptions, keepSourceGraphs} = this.state ;
    const clName = `fa fa-angle-${showOptions? 'up' : 'down'}`
    return (
      <>
        <Card body className='mb-3'>
          <h4>
            <a onClick={() => this.setState({ showOptions: !showOptions })}>
              <i className={clName} style={{ marginRight: '10px' }}></i>
              Advanced Options
            </a>
          </h4>
          {showOptions ?
            <div>
              <FormControl type='text'
                placeholder='URI of the target NamedGraph. Will be generated automatically if empty.'
                disabled={this.state.keepSourceGraphs}
                onChange={this.onChangeTargetGraph}
              />
              <FormGroup controlId='keepsourcegraph'>
                <FormCheck type='checkbox' label='Keep source NamedGraphs (.trig and .nq files)'
                  defaultChecked={keepSourceGraphs}
                  onChange={this.onChangeKeepSourceGraphs}>
                </FormCheck>
              </FormGroup>
            </div> : null}
        </Card>
      </>
    );
  }

  private onClickLoadByUrl = () => {
    this.setState({
      messages: [],
      progress: undefined,
    });

    const {remoteFileUrl, targetGraph} = this.state;
    let updateQuery: SparqlJs.Update;
    try {
      updateQuery = makeLoadQuery(remoteFileUrl, targetGraph);
    } catch (error) {
      const message = targetGraph
        ? 'Error constructing update query (probably invalid file or named graph URL?)'
        : 'Error constructing update query (probably invalid file URL?)';
      this.appendUploadMessage(message, error);
      return;
    }

    this.setState({
      progress: 100,
      progressText: 'Database is processing the LOAD command',
    });

    const {semanticContext} = this.context;
    this.cancellation.map(
      SparqlClient.executeSparqlUpdate(updateQuery, {context: semanticContext})
    ).observe({
      value: () => {
        this.appendUploadMessage('File from URL successfully loaded.');
        setTimeout(() => this.postAction() , 2000);
      },
      error: error => {
        this.appendUploadMessage('Failed to load file from URL.', error);
      },
      end: () => {
        this.setState({
          progress: undefined,
          progressText: undefined,
        });
      },
    });
  }
}

function makeLoadQuery(remoteFileUrl: string, targetGraph: string): SparqlJs.Update {
  const targetGraphIri = targetGraph
    ? targetGraph
    : `${remoteFileUrl}-${createTimestamp()}`;

  const query = `LOAD <${encodeURI(remoteFileUrl)}> INTO GRAPH <${encodeURI(targetGraphIri)}>`;
  const parsedUpdate = SparqlUtil.parseQuery(query);
  if (parsedUpdate.type !== 'update') {
    throw new Error('Query must be an update operation');
  }

  return parsedUpdate;
}

function createTimestamp(): string {
  return moment().format('DD-MM-YYYY-hh-mm-ss');
}

export default RdfUpload;
