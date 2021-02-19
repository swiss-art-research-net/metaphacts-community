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
import { Props as ReactProps, createElement, createFactory } from 'react';
import * as D from 'react-dom-factories';
import {startsWith, endsWith} from 'lodash';
import * as moment from 'moment';
import * as classnames from 'classnames';
import * as ReactBootstrap from 'react-bootstrap';

import { Component } from 'platform/api/components';
import { Rdf } from 'platform/api/rdf';
import { refresh } from 'platform/api/navigation';
import { SparqlUtil } from 'platform/api/sparql';
import { RDFGraphStoreService } from 'platform/api/services/rdf-graph-store';
import { addNotification } from 'platform/components/ui/notification';
import { Spinner } from 'platform/components/ui/spinner';
import { getOverlaySystem, OverlayDialog } from 'platform/components/ui/overlay';

const Button = createFactory(ReactBootstrap.Button);
const ButtonToolbar = createFactory(ReactBootstrap.ButtonToolbar);

import './GraphActionLink.scss';

const CLASS = 'mp-rdf-graph-action';

/**
 * Allows to download or delete graph by specified IRI.
 *
 * For `GET` action the generated file name is determined by:
 *   - `file-name` given in props + extension
 *   - `file:///` graph IRI: filename without timestamp + extension
 *   - `urn:asset:` graph IRI: local name after last slash
 *   - ends with `/graph` (e.g. ontology graphs): local name before `/graph` + extension
 *   - fallback: `graph-export-TIMESTAMP` + extension
 */
interface GraphStoreActionConfig {
  /**
   * IRI of the named graph on which to perform the action
   */
  graphuri: string;
  /**
   * The action to perform on the given grap
   *
   * - `GET` to download the contents of the named graph
   * - `DELETE` to delete the contents of the named graph from the database
   */
  action: string;
  /**
   * Optional base file name (without extension) of the downloaded file.
   */
  fileName?: string;
  /**
   * File ending to determine the RDF format for the dowloaded file, e.g. `ttl`
   * for the turtle format.
   */
  fileEnding?: string;
  className?: string;
}

export type Props = GraphStoreActionConfig;

export interface State {
  isInProcess?: boolean;
}

export class GraphActionLink extends Component<Props, State> {
  constructor(props: Props, context: any) {
    super(props, context);
    this.state = {isInProcess: false};
  }

  render() {
    return D.span(
      {
        className: classnames(this.props.className, CLASS),
        onClick: this.onClick,
      },
      this.state.isInProcess ? (
        D.div({className: `${CLASS}__spinner-wrap`},
          createElement(Spinner, {spinnerDelay: 0, className: `${CLASS}__spinner`}),
          D.span({className: `${CLASS}__hide`}, this.props.children)
        )
      ) : this.props.children
    );
  }

  onClick = () => {
    if (this.state.isInProcess) { return; }

    if (this.props.action === 'DELETE') {
      const dialogRef = 'confirm-graph-deleting';
      const onHide = () => getOverlaySystem().hide(dialogRef);
      const onSubmit = () => {
        onHide();
        this.deleteGraph();
      };
      getOverlaySystem().show(
        dialogRef,
        createElement(OverlayDialog, {
          show: true,
          title: 'Delete graph',
          bsSize: 'sm',
          onHide,
          children: D.div({style: {textAlign: 'center'}},
            D.p({}, `Are you sure that you want to delete the named graph "${this.props.graphuri}"?`),
            D.p({}, `Please note that for larger named graphs (> 1 million statements), the deletion may typically take a few seconds (or even minutes) to be finally processed by the database.`),
            ButtonToolbar({style: {display: 'inline-block'}} as ReactBootstrap.ButtonToolbarProps,
              Button({variant: 'success', onClick: onSubmit}, 'Yes'),
              Button({variant: 'danger', onClick: onHide}, 'No')
            )
          ),
        })
      );
    } else if (this.props.action === 'GET') {
      const {repository} = this.context.semanticContext;
      const acceptHeader = SparqlUtil.getMimeType(this.props.fileEnding);
      const fileName = this.determineFileName();

      RDFGraphStoreService.downloadGraph({
        targetGraph: Rdf.iri(this.props.graphuri),
        acceptHeader,
        fileName,
        repository,
      }).onValue( v => { /* void */ });
    }
  }

  /**
   * Determine the file name
   *
   * a) fileName given in props + extension
   * b) file:/// graph IRI: filename without timestamp + extension
   * c) urn:asset: graph IRI: local name after last slash
   * d) ends with /graph (e.g. ontology graphs): local name before /graph
   * e) fallback: graph-export-TIMESTAMP + extension
   *
   */
  private determineFileName() {
    const ending = this.props.fileEnding ? '.' + this.props.fileEnding : '.rdf';
    let fileName;
    if (this.props.fileName) {
      fileName = this.props.fileName + ending;
    } else if (startsWith(this.props.graphuri, 'file:///' )) {
      // use the filename from the graph IRI without timestamp
      // example: file:///foaf.rdf-11-12-2020-09-11-36
      fileName = this.props.graphuri.replace('file:///', '');
      if (/.*-\d\d-\d\d-\d\d\d\d-\d\d-\d\d-\d\d/.test(fileName)) {
        fileName = fileName.substring(0, fileName.length - 20);
      }

    } else if (startsWith(this.props.graphuri, 'file:/')) {
      // use the local name of the file URL
      let _fileIri  = this.props.graphuri;
      fileName = _fileIri.substr(_fileIri.lastIndexOf('/') + 1);

    } else if (startsWith(this.props.graphuri, 'urn:asset' )) {
      // example: urn:asset:ontologies/nobel-prize/nobel-prize-schema.ttl
      fileName = this.props.graphuri.replace('urn:asset', '');
      if (fileName.indexOf('/') !== -1) {
        fileName = fileName.substr(fileName.lastIndexOf('/') + 1);
      }

    } else if (endsWith(this.props.graphuri, '/graph')) {
      // example: http://ontologies.metaphacts.com/myontology/graph
      // use local name of last path element
      try {
        let _tmpFileName = this.props.graphuri;
        // remove trailing '/graph'
        _tmpFileName = _tmpFileName.substring(0,  _tmpFileName.length - 6);
        if (_tmpFileName.lastIndexOf('/') !== -1) {
          fileName = _tmpFileName.substr(_tmpFileName.lastIndexOf('/') + 1);
        }
      } catch { /* do nothing, use fallback */ }
    }

    if (!fileName) {
      fileName =  'graph-export-' + moment().format('YYYY-MM-DDTHH-mm-ss') + ending;
    }

    // make sure we have the correct ending
    if (!fileName.endsWith(ending)) {
      fileName += ending;
    }

    return fileName;
  }

  private deleteGraph() {
    this.setState({isInProcess: true});
    addNotification({
      level: 'info',
      message: (
        'The delete command has been executed and is currently being processed by the database'
      ),
    });

    const {repository} = this.context.semanticContext;
    RDFGraphStoreService.deleteGraph({targetGraph: Rdf.iri(this.props.graphuri), repository})
      .onValue(_ => refresh())
      .onError((error: string) => {
        this.setState({isInProcess: false});
        addNotification({
          level: 'error',
          message: error,
        });
      });
  }
}

export default GraphActionLink;
