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
import {
  Button, Alert, DropdownButton, Dropdown,
  FormControl, Form, FormGroup,
} from 'react-bootstrap';
import { createElement } from 'react';
import { Cancellation } from 'platform/api/async';
import { Component } from 'platform/api/components';
import { refresh} from 'platform/api/navigation';

import { Spinner } from 'platform/components/ui/spinner';
import {
  getRepositoryConfig, getRepositoryConfigTemplate, updateOrAddRepositoryConfig, deleteRepositoryConfig
} from 'platform/api/services/repository';
import { ConfirmationDialog } from 'platform/components/ui/confirmation-dialog';
import * as styles from './RepositoryConfigEditor.scss';
import {TurtleEditorComponent} from './TurtleEditor';
import { getOverlaySystem } from 'platform/components/ui/overlay';

interface Props {
  id?: string
  repositoryTemplates?: string []
  showRestartPrompt?: boolean
  preselectedTemplate?: string
  reloadPageOnSuccess?: boolean
  initializerMode?: boolean     // true if editor is used from RepositoryConfigInitializer
}



interface State {
  readonly source?: string
  readonly loadingError?: any;
  readonly responseError?: any;
  readonly submittedSuccessfully?: boolean;
  readonly newRepositoryID?: string;
  readonly validateConfiguration?: boolean;
}

const SUCCESS_MESSAGE = 'The repository configuration was updated.';

type DefaultProps = Required<Pick<Props,
  'id' |
  'repositoryTemplates' |
  'showRestartPrompt' |
  'preselectedTemplate' |
  'reloadPageOnSuccess' |
  'initializerMode'
>>;

export class RepositoryConfigEditor extends Component<Props, State> {
  private readonly cancellation = new Cancellation();
  static defaultProps: DefaultProps = {
    id: undefined,
    repositoryTemplates: [],
    showRestartPrompt: false,
    preselectedTemplate: undefined,
    reloadPageOnSuccess: false,
    initializerMode: false,
  };
  constructor(props: Props, context: any) {
    super(props, context);
    this.state = {
      validateConfiguration: true,
    };
  }

  componentDidMount() {
    if (this.props.preselectedTemplate) {
      this.selectTemplate(this.props.preselectedTemplate);
    } else {
      this.fetchConfig(this.props.id);
    }
  }

  fetchConfig = (id: string) => {
    this.setState({
      responseError: undefined,
      loadingError: undefined,
      submittedSuccessfully: false,
      validateConfiguration: true,
    });
    if (!id) {
        this.setState({
            source: undefined,
        });
        return;
    }
    this.cancellation.map(
      getRepositoryConfig(id)
    ).observe({
        value: (config) => this.setState({
          source: config,
        }),
        error: loadingError => this.setState({loadingError}),
      });
  }

