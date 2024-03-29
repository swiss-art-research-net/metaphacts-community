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
/**
 * @author Philip Polkovnikov
 */

import * as React from 'react';
import * as _ from 'lodash';
import { cloneElement } from 'react';
import * as Kefir from 'kefir';
import * as SparqlJs from 'sparqljs';

import { Component } from 'platform/api/components';
import SelectionActionComponent from 'platform/components/ui/selection/SelectionActionComponent';
import { MenuProps } from 'platform/components/ui/selection/SelectionActionProps';
import { getOverlaySystem } from 'platform/components/ui/overlay';
import { OverlayDialog } from 'platform/components/ui/overlay/OverlayDialog';
import { ActionProps, AllTitleProps, TypeProps } from './TypedSelectionActionProps';
import { SparqlClient } from 'platform/api/sparql';
import { Rdf } from 'platform/api/rdf';

export const ACTION_DIALOG_REF = 'dialog-action';

type Props = MenuProps & ActionProps & AllTitleProps & TypeProps;

interface State {
  disabled: boolean
}

const QUERY = `
  SELECT DISTINCT $_iri WHERE {
    $_iri a $_type.
  }
`;

export class TypedSelectionActionComponent extends Component<Props, State> {
  constructor(props: Props, context: any) {
    super(props, context);
    this.state = {
      disabled: false,
    };
  }

  static defaultProps = {
    repositories: ['default'],
    dialogType: 'lightbox',
    checkQuery: QUERY,
  };

  componentDidMount() {
    this.checkSelection(this.props);
  }

  componentWillReceiveProps(nextProps: Props) {
    if (!_.isEqual(nextProps.selection, this.props.selection)) {
      this.checkSelection(nextProps);
    }
  }

  private checkSelection = (props: Props) => {
    // if there's no type requirements or checkQuery is undefined, we don't need to validate them
    if (!props.selection || _.isEmpty(props.selection) || !props.types || !props.checkQuery) {
      return;
    }
    this.executesCheck(props);
   };

  private executesCheck = (props: Props) => {
    const iris = props.selection.map((iri) => ({_iri: Rdf.iri(iri)}));
    const types = props.types.map((type) => ({_type: Rdf.iri(type)}));
    SparqlClient
      .prepareQuery(props.checkQuery, iris)
      .map(SparqlClient.prepareParsedQuery(types) as
        (q: SparqlJs.SparqlQuery) => SparqlJs.SelectQuery)
      .flatMap(
        query => Kefir.combine(
          props.repositories.map(repository => this.executeCheckQuery(query, repository))
        )
      )
      .map(_.flatten)
      .onValue(res => {
        const matches =
          _.intersectionWith(
            res, iris,
            (b1: SparqlClient.Binding, b2: SparqlClient.Binding) => b1['_iri'].equals(b2['_iri'])
          ).length === iris.length;
        this.setState({disabled: !matches});
      })
      .onError((err: any) => {
        console.error(err);
      });
  }

  private executeCheckQuery = (query: SparqlJs.SelectQuery, repository: string) =>
    SparqlClient.select(query, {context: {repository}})
    .map(result => result.results.bindings);

  render() {
    const disabled = this.state.disabled ||
      this.props.isDisabled(this.props.selection);
    return <SelectionActionComponent
      disabled={disabled}
      selection={this.props.selection}
      closeMenu={this.props.closeMenu}
      onAction={this.onAction}
      title={this.props.menuTitle}
    />;
  }

  private onAction = (selection: string[]) => {
    getOverlaySystem().show(
      ACTION_DIALOG_REF,
      this.renderDialog(selection),
      this.context
    );
  }

  private renderDialog = (selection: string[]) => {
    if (this.props.renderDialog) {
      return <OverlayDialog
        show={true}
        title={this.props.title}
        type={this.props.dialogType}
        bsSize={this.props.dialogSize}
        onHide={closeDialog}
      >
        {this.props.renderDialog(selection)}
      </OverlayDialog>;
    } else if (this.props.renderRawDialog) {
      const dialog = this.props.renderRawDialog(selection);
      return cloneElement(dialog, {onHide: closeDialog});
    } else {
      console.error("SelectionActionComponent wasn't provided with dialog");
    }
  }
}

export function closeDialog() {
  getOverlaySystem().hide(ACTION_DIALOG_REF);
}

export default TypedSelectionActionComponent;
