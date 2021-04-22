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
import { Component, ReactNode, createElement } from 'react';
import { Just, Nothing } from 'data.maybe';
import * as Immutable from 'immutable';
import { Row, Col, Button, FormControl, Modal, ModalProps, Tabs, Tab } from 'react-bootstrap';
import * as _ from 'lodash';
import { SparqlQuery, Update } from 'sparqljs';

import { SparqlClient, SparqlUtil, QueryContext } from 'platform/api/sparql';
import {
  Ontodia, OntodiaDataProviders, OntodiaRdfDataProvider
} from 'platform/components/3-rd-party/ontodia';
import { getCurrentUrl } from 'platform/api/navigation';
import {
  ContextTypes, ComponentContext, SemanticContextProvider,
} from 'platform/api/components';
import { Cancellation } from 'platform/api/async';
import { VocabPlatform } from 'platform/api/rdf/vocabularies';
import { getRepositoryStatus } from 'platform/api/services/repository';
import { Permissions } from 'platform/api/services/security';
import { componentHasType } from 'platform/components/utils';
import { HasPermission } from 'platform/components/security/HasPermission';
import { getOverlaySystem } from 'platform/components/ui/overlay';
import { Alert, AlertConfig, AlertType } from 'platform/components/ui/alert';
import { ErrorPresenter } from 'platform/components/ui/notification';
import {
  ConfirmationDialog, ConfirmationDialogProps
} from 'platform/components/ui/confirmation-dialog';
import { QueryTemplate } from 'platform/components/query-editor';
import { SparqlEditorResultTable, exportData } from './SparqlEditorResultTable';
import { SparqlEditor } from './SparqlEditor';

import {
  ContextTypes as EditorContextTypes,
  ComponentContext as EditorContext,
} from './SparqlQueryEditorContext';

import { Controlled as CodeMirror } from 'react-codemirror2';

import * as styles from './SparqlQueryEditor.scss';

export interface SparqlQueryEditorProps { }

type QueryType = 'CONSTRUCT' | 'ASK' | 'SELECT' | 'DESCRIBE';

interface State {
  readonly isExecuting?: boolean;
  readonly error?: any
  readonly query?: string;
  readonly repositoryStatus?: Immutable.Map<string, boolean>;
  readonly selectedRepository?: string;
  readonly tableResults?: SparqlClient.SparqlSelectJsonResult;
  readonly responseResults?: string;
  readonly sparqlQueryType?: QueryType;
  readonly queryExecutionTime?: number | undefined;
  readonly ontodiaKey: number;
}

export class SparqlQueryEditor extends Component<SparqlQueryEditorProps, State> {
  static readonly contextTypes = {...ContextTypes, ...EditorContextTypes};
  context: ComponentContext & EditorContext;

  private readonly cancellation = new Cancellation();
  private queryExecutionBegin: number | undefined;

  private editor: SparqlEditor;

  constructor(props: SparqlQueryEditorProps, context: any) {
    super(props, context);
    this.state = {
      isExecuting: false,
      selectedRepository: getCurrentUrl().search(true)['repository'],
      tableResults: undefined,
      error: undefined ,
      responseResults: undefined,
      sparqlQueryType: undefined,
      queryExecutionTime: undefined,
      ontodiaKey: 0,
    };
  }

  render() {
    const {tableResults, responseResults, queryExecutionTime} = this.state;
    const queryExecutionTimeSec = queryExecutionTime / 1000;
    const {context} = this.getQueryContext();
    return (
      <Row className={styles.sparqlQueryEditor}>
        <Col as='div' md={12}>
          <SparqlEditor ref={editor => this.editor = editor}
            backdrop={this.state.isExecuting}
            query={this.state.query}
            onChange={query => {
              this.context.queryEditorContext.setQuery(query.value, { silent: true });
              this.setState({ query: query.value });
            }}
            persistent={() => 'sparqlEndpoint'}
            autofocus={true}
          />
          {this.state.error ?
            <Alert alert={AlertType.DANGER} message={''}>
              <ErrorPresenter error={this.state.error} />
            </Alert> : null
          }
          <div className={`form-inline ${styles.controls}`}>
            <div className={styles.queryControlPanel}>
              <HasPermission permission={Permissions.queryEditorSelectEndpoint}>
                {this.renderRepositorySelector()}
              </HasPermission>
              <Button
                variant='primary'
                disabled={this.state.isExecuting}
                onClick={() => this.executeQuery(this.state.query)}>
                {this.state.isExecuting ? 'Executing...' : 'Execute'}
              </Button>
              <HasPermission permission={
                Permissions.toLdp(
                  'container',
                  VocabPlatform.QueryTemplateContainer,
                  'create',
                  'owner'
                )
              }>
                <Button
                  variant='secondary'
                  onClick={() => getOverlaySystem().show(
                  SaveQueryModal.KEY,
                  <SaveQueryModal query={this.state.query}
                    onHide={() => getOverlaySystem().hide(SaveQueryModal.KEY)}>
                  </SaveQueryModal>
                )}>
                  Save
              </Button>
              </HasPermission>
            </div>
            {typeof queryExecutionTime === 'number'
              ? <div className={styles.queryExecutionTime}>
                Query Execution Time: {queryExecutionTime.toFixed(0)} ms / {
                queryExecutionTimeSec.toFixed(2)} s
              </div>
              : null}
          </div>
          {tableResults ? (
            <SemanticContextProvider repository={context.repository}>
              <SparqlEditorResultTable results={tableResults} />
            </SemanticContextProvider>
          ) : (
            responseResults || responseResults === ''
              ? this.resultViewer()
              : undefined
          )}
        </Col>
      </Row>
    );
  }

