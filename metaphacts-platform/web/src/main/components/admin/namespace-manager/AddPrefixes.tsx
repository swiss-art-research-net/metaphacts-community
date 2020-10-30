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
import * as NamespaceService from 'platform/api/services/namespace';
import { Component } from 'platform/api/components';
import { Cancellation } from 'platform/api/async';
import {
  Table, TableColumnConfiguration, CellRendererProps,
} from 'platform/components/semantic/table';
import { Button } from 'react-bootstrap';
import { userConfirmationDialog } from './PrefixOverwriteConfirmation';

export const ACTION_DIALOG_REF = 'dialog-action';
const prefixDataFromJSON = require('./prefixes.json');

export interface AddPrefixesProps {
  data?: ReadonlyArray<NamespaceService.NamespaceRecord>;
  namespaces?: ReadonlyArray<PrefixIriData>;
  onAddClick?: () => void;
}

interface PrefixIriData {
  prefix: string;
  iri: string;
  description?: string;
  link?: string;
}

export class AddPrefixes extends Component<AddPrefixesProps, {}> {

  private readonly cancellation = new Cancellation();

  constructor(props: AddPrefixesProps, context: any) {
    super(props, context);
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  private getTable() {
    const columnConfig: TableColumnConfiguration[] = [
      {
        variableName: 'prefix',
        displayName: 'Prefix'
      },
      {
        variableName: 'iri',
        displayName: 'Namespace',
      },
      {
        variableName: 'description',
        displayName: 'Description',
      },
      {
        variableName: 'link',
        displayName: 'Link',
        cellTemplate: '<a href=\'{{link}}\' target=\'_blank\'>{{link}}</a>'
      },
      {
        displayName: 'Actions',
        cellComponent: this.createActionsCellRenderer({
          onAdd: record => {
            if (this.props.data && this.props.data.some(({prefix}) => prefix === record.prefix)) {
              userConfirmationDialog(execute => {
                if (execute) {
                  this.addNamespace(record);
                }
              });
            } else {
              this.addNamespace(record);
            }
          },
        }),
      },
    ];

    const griddleOptions = {
      resultsPerPage: 6,
    };
    return (
      <Table
        numberOfDisplayedRows={10}
        columnConfiguration={columnConfig}
        data={
          (this.props && this.props.namespaces)
            ? this.props.namespaces.concat(prefixDataFromJSON)
            : prefixDataFromJSON
        }
        layout={{options: griddleOptions}}
      />
    );
  }

  private createActionsCellRenderer(params: {
    onAdd: (record: PrefixIriData) => void;
  }) {
    return class extends Component<CellRendererProps, {}> {

      render() {
        return (
          <Button bsSize='xs' onClick={this.onAddClick}>
            <span className='fa fa-plus-square-o' />&nbsp;Add
          </Button>
        );
      }

      private onAddClick = () => {
        const record = this.props.rowData as PrefixIriData;
        const { onAdd } = params;
        onAdd(record);
      }
    };
  }
  private addNamespace(record: PrefixIriData) {
      this.cancellation.map(
        NamespaceService.setPrefix(
          record.prefix,
          record.iri,
          'runtime'
        )
      ).observe({
        value: () => {
          const {onAddClick} = this.props;
          onAddClick();
        }
      });
  }

  render() {
    return (
      this.getTable()
    );
  }
}

export default AddPrefixes;
