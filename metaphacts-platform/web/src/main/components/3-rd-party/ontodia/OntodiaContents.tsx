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
import { cloneElement, ReactNode } from 'react';
import * as maybe from 'data.maybe';
import { DiagramModel, AuthoringState, TemporaryState, ElementIri } from 'ontodia';

import { Component } from 'platform/api/components';
import { listen } from 'platform/api/events';
import { Cancellation } from 'platform/api/async/Cancellation';
import { Rdf } from 'platform/api/rdf';
import { isValidChild, universalChildren } from 'platform/components/utils';

import { TemplateItem } from 'platform/components/ui/template';
import { getOverlaySystem } from 'platform/components/ui/overlay';
import { SaveSetDialog, createNewSetFromItems } from 'platform/components/sets';

import * as OntodiaEvents from './OntodiaEvents';

import * as styles from './OntodiaContents.scss';

export interface OntodiaContentsConfig {
  id: string;
  template?: string;
}

export type OntodiaContentsProps = OntodiaContentsConfig;

interface State {
  elements?: Array<{ iri: string; persisted: boolean }>;
}

export class OntodiaContents extends Component<OntodiaContentsProps, State> {
  static defaultProps: Pick<OntodiaContentsProps, 'template'> = {
    template: `<semantic-link iri='{{iri.value}}'></semantic-link>`,
  };

  private readonly cancellation = new Cancellation();

  constructor(props: OntodiaContentsProps, context: any) {
    super(props, context);
    this.state = {
      elements: [],
    };
  }

  componentDidMount() {
    this.listenToEvents();
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  private listenToEvents = () => {
    this.cancellation.map(
      listen({
        eventType: OntodiaEvents.DiagramChanged,
        source: this.props.id,
      })
    ).observe({
      value: ({data: {model, authoringState, temporaryState}}) =>
        this.updateElements({
          model: model as DiagramModel,
          authoringState: authoringState as AuthoringState,
          temporaryState: temporaryState as TemporaryState,
        }),
    });
  }

  private updateElements(
    {model, authoringState, temporaryState}: {
      model: DiagramModel;
      authoringState: AuthoringState;
      temporaryState: TemporaryState;
    }
  ) {
    const elements: Array<{ iri: string; persisted: boolean }> = [];
    const isPersisted = (iri: ElementIri) =>
      !authoringState.elements.has(iri) && !temporaryState.elements.has(iri);
    model.elements.forEach(element => {
      if (!element.temporary) {
        elements.push({
          iri: element.iri,
          persisted: isPersisted(element.iri),
        });
      }
    });
    this.setState({elements: elements});
  }

  private onCreateSet = () => {
    const dialogRef = 'create-set-dialog';
    const hideDialog = () => getOverlaySystem().hide(dialogRef);
    getOverlaySystem().show(
      dialogRef,
      <SaveSetDialog
        onSave={name => {
          const items: Array<Rdf.Iri> = [];
          this.state.elements.forEach(({iri, persisted}) => {
            if (persisted) {
              items.push(
                Rdf.iri(iri)
              );
            }
          });
          return createNewSetFromItems(this.props.id, name, items).map(hideDialog);
        }}
        onHide={hideDialog}
        maxSetSize={maybe.Nothing<number>()}
      />
    );
  }

  private mapChildren(children: ReactNode): ReactNode {
    return React.Children.map(children, child => {
      if (!isValidChild(child)) { return child; }
      if (child.type === 'button' && child.props.name === 'submit') {
        return cloneElement(child, {onClick: this.onCreateSet});
      }
      if (child.props.children) {
        return cloneElement(child, {}, universalChildren(
          this.mapChildren(child.props.children)));
      }
      return child;
    });
  }

  render() {
    return (
      <div>
        <div className={styles.container}>
        {
          this.state.elements.map(({iri, persisted}) =>
            <TemplateItem key={iri}
              template={{source: this.props.template, options: {iri: Rdf.iri(iri), persisted}}}
            />
          )
        }
        </div>
        {this.mapChildren(this.props.children)}
      </div>
    );
  }
}

export default OntodiaContents;