  private resultViewer() {
    const {responseResults, sparqlQueryType, ontodiaKey} = this.state;
    const codeMirrorAddonOptions = {
      foldGutter: false,
      textAreaClassName: ['form-control'],
      matchTags: {bothTags: true},
      matchBrackets: true,
    };
    const codemirror = createElement(CodeMirror, {
      value: responseResults,
      onBeforeChange: () => null,
      options: {
        ...codeMirrorAddonOptions,
        mode: 'text/turtle',
        indentWithTabs: false,
        indentUnit: 2,
        tabSize: 2,
        viewportMargin: Infinity,
        lineNumbers: true,
        lineWrapping: true,
        gutters: ['CodeMirror-linenumbers'],
      },
    });
    const baseOntodia = React.Children.only(this.props.children);
    if (!componentHasType(baseOntodia, Ontodia)) {
      throw Error('The child element should be Ontodia');
    }
    const ontodiaChildren = React.Children.map(baseOntodia.props.children as ReactNode, child => {
      if (componentHasType(child, OntodiaDataProviders)) {
        const rdfDataProvider = React.Children.only(child.props.children);
        if (componentHasType(rdfDataProvider, OntodiaRdfDataProvider)) {
          return React.cloneElement(child, {}, React.cloneElement(rdfDataProvider, {
            provisionGraph: responseResults}));
        }
      } else {
        return child;
      }
    });
    return (
      <div className={styles.responsePanel}>
        <div className={styles.titlePanel}>
          <div className={styles.title}>Response</div>
          {sparqlQueryType === 'ASK'
            ? null
            : (
              <Button className={styles.downloadButton}
                variant='secondary'
                onClick={() => exportData('text/turtle', [responseResults], 'results.ttl')}>
                <i className={'fa fa-download'}></i>
              </Button>
            )
          }
        </div>
        <Col md={12}>
          {sparqlQueryType === 'CONSTRUCT'
            ? (
              <Tabs id='sparql-query-result' unmountOnExit={true} defaultActiveKey='codemirror'>
                <Tab eventKey='codemirror' title='Result'>
                  <div className={styles.codeMirrorResult}>
                    {codemirror}
                  </div>
                </Tab>
                <Tab eventKey='ontodia' title='Graph'>
                  <div className={styles.ontodiaContainer}>
                    {React.cloneElement(baseOntodia, {
                      requestLinksOnInit: false,
                      graph: responseResults,
                      key: ontodiaKey,
                    }, ontodiaChildren)}
                  </div>
                </Tab>
              </Tabs>
            )
            : <div className={styles.codeMirrorResult}>
                {codemirror}
              </div>}
        </Col>
      </div>
    );
  }

  private renderRepositorySelector() {
    const options: ReactNode[] = [];
    if (this.state.repositoryStatus) {
      options.push(<option key='@empty' value=''>(from context)</option>);
      this.state.repositoryStatus.forEach((running, repository) => options.push(
        <option key={repository} disabled={!running} value={repository}>
          {repository}
        </option>
      ));
    } else {
      options.push(<option key='@loading' value=''>Loading...</option>);
    }

    return (
      <span className={styles.repositorySelector}>
        <label>
          Repository:
          <FormControl as='select'
            className={styles.repositorySelectorDropdown}
            value={this.state.selectedRepository}
            onChange={e => this.setState({
              selectedRepository: (e.target as HTMLSelectElement).value,
            })}>
            {options}
          </FormControl>
        </label>
      </span>
    );
  }

