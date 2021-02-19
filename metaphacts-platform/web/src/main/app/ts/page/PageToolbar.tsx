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
import * as URI from 'urijs';
import { ButtonGroup, ButtonToolbar } from 'react-bootstrap';

import { Component } from 'platform/api/components';
import { ResourceLink, ResourceLinkAction } from 'platform/components/navigation';
import { Rdf } from 'platform/api/rdf';
import { Util as SecurityUtil, Permissions } from 'platform/api/services/security';
import { Cancellation } from 'platform/api/async';
import { Action } from 'platform/components/utils';

import '../../scss/page-editor.scss';

interface PageEditorToolbarProps {
  iri: Rdf.Iri;
  params?: { [index: string]: string };
}

interface PageEditorToolbarState {
  hasEditPermission: boolean;
}

export class PageToolbar extends Component<PageEditorToolbarProps, PageEditorToolbarState> {
  private cancellation = Cancellation.cancelled;
  private readonly currentIri = Action<Rdf.Iri>();

  constructor(props: PageEditorToolbarProps, context: any) {
    super(props, context);
    this.state = {
      hasEditPermission: false
    };
  }

  public componentDidMount() {
    // Check edit permissions during the first load
    this.queryPermissions(this.props.iri);
    this.currentIri(this.props.iri);
  }

  public componentWillReceiveProps(props: PageEditorToolbarProps) {
    /**
     * Check edit permissions when re-rendering the page
     * with a new IRI (e.g, on following a semantic link)
     */
    if (this.props.iri.value !== props.iri.value) {
      this.queryPermissions(props.iri);
    }
    this.currentIri(props.iri);
  }

  private queryPermissions(pageIri: Rdf.Iri) {
    this.cancellation.cancelAll();
    this.cancellation = new Cancellation();
    this.cancellation.map(
      SecurityUtil.isPermitted(`${Permissions.templateSave}:<${pageIri.value}>`
    )).observe({
      value: hasEditPermission => this.setState({hasEditPermission}),
    });
  }

  public componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  render() {
    const {iri} = this.props;
    const {hasEditPermission} = this.state;
    return (
      <ButtonToolbar className='component-page-toolbar hidden-print'>
        <ButtonGroup>
          {this.showAssetsRepositoryIndicator()}
          {this.props.children}
          {hasEditPermission
            ? <ResourceLink
              resource={iri}
              className='btn btn-secondary component-page-toolbar__btn_edit'
              activeClassName='active'
              title='Edit page'
              action={ResourceLinkAction.edit}>
                <span style={{marginLeft: '3px'}}>Edit Page</span>
              </ResourceLink>
            : null}
        </ButtonGroup>
      </ButtonToolbar>
    );
  }

  /**
   * Show assets repository indicator only to users with edit permission.
   */
  private showAssetsRepositoryIndicator() {
    const {hasEditPermission} = this.state;
    const repository = this.context.semanticContext.repository;
    if (repository !== 'default' && hasEditPermission) {
      return <div className='badge alert-info component-page-toolbar__repository_indicator'>
        {`${repository} repository`}
        <span className='component-page-toolbar__reset_button' onClick={this.resetRepository}>
          <span className='fa fa-times component-page-toolbar__reset_button_icon'></span>
        </span>
      </div>;
    } else {
      return null;
    }
  }

  resetRepository() {
    const uri = new URI(window.location.href);
    if (uri.hasQuery('repository')) {
      uri.removeQuery('repository');
      window.location.href = uri.href();
    }
  }
}

export default PageToolbar;
