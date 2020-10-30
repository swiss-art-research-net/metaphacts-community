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
import { KeyboardEvent, MouseEvent } from 'react';
import { Button, ButtonToolbar, FormControl } from 'react-bootstrap';
import * as Kefir from 'kefir';
import { orderBy } from 'lodash';
import * as classnames from 'classnames';

import { Cancellation } from 'platform/api/async';
import { Component } from 'platform/api/components';
import * as ConfigService from 'platform/api/services/config';
import * as NamespaceService from 'platform/api/services/namespace';

import { StorageSelector, chooseDefaultTargetApp } from 'platform/components/admin/config-manager';
import { Table, TableColumnConfiguration, CellRendererProps } from 'platform/components/semantic/table';
import { Alert, AlertType } from 'platform/components/ui/alert';
import { addNotification, ErrorNotification, ErrorPresenter } from 'platform/components/ui/notification';
import { Spinner } from 'platform/components/ui/spinner';
import { AddPrefixes } from './AddPrefixes';
import { userConfirmationDialog } from './PrefixOverwriteConfirmation';
import { CollapsibleDiv, CollapsibleDivTrigger, CollapsibleDivContent } from 'platform/components/ui/collapsible-div';
import * as styles from './NamespaceManager.scss';

interface State {
  isLoading?: boolean;
  data?: ReadonlyArray<NamespaceService.NamespaceRecord>;
  appStatus?: ReadonlyArray<ConfigService.ConfigStorageStatus>;
  loadingError?: any;
  modificationError?: any;
  selectedPrefix?: string;
  selectedNamespace?: string;
  selectedAppId?: string;
}

interface PrefixRecord {
  prefix: string;
  namespace: string;
  appId: string;
}

export class NamespaceManager extends Component<{}, State> {
  private readonly cancellation = new Cancellation();

  constructor(props: {}, context: any) {
    super(props, context);
    this.state = {
      isLoading: true,
      selectedPrefix: '',
      selectedNamespace: '',
    };
  }

  render() {
    if (this.state.loadingError) {
      return <ErrorNotification errorMessage={this.state.loadingError} />;
    } else if (this.state.isLoading) {
      return <Spinner />;
    }

    return (
      <div className={styles.component}>
        {this.getTable()}
        {this.state.modificationError ? (
          <Alert alert={AlertType.DANGER} message=''>
            <ErrorPresenter error={this.state.modificationError} />
          </Alert>
        ) : null}
        {this.getUpdatePanel()}
        <CollapsibleDiv expanded={false}>
          <CollapsibleDivTrigger>
            <span>Add commonly used prefixes</span>
          </CollapsibleDivTrigger>
          <CollapsibleDivContent expanded={false}>
            <AddPrefixes onAddClick={() => this.showNotification('Prefix successfully added.')}
              data={this.state.data}></AddPrefixes>
          </CollapsibleDivContent>
        </CollapsibleDiv>
      </div>
    );
  }