  componentDidMount() {
    const {queryEditorContext} = this.context;
    const contextQuery = queryEditorContext.getQuery();
    const initialQuery = contextQuery.getOrElse(this.editor.getQuery().value);
    if (contextQuery.isNothing) {
      queryEditorContext.setQuery(initialQuery, {silent: true});
    }
    this.setState({query: initialQuery});

    // if a query is supplied via request parameter,
    // we are going to execute it after the component has been mounted
    if (getCurrentUrl().hasSearch('query')) {
      this.executeQuery(initialQuery);
    }

    this.cancellation.map(queryEditorContext.queryChanges).onValue(({query, repository}) => {
      this.setState({
        query: query.getOrElse(undefined),
        error: undefined,
        selectedRepository: repository.getOrElse(''),
        tableResults: undefined,
      });
    });

    this.cancellation.map(getRepositoryStatus()).onValue(
      repositoryStatus => this.setState({repositoryStatus}));
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  private executeQuery = (query: string) => {
    this.setState({isExecuting: true});
    this.queryExecutionBegin = performance.now();
    try {
      const parsedQuery = SparqlUtil.parseQuery(query);
      this.addRecentQueries(query);
      switch (parsedQuery.type) {
        case 'query':
          this.sendSparqlQuery(parsedQuery, parsedQuery.queryType);
          break;
        case 'update':
          this.confirmAndExecuteSparqlUpdate(parsedQuery);
          break;
      }
    } catch (e) {
      const message = _.startsWith(e.message, 'Parse error') ?
        'Query Syntax Error. ' + e.message : e.message;
      this.setState({
        isExecuting: false,
        error: message
      });
    }
  }

  private sendSparqlQuery = (query: SparqlQuery, queryType: QueryType) => {
    SparqlClient.sendSparqlQuery(
      query,
      SparqlClient.getDefaultQueryResultAcceptFormat(queryType),
      this.getQueryContext()
    ).onAny(event => {
      if (event.type === 'value') {
        let tableResults;
        let responseResults: string;
        let sparqlQueryType: QueryType;
        if (queryType === 'SELECT') {
          tableResults = JSON.parse(event.value) as SparqlClient.SparqlSelectJsonResult;
        } else {
          responseResults = event.value ? event.value : '';
          sparqlQueryType = queryType;
        }
        this.setState({
          isExecuting: false,
          tableResults,
          responseResults,
          sparqlQueryType,
          queryExecutionTime: performance.now() - this.queryExecutionBegin,
          ontodiaKey: this.state.ontodiaKey + 1,
        });
      } else if (event.type === 'error') {
        // seems typings are wrong in kefir
        const e: any = event as any;
        this.setState({
          isExecuting: false,
          error: e.value
        });
      }
    });
  }

  private confirmAndExecuteSparqlUpdate(query: SparqlQuery) {
    const dialogRef = 'update-confirmation';
    const {context} = this.getQueryContext();
    const hideDialog = () => getOverlaySystem().hide(dialogRef);
    const props: ConfirmationDialogProps = {
      message: `Do you want to execute the UPDATE operations on the "${context.repository}" repository?`,
      onHide: () => {
        hideDialog();
        this.setState({isExecuting: false});
      },
      onConfirm: confirm => {
        hideDialog();
        if (confirm) {
          this.executeSparqlUpdate(query);
        } else {
          this.setState({isExecuting: false});
        }
      },
    };
    getOverlaySystem().show(
      dialogRef,
      createElement(ConfirmationDialog, props)
    );
  }

  private executeSparqlUpdate  = (query: SparqlQuery) => {
    SparqlClient.executeSparqlUpdate(query as Update, this.getQueryContext())
      .onValue(v => {
        this.setState({
          error: undefined,
          isExecuting: false,
          responseResults: 'SPARQL Update Operation executed!',
        });
      }).onError((e: Error) => {
        this.setState({
          isExecuting: false,
          error: e
        });
      });
  }

  private getQueryContext = () => {
    const contextOverride: Partial<QueryContext> = this.state.selectedRepository
      ? {repository: this.state.selectedRepository} : undefined;
    return {context: {...this.context.semanticContext, ...contextOverride}};
  }

  private addRecentQueries = (query: string) => {
    const repository = this.state.selectedRepository || undefined;
    this.context.queryEditorContext.setQuery(query, {repository});
  }
}

interface SaveQueryModalProps extends ModalProps {
  query: string;
}

class SaveQueryModal extends Component<SaveQueryModalProps, {}> {
  static readonly KEY = 'SparqlQueryEditor-SaveQuery';
  render() {
    const {onHide, query} = this.props;
    return (
      <Modal show={true} onHide={onHide} size='lg' backdrop={'static'}>
        <Modal.Header closeButton={true}>
          <Modal.Title>Save Query</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <SemanticContextProvider repository='assets'>
            <QueryTemplate defaultQuery={query} />
          </SemanticContextProvider>
        </Modal.Body>
      </Modal>
    );
  }
}

export default SparqlQueryEditor;
