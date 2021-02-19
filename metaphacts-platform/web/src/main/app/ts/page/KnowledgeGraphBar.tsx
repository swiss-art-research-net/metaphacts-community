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

import { Component } from 'platform/api/components';
import { Rdf } from 'platform/api/rdf';
import { Cancellation } from 'platform/api/async';
import { BrowserPersistence, Action } from 'platform/components/utils';

import { PageViewer } from './PageViewer';
import './KnowledgeGraphBar.scss';

interface KnowledgeGraphBarProps {
  iri: Rdf.Iri;
  context: Rdf.Iri;
  params?: { [index: string]: string };
  show: boolean;
  isOptional: boolean;
  onToggle?: (expanded: boolean) => void;
}

interface KnowledgeGraphBarState {
  expanded: boolean;
}

const LocalStorageState = BrowserPersistence.adapter<{
  readonly knowledgeGraphBarExpanded?: boolean;
}>();

const LOCAL_STORAGE_KEY = 'pageLayoutState';


export class KnowledgeGraphBar extends Component<KnowledgeGraphBarProps, KnowledgeGraphBarState> {
  private readonly cancellation = new Cancellation();
  private readonly currentIri = Action<Rdf.Iri>();

  constructor(props: KnowledgeGraphBarProps, context: any) {
    super(props, context);

    let barExpanded;
    if (props.isOptional) {
      const storedState = LocalStorageState.get(LOCAL_STORAGE_KEY);
      barExpanded = (storedState != null && storedState.knowledgeGraphBarExpanded != null)
        ? storedState.knowledgeGraphBarExpanded : true;
    } else {
      barExpanded = false;
    }

    this.state = {
      expanded: barExpanded,
    };
    // propagate initial state
    if (this.props.onToggle) {
      this.props.onToggle(barExpanded);
    }
  }

  componentDidMount() {
    this.currentIri(this.props.iri);
  }

  componentWillReceiveProps(props: KnowledgeGraphBarProps) {
    this.currentIri(props.iri);

    if (props.isOptional) {

      // TODO: keep this local, don't access localstorage here
      let storedState = LocalStorageState.get(LOCAL_STORAGE_KEY);
      let storedExpanded = (storedState != null && storedState.knowledgeGraphBarExpanded != null)
        ? storedState.knowledgeGraphBarExpanded : false;
      if (storedExpanded !== this.state.expanded) {
        this.toggleCollapsible(props);
      }

    } else {
      if (!this.state.expanded) {
        this.toggleCollapsible(props);
      }
    }
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  render() {
    return this.renderCollapsible(<PageViewer
        id='knowledge-graph-bar-content'
        iri={this.props.iri}
        context={this.props.context}
        params={{
          ...this.props.params
        }}
    />, this.props.show ? '' : 'knowledgeGraphBar--hidden');
  }

  private renderCollapsible(node: React.ReactNode, wrapperClass: string) {
    const expandedClass = this.state.expanded ?
      'knowledgeGraphBar--expanded' : 'knowledgeGraphBar--collapsed';
    return <div className={`${wrapperClass} ${expandedClass}`}>
      <div className='knowledgeGraphBar__content'>{node}</div>
      <div className='knowledgeGraphBar__toggle'>
        <button
          className={`knowledgeGraphBar__toggleButton fa fa-chevron-right`}
          onClick={() => this.toggleCollapsible(this.props)}></button>
      </div>
    </div>;
  }

  private toggleCollapsible(props: KnowledgeGraphBarProps) {
    const newExpandedState = !this.state.expanded;
    this.setState({expanded: newExpandedState});

    if(props.isOptional) {
      LocalStorageState.update(LOCAL_STORAGE_KEY,
        {knowledgeGraphBarExpanded: newExpandedState});
    }

    if (props.onToggle) {
      this.props.onToggle(newExpandedState);
    }
  }

}