  componentDidMount() {
    this.getNamespaceRecords();
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  private showNotification(message: string) {
    this.getNamespaceRecords();
    addNotification({
      message: message,
      level: 'success',
    });
  }

  private getNamespaceRecords() {
    this.cancellation.map(
      Kefir.combine({
        data: NamespaceService.getNamespaceRecords(),
        appStatus: ConfigService.getStorageStatus(),
      })
    ).observe({
      value: ({data, appStatus}) => {
        const selectedAppId = chooseDefaultTargetApp(appStatus);
        this.setState({
          isLoading: false, data, appStatus, selectedAppId,
          selectedPrefix: '',
          selectedNamespace: ''
        });
      },
      error: loadingError => this.setState({isLoading: false, loadingError}),
    });
  }

  private getTable() {
    const deleteNamespace = (record: PrefixRecord) => this.deleteNamespace(record);

    const columnConfig: TableColumnConfiguration[] = [
      {variableName: 'prefix', displayName: 'Prefix'},
      {variableName: 'namespace', displayName: 'Namespace'},
      {variableName: 'appId', displayName: 'Source App'},
      {
        displayName: 'Actions',
        cellComponent: createActionsCellRenderer({
          onDelete: record => this.deleteNamespace(record),
          isAppWritable: appId => {
            if (!appId) { return false; }
            const appState = this.state.appStatus.find(storage => storage.appId === appId);
            return appState && appState.writable;
          }
        }),
      },
    ];

    let tableData = this.state.data
      .filter(record => record.prefix.length > 0)
      .map((record): PrefixRecord => ({
        prefix: record.prefix,
        namespace: record.iri,
        appId: record.appId,
      }));
    tableData = orderBy(tableData, [
      record => record.prefix,
      record => NamespaceService.isSystemNamespacePrefix(record.prefix) ? 0 : 1
    ]);

    const griddleOptions = {
      resultsPerPage: 10,
    };
    return (
      <Table
        numberOfDisplayedRows={10}
        columnConfiguration={columnConfig}
        data={tableData}
        layout={{options: griddleOptions}}
      />
    );
  }

  private getUpdatePanel() {
    return (
      <div className={classnames(styles.updatePanel, 'row')}>
        <div className='col-xs-2'>
          <FormControl type='text'
            placeholder='Prefix'
            value={this.state.selectedPrefix}
            onChange={this.onPrefixInput}
          />
        </div>
        <div className='col-xs-6'>
          <FormControl type='text'
            placeholder='Namespace'
            value={this.state.selectedNamespace}
            onChange={this.onNamespaceInput}
          />
        </div>
        <div className='col-xs-3'>
          <StorageSelector
            allApps={this.state.appStatus}
            sourceApps={[]}
            targetApp={this.state.selectedAppId}
            onChange={this.onSelectedAppChange}
          />
        </div>
        <div className='col-xs-1'>
          <ButtonToolbar>
            <Button type='submit'
              bsSize='small'
              bsStyle='primary'
              onClick={this.onSetNamespaceClick}
              disabled={!(
                this.state.selectedPrefix &&
                this.state.selectedNamespace &&
                this.state.selectedAppId
              )}>
              Set Namespace
            </Button>
          </ButtonToolbar>
        </div>
      </div>
    );
  }

  private onPrefixInput = (e: React.KeyboardEvent<FormControl>) => {
    this.setState({
      isLoading: false,
      selectedPrefix: (e.target as HTMLInputElement).value.trim(),
    });
  }

  private onNamespaceInput = (e: KeyboardEvent<FormControl>): void => {
    this.setState({
      isLoading: false,
      selectedNamespace: (e.target as HTMLInputElement).value.trim(),
    });
  }

  private onSelectedAppChange = (selectedAppId: string) => {
    this.setState({selectedAppId});
  }

  private deleteNamespace(record: PrefixRecord) {
    this.cancellation.map(
      NamespaceService.deletePrefix(record.prefix, record.appId)
    ).observe({
      value: () => this.showNotification('Prefix successfully deleted.'),
      error: modificationError => this.setState({
        modificationError,
      }),
    });
  }

  private onSetNamespaceClick = (e: MouseEvent<ReactBootstrap.Button>) => {
    e.stopPropagation();
    e.preventDefault();
    if (this.state.data.some(({prefix}) => prefix === this.state.selectedPrefix)) {
      userConfirmationDialog(execute => {
        if (execute) {
          this.onSetNamespace();
        }
      });
    } else {
      this.onSetNamespace();
    }
  }

  private onSetNamespace() {
    this.cancellation.map(
      NamespaceService.setPrefix(
        this.state.selectedPrefix,
        this.state.selectedNamespace,
        this.state.selectedAppId
      )
    ).observe({
      value: () => this.showNotification('Prefix successfully added.'),
      error: modificationError => this.setState({
        modificationError,
      }),
    });
  }
}

function createActionsCellRenderer(params: {
  onDelete: (record: PrefixRecord) => void;
  isAppWritable: (appId: string) => boolean;
}) {
  return class extends Component<CellRendererProps, { confirm?: boolean }> {
    constructor(props: CellRendererProps, context: any) {
      super(props, context);
      this.state = {confirm: false};
    }

    render() {
      const record = this.props.rowData as PrefixRecord;
      const {isAppWritable} = params;
      if (NamespaceService.isSystemNamespacePrefix(record.prefix) || !isAppWritable(record.appId)) {
        return null;
      } else if (this.state.confirm) {
        return (
          <div>
            Delete prefix "{record.prefix}"?
            <div>
              <Button bsSize='xs' bsStyle='danger' onClick={this.onConfirm}>Delete</Button>
              <Button bsSize='xs' onClick={this.onCancel}>Cancel</Button>
            </div>
          </div>
        );
      } else {
        return <Button bsSize='xs'
          onClick={this.onDeleteClick}>
          <span className='fa fa-trash-o' />&nbsp;Delete
        </Button>;
      }
    }

    private onDeleteClick = () => {
      this.setState({confirm: true});
    }

    private onConfirm = () => {
      this.setState({confirm: false});
      const record = this.props.rowData as PrefixRecord;
      const {onDelete} = params;
      onDelete(record);
    }

    private onCancel = () => {
      this.setState({confirm: false});
    }
  };
}

export default NamespaceManager;