  componentWillReceiveProps(nextProps: Props) {
      if (this.props.id !== nextProps.id) {
        this.fetchConfig(nextProps.id);
      }
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  render() {
    const {source, loadingError, responseError, submittedSuccessfully} = this.state;
    const {showRestartPrompt, reloadPageOnSuccess, initializerMode} = this.props;

    if (loadingError) {
        return <Alert variant='info'> {loadingError} </Alert>;
    }

    if (this.isEditMode() && !source) {
        return <Spinner />;
    }

    return (
      <div data-flex-layout='column top-left' className={styles.holder}>
        <div>
            <h4>{
                this. isEditMode()
                ? `Edit Repository Config "${this.props.id}"`
                : `Create new Repository Config`
                }
            </h4>
        </div>
        { !this. isEditMode() &&
          <div>
          <Form>
              <FormGroup className={styles.formGroup}>
                      <strong> Repository ID:</strong><br/>
                      <FormControl
                          className={styles.formGroup}
                          type='text'
                          value={this.state.newRepositoryID}
                          onChange={this.handleNewRepositoryID}
                          isValid={this.isNewRepositoryIDValid()}
                          isInvalid={!this.isNewRepositoryIDValid()}
                          placeholder='Please specify a new and unique repository id.'/>
                {!this.isNewRepositoryIDValid() &&
                <FormControl.Feedback type='invalid'>
                  Repository ID must be a unique, alphanumeric string of length &gt;= 5 characters.
                </FormControl.Feedback>
                }
              </FormGroup>
          </Form>
        </div>
        }
        <div>
            {this.renderTemplateSelector()}
        </div>
        <div>
                <TurtleEditorComponent ref='editor'
                turtleString={
                  source
                  ? source
                  : `#Please select a template to create a new repository configuration`
                }/>
            <div>
              <label>
                <input type='checkbox'
                  checked={this.state.validateConfiguration}
                  onChange={() =>
                    this.setState(({validateConfiguration}): State =>
                      ({validateConfiguration: !validateConfiguration})
                    )
                  }
                  disabled={this.props.id === 'default'}/>
                {' '}
                Validate configuration
              </label>
            </div>
            <Button variant='primary'
              className={styles.ActionButton}
              disabled={(!this.isEditMode() && !this.isNewRepositoryIDValid())}
              onClick={this.onSubmitConfig}>
                {this.isEditMode() ? 'Update Config' : 'Create Config' }
            </Button>
            { this.isEditMode() && !initializerMode && <Button
              variant='danger'
              className={styles.ActionButton}
              onClick={() => this.onDeleteRepository(this.props.id)}
              >Delete</Button>
            }
            {responseError &&
                <Alert variant='danger'> {responseError} </Alert>
            }
            { reloadPageOnSuccess && submittedSuccessfully &&
                window.location.reload()
            }
            { showRestartPrompt && submittedSuccessfully &&
                <Alert variant='success'> {SUCCESS_MESSAGE} </Alert>
            }
        </div>
      </div>
    );
  }

  handleNewRepositoryID = (e: React.SyntheticEvent<any>) => {
    e.preventDefault();
    e.stopPropagation();
    this.setState({newRepositoryID : (e.target as any).value});
  }


  isNewRepositoryIDValid = (): boolean => {
    if (this.isEditMode()) {
      return undefined;
    }
    const id = this.state.newRepositoryID;
    const reg = new RegExp('');
    if (!id || id.length < 5 || !reg.test(id)) {
      return false;
    }
    return true;
  }

  onSubmitConfig = () => {
    const id = this.props.id ? this.props.id : this.state.newRepositoryID;
    const turtle = (this.refs['editor'] as TurtleEditorComponent).getTurtle();
    updateOrAddRepositoryConfig(id, turtle, this.state.validateConfiguration).onValue(
      v => {
        this.setState({
          responseError: undefined,
          submittedSuccessfully: true,
        });
        refresh();
      }
    ).onError( error => {
        console.log(error);
        this.setState({
          responseError: error,
          submittedSuccessfully: false,
          });
        });

  }

  isEditMode = () => {
      return this.props.id ? true : false;
  }

  renderTemplateSelector = () => {
    const {repositoryTemplates} = this.props;
    if (!repositoryTemplates) {
        return <Spinner />;
    }
    const items = repositoryTemplates.map( id => {
        return <Dropdown.Item eventKey={id} key={id}>{id}</Dropdown.Item>;
    });
    return (
        <DropdownButton
            variant='secondary'
            title='From template ....'
            onSelect={this.onTemplateSelected}
            id='template-dropdown'>
                {items}
        </DropdownButton>
    );
  }

  selectTemplate = (templateId: string) => {
    this.cancellation.map(getRepositoryConfigTemplate(templateId)).observe({
      value: value => {
        this.setState({source: value, submittedSuccessfully: false});
      },
      error: error => this.setState({loadingError: error, submittedSuccessfully: false}),
    });
  }

  onTemplateSelected =  (eventKey: any, e?: React.SyntheticEvent<{}>) => {
    e.preventDefault();
    e.stopPropagation();
    this.selectTemplate(eventKey);
  }

  executeDeleteRepository = (id: string) => {
      deleteRepositoryConfig(id).observe({
          value: () => {
            this.setState({
                responseError: undefined,
                submittedSuccessfully: true,
              });
            refresh();
          },
          error: error => {
            this.setState({
                responseError: error,
                submittedSuccessfully: false,
                });
          },
        });
  }

  onDeleteRepository = (id: string) => {
    const dialogRef = 'delete-repository-confirmation';
    const hideDialog = () => getOverlaySystem().hide(dialogRef);
    const props = {
      message: `Do you want to delete the "${id}" repository?`,
      onHide: () => {
        hideDialog();
      },
      onConfirm: (confirm: boolean) => {
        hideDialog();
        if (confirm) {
          this.executeDeleteRepository(id);
        }
      },
    };
    getOverlaySystem().show(
      dialogRef,
      createElement(ConfirmationDialog, props)
    );
  }

}

export default RepositoryConfigEditor;
