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
import { Component, createElement } from 'react';
import ReactSelect, { Option } from 'react-select';
import * as json2csv from 'json2csv';
import { mapValues } from 'lodash-es';
import { Button } from 'react-bootstrap';
import * as fileSaver from 'file-saver';

import { SparqlClient } from 'platform/api/sparql';
import { Table } from 'platform/components/semantic/table';

import * as styles from './SparqlEditorResultTable.scss';

interface SparqlEditorResultTableProps {
  results: SparqlClient.SparqlSelectJsonResult;
}

interface State {
  showLabels?: boolean;
  resultsPerPage?: number;
}

export class SparqlEditorResultTable extends Component<SparqlEditorResultTableProps, State> {
  constructor(props: SparqlEditorResultTableProps) {
    super(props);

    this.state = {
      showLabels: false,
      resultsPerPage: 10,
    };
  }

  toggleLabel = () => {
    this.setState(
      (prevState, props) => ({showLabels: prevState.showLabels ? false : true})
    );
  }

  render() {
    const {results} = this.props;
    const {resultsPerPage, showLabels} = this.state;
    const prefetchAndShowLabels = Boolean(showLabels);
    const exportResults = parseJSONtoCSV(results);
    const tableElement = createElement(Table, {
      key: 'sparql-endpoint-result-table',
      data: SparqlClient.sparqlJsonToSelectResult(results),
      layout: {
        options: {resultsPerPage},
        showLabels: prefetchAndShowLabels,
        prefetchLabels: prefetchAndShowLabels,
      },
      showLiteralDatatype: true,
      showCopyToClipboardButton: true
    });
    const selectElement = createElement(ReactSelect, {
      value: resultsPerPage,
      options: [
        { value: 10, label: '10' },
        { value: 20, label: '20' },
        { value: 25, label: '25' },
        { value: 100, label: '100' },
      ],
      onChange: selected => this.setState({
        resultsPerPage: (selected as Option<number>).value,
      }),
      clearable: false,
      className: 'pull-right',
      style: { width: 70, marginRight: 10 },
    });
    const buttonLabel = prefetchAndShowLabels ? 'Fetch Labels: ON' : 'Fetch Labels: OFF';
    const className = prefetchAndShowLabels ? 'btn-success' : 'btn-danger';
    return (
      <div className={styles.tablePanel}>
        <div className={styles.titlePanel}>
          <div className={styles.title}>Table</div>
          <Button className={styles.downloadButton}
            variant='secondary'
            onClick={() => exportData('text/csv', [exportResults], 'results.csv')}>
            <i className={'fa fa-download'}></i>
          </Button>
        </div>
        <Button key={'sparql-endpoint-label-toogle-button'}
          className={`pull-right btn ${className}`}
          onClick={this.toggleLabel}>
          {buttonLabel}
        </Button>
        {selectElement}
        {tableElement}
      </div>
    );
  }

  shouldComponentUpdate(nextProps: SparqlEditorResultTableProps, nextState: State) {
    return this.props.results !== nextProps.results ||
      this.state.showLabels !== nextState.showLabels ||
      this.state.resultsPerPage !== nextState.resultsPerPage;
  }
}

export function parseJSONtoCSV(result: SparqlClient.SparqlSelectJsonResult): string {
  if (!result) {
    return;
  }
  const variables = result.head.vars;
  const querySolutions = result.results.bindings;
  const json2csvParser = new json2csv.Parser({ fields: variables });

  return json2csvParser.parse(
    querySolutions ?
      querySolutions.map(solution => {
        return mapValues(solution, binding =>
          binding.type === 'triple' ? '' : binding.value
        );
      }) :
      []
  );
}

type ExportHeader = 'text/csv' | 'text/turtle';

export function exportData(header: ExportHeader, data: string[], filename: string) {
  const blob = new Blob(data, {type: header});
  fileSaver.saveAs(blob, filename);
}
