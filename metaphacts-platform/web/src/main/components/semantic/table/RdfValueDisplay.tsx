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
import * as Kefir from 'kefir';

import { Rdf } from 'platform/api/rdf';
import { ResourceLink } from 'platform/components/navigation';
import { SparqlUtil, QueryContext } from 'platform/api/sparql';
import * as LabelService from 'platform/api/services/resource-label';

import { CopyToClipboardComponent } from 'platform/components/copy-to-clipboard';

interface CommonProps {
  className?: string;
  fetchLabel?: boolean;
  fetchContext?: QueryContext;
  showLiteralDatatype?: boolean;
  linkParams?: {};
  showCopyToClipboardButton?: boolean;
}

export interface RdfValueDisplayProps extends CommonProps {
  data: Rdf.TermLike;
  getLabel: (resource: Rdf.Iri) => string | undefined;
}

export class RdfValueDisplay extends React.Component<RdfValueDisplayProps> {
  render() {
    const {data, getLabel, ...otherProps} = this.props;
    if (!Rdf.isKnownTerm(data)) {
      return null;
    }
    switch (data.termType) {
      case 'NamedNode':
      case 'BlankNode':
      case 'Literal': {
        const label = Rdf.isIri(data) ? getLabel(data) : undefined;
        return <NodeDisplay {...otherProps} data={data} label={label} />;
      }
      case 'Quad': {
        return renderQuad(data, this.props);
      }
    }
    return null;
  }
}

function renderQuad(quad: Rdf.Triple, props: RdfValueDisplayProps): React.ReactNode {
  let copyButton: React.ReactNode = null;
  if (props.showCopyToClipboardButton) {
    copyButton = (
      <CopyToClipboardComponent text={starTermToString(quad)}>
        <button className='btn btn-link btn-sm' title='Copy triple'>
          <i className='fa fa-clipboard text-muted'></i>
        </button>
      </CopyToClipboardComponent>
    );
  }
  const nestedProps: RdfValueDisplayProps = {...props, showCopyToClipboardButton: false};
  return (
    <>
      <span>&lt;&lt;&nbsp;</span>
      <RdfValueDisplay {...nestedProps} data={quad.subject} />
      {' '}<RdfValueDisplay {...nestedProps} data={quad.predicate} />
      {' '}<RdfValueDisplay {...nestedProps} data={quad.object} />
      {quad.graph.termType === 'DefaultGraph'
        ? null : <>{' '}<RdfValueDisplay {...nestedProps} data={quad.graph} /></>}
      <span>&nbsp;&gt;&gt;</span>
      {copyButton}
    </>
  );
}

function starTermToString(term: Rdf.TermLike) {
  if (Rdf.isQuad(term)) {
    let result = '<< ';
    result += starTermToString(term.subject) + ' ';
    result += starTermToString(term.predicate) + ' ';
    result += starTermToString(term.object) + ' ';
    if (term.graph.termType !== 'DefaultGraph') {
      result += starTermToString(term.graph) + ' ';
    }
    result += '>>';
    return result;
  } else if (Rdf.isKnownTerm(term)) {
    return Rdf.termToString(term);
  }
}

interface NodeDisplayProps extends CommonProps {
  data: Rdf.Node;
  label: string | undefined;
}

interface State {
  readonly label?: string;
}

const NON_BREAKABLE_SPACE = '\xa0';

class NodeDisplay extends React.Component<NodeDisplayProps, State> {
  private subscription: Kefir.Subscription | undefined;

  constructor(props: NodeDisplayProps) {
    super(props);
    this.state = {label: props.label};
  }

  componentDidMount() {
      this.fetchLabelForIri(this.props);
  }

  componentWillReceiveProps(nextProps: NodeDisplayProps) {
    if (!nextProps.data.equals(this.props.data) || nextProps.fetchLabel !== this.props.fetchLabel) {
        this.fetchLabelForIri(nextProps);
    }
  }

  fetchLabelForIri(props: NodeDisplayProps) {
    const node = props.data;
    if (Rdf.isIri(node)) {
      if (this.subscription) {
        this.subscription.unsubscribe();
        this.subscription = undefined;
      }
      if (props.label === undefined && props.fetchLabel) {
        // display non-breakable space instead of nothing to
        // prevent vertical size changes in most circumstances
        this.setState({label: NON_BREAKABLE_SPACE});
        this.subscription = LabelService.getLabel(node, {context: props.fetchContext}).observe({
          value: label => this.setState({label}),
          error: () => this.setState({label: node.value})
        });
      } else {
        this.setState({label: props.label});
      }
    }
  }

  componentWillUnmount() {
      if (this.subscription) {
        this.subscription.unsubscribe();
        this.subscription = undefined;
      }
  }

  render() {
    const {className} = this.props;
    const {label} = this.state;
    const displayValue = renderRdfNode(this.props, label);
    return <span className={className}>{displayValue}</span>;
  }
}

function renderRdfNode(
  props: NodeDisplayProps,
  label: string | undefined
): JSX.Element | string | undefined {
  const {data} = props;
  if (Rdf.isIri(data)) {
    const content = typeof label === 'string' ? label : data.value;
    const resourceLink = (
      <ResourceLink
        className={props.className}
        data-rdfa-about={data.value}
        resource={data}
        title={content}
        params={props.linkParams}>
        {content}
      </ResourceLink>
    );
    if (!props.showCopyToClipboardButton) {
      return resourceLink;
    }
    return (
      <>
        {resourceLink}
        <CopyToClipboardComponent text={data.value}>
          <button className='btn btn-link btn-sm' title='Copy IRI'>
            <i className='fa fa-clipboard text-muted'></i>
          </button>
        </CopyToClipboardComponent>
      </>
    );
  } else if (Rdf.isLiteral(data)) {
    const suffix = props.showLiteralDatatype
      ? data.language
        ? <i>{` (@${data.language})`}</i>
        : <i>{` (${SparqlUtil.compactIriUsingPrefix(data.datatype)})`}</i>
      : undefined;
    return <span>{data.value}{suffix}</span>;
  } else if (Rdf.isBnode(data)) {
    return data.value;
  } else {
    return null;
  }
}
