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
import * as request from 'superagent';
import * as Kefir from 'kefir';
import * as _ from 'lodash';
import { Component } from 'platform/api/components';
import { Cancellation } from 'platform/api/async';
import { requestAsProperty } from 'platform/api/async';
import { addNotification, ErrorNotification } from 'platform/components/ui/notification';
import { Spinner } from 'platform/components/ui/spinner';
import {
  Table, TableColumnConfiguration, CellRendererProps,
} from 'platform/components/semantic/table';
import * as styles from './LoggingLevelSelector.scss';

const REST_GET_ALL_LOGGER = '/rest/admin/logs/loggers';
const REST_UPDATED_LOGGER = '/rest/admin/logs/loggerlevel';
const DEFAULT_PACKAGE = '';

interface State {
  isLoading?: boolean;
  data?: LoggerDetails[];
  error?: any;
}

interface LoggerDetails {
  logger?: string;
  level?: string;
  id?: number;
  checked?: boolean;
}

export function updateLoggerLevel(logger: string, newLevel: string): Kefir.Property<void> {
  const req = request.post(REST_UPDATED_LOGGER)
    .type('form')
    .send({logger, level: newLevel});

  return requestAsProperty(req).map(res => res.body);
}

export function getAllLoggerDetails(): Kefir.Property<LoggerDetails[]> {
  const req = request
    .get(REST_GET_ALL_LOGGER)
    .query({nameFilter: DEFAULT_PACKAGE})
    .type('application/json')
    .accept('application/json');

  return requestAsProperty(req).map(res => res.body);
}

export class LoggingLevelSelector extends Component<{}, State> {
  private readonly cancellation = new Cancellation();

  constructor(props: {}, context: any) {
    super(props, context);
    this.state = {
      isLoading: true,
      data: []
    };
  }

  componentDidMount() {
    this.getTableData();
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  private getTableData = () => {
    this.cancellation.map(
      getAllLoggerDetails()).observe({
        value: (loggerDetails) => {
          let data = loggerDetails;
          data.forEach((logger, index) => {
            logger.checked = false;
            logger.id = index;
          });
          this.setState({
            data,
            isLoading: false
          });
        },
        error: (err) => this.setState({
          error: err
        }),
      });
  }

  private getPanelForSavingMultiSelect() {
    return (
      <div>
        <span>Change all selected loggers to:</span>
        <select className={styles.multiSelectDropdown}
          onChange={(event) => { this.onLoggerLevelChange(event); }}
          value={'DEFAULT'}>
          <option value='DEFAULT' hidden disabled>Select</option>
          <option value='OFF'>Off</option>
          <option value='ERROR'>Error</option>
          <option value='WARN'>Warn</option>
          <option value='INFO'>Info</option>
          <option value='DEBUG'>Debug</option>
          <option value='TRACE'>Trace</option>
          <option value='ALL'>All</option>
        </select>
      </div>
    );
  }

  private onLoggerLevelChange(event: React.FormEvent<HTMLSelectElement>) {
    let anyValueToUpate = false;
    this.state.data.forEach((loggerDetails) => {
      if (loggerDetails.checked) {
        anyValueToUpate = true;
        updateLoggerLevel(
          loggerDetails.logger,
          event.currentTarget.value
        ).observe({
          value: () => this.getTableData()
        });
      }
    });
    if (anyValueToUpate) {
      addNotification({
        message: 'Logging levels changed.',
        level: 'success',
      });
    }
  }

  private onUpdate = () => {
    this.getTableData();
    addNotification({
      message: 'Logging level changed.',
      level: 'success',
    });
  }

  private getTable() {
    const columnConfig: TableColumnConfiguration[] = [
      {
        displayName: '',
        variableName: 'checked',
        cellComponent: createMultiCheckboxRenderer({
          onUpdate: (boolValue: boolean, rowData: LoggerDetails) => {
            let data = this.state.data;
            let newLogger = this.state.data[rowData.id];
            this.state.data[rowData.id].checked = boolValue;
            data[rowData.id] = newLogger;
            this.setState({
              data,
            });
          }
        })
      },
      {variableName: 'logger', displayName: 'Logger Class'},
      {variableName: 'level', displayName: 'Logger Level'},
      {
        displayName: 'Change Logger Level',
        cellComponent: createActionsCellRenderer({
          onRowLoggerLevelChange: (event, logger) => {
            const newLoggerLevel = event.currentTarget.value;
            updateLoggerLevel(logger, newLoggerLevel).observe({
              value: () => this.onUpdate()
            });
          }
        })
      },
    ];

    // let tableData = _.sortBy(this.state.data, details => details.logger);

    const griddleOptions = {
      resultsPerPage: 10,
    };

    return (
      <Table
        numberOfDisplayedRows={10}
        columnConfiguration={columnConfig}
        data={this.state.data}
        layout={{options: griddleOptions}}
      />
    );
  }

  render() {
    if (this.state.isLoading) {
      return <Spinner />;
    } else if (this.state.error) {
      return <ErrorNotification errorMessage={this.state.error} />;
    } else {
      return (
        <div>
          <h3>Log Levels</h3>
          {this.getTable()}
          <br />
          {this.getPanelForSavingMultiSelect()}
        </div>
      );
    }
  }
}

function createMultiCheckboxRenderer(params: {
  onUpdate: (isChecked: boolean, loggerDetails: LoggerDetails) => void;
}) {
  return class extends Component<CellRendererProps, {}> {
    render() {
      return (
        <div>
          <input
            type='checkbox'
            key={this.props.rowData.id}
            checked={this.props.rowData.checked}
            onChange={(event) => this.toggleSelection(event)}
          />
        </div>
      );
    }

    private toggleSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
      const {onUpdate} = params;
      onUpdate(event.currentTarget.checked, this.props.rowData);
    }
  };
}

function createActionsCellRenderer(params: {
  onRowLoggerLevelChange: (event: React.SyntheticEvent<HTMLSelectElement>, logger: string) => void;
}) {
  return class extends Component<CellRendererProps, {}> {
    render() {
      return (
        <div>
          <select onChange={(event) => { this.onChange(event); }}
            value={this.props.rowData.level}>
            <option value='OFF'>Off</option>
            <option value='ERROR'>Error</option>
            <option value='WARN'>Warn</option>
            <option value='INFO'>Info</option>
            <option value='DEBUG'>Debug</option>
            <option value='TRACE'>Trace</option>
            <option value='ALL'>All</option>
          </select>
        </div>
      );
    }

    private onChange = (event: React.SyntheticEvent<HTMLSelectElement>) => {
      const {onRowLoggerLevelChange} = params;
      onRowLoggerLevelChange(event, this.props.rowData.logger);
    }
  };
}

export default LoggingLevelSelector;
