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
import * as Kefir from 'kefir';
import * as React from 'react';
import ReactTruncate from 'react-truncate';

import { Cancellation } from 'platform/api/async';
import { Component } from 'platform/api/components';
import { ModuleRegistry } from 'platform/api/module-loader';
import { mergeInContextOverride } from 'platform/api/services/template';

import { ErrorNotification } from 'platform/components/ui/notification';

import { TextTruncateExpandCollapse } from './TextTruncateExpandCollapse';

/**
 * Automatically truncates long text snippets.
 *
 * **Example**:
 * ```
 * <mp-text-truncate>Text</mp-text-truncate>
 * ```
 *
 * **Example**:
 * ```
 * <mp-text-truncate lines='2' expand='{{> expand}}' collapse='{{> collapse}}'>
 *   <template id='expand'><button>Expand</button></template>
 *   <template id='collapse'><button>Collapse</button></template>
 *   Text
 * </mp-text-truncate>
 * ```
 *
 * **Example**:
 * ```
 * <mp-text-truncate truncate='... <a href="#">Read more</a>'>
 *   Text
 * </mp-text-truncate>
 * ```
 */
interface TextTruncateConfig {
  /**
   * Specifies how many lines of text should be preserved until it gets truncated.
   * @default 1
   */
  lines?: number;
  /**
   * Template for content that is added to the end of the text in case it is truncated.
   *
   * @mpSeeResource {
   *   "name": "Client-side templating",
   *   "iri": "http://help.metaphacts.com/resource/FrontendTemplating"
   * }
   */
  truncate?: string;
  /**
   * Template for an element that is used to expand text.
   *
   * @mpSeeResource {
   *   "name": "Client-side templating",
   *   "iri": "http://help.metaphacts.com/resource/FrontendTemplating"
   * }
   */
  expand?: string;
  /**
   * Template for an element that is used to collapse text.
   *
   * @mpSeeResource {
   *   "name": "Client-side templating",
   *   "iri": "http://help.metaphacts.com/resource/FrontendTemplating"
   * }
   */
  collapse?: string;
  className?: string;
  style?: React.CSSProperties;
}

export type TextTruncateProps = TextTruncateConfig;

interface State {
  expanded?: boolean;
  preparationError?: any;
  truncateElement?: React.ReactNode;
  expandElement?: React.ReactNode;
  collapseElement?: React.ReactNode;
}

export class TextTruncate extends Component<TextTruncateProps, State> {
  private readonly cancellation = new Cancellation();

  constructor(props: TextTruncateProps, context: any) {
    super(props, context);
    this.state = {
      expanded: false,
    };
  }

  componentDidMount() {
    const {truncate, expand, collapse} = this.props;
    this.cancellation.map(
      Kefir.combine({
        truncateTemplate: truncate
          ? this.appliedTemplateScope.prepare(truncate)
          : Kefir.constant<undefined>(undefined),
        expandTemplate: expand
          ? this.appliedTemplateScope.prepare(expand)
          : Kefir.constant<undefined>(undefined),
        collapseTemplate: collapse
          ? this.appliedTemplateScope.prepare(collapse)
          : Kefir.constant<undefined>(undefined),
      })
    ).observe({
      value: ({truncateTemplate, expandTemplate, collapseTemplate}) => {
        const dataContext = mergeInContextOverride(this.appliedDataContext, undefined);

        const truncateElement = truncateTemplate
          ? ModuleRegistry.mapHtmlTreeToReact(truncateTemplate(dataContext))
          : <span />;

        const expandElement = expandTemplate ? (
          <TextTruncateExpandCollapse onClick={this.handleExpand}>
            {ModuleRegistry.mapHtmlTreeToReact(expandTemplate(dataContext))}
          </TextTruncateExpandCollapse>
        ) : undefined;

        const collapseElement = collapseTemplate ? (
          <TextTruncateExpandCollapse onClick={this.handleExpand}>
            {ModuleRegistry.mapHtmlTreeToReact(collapseTemplate(dataContext))}
          </TextTruncateExpandCollapse>
        ) : undefined;

        this.setState({truncateElement, expandElement, collapseElement});
      },
      error: preparationError => this.setState({preparationError}),
    });
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  private handleExpand = () => {
    this.setState({expanded: !this.state.expanded});
  }

  render() {
    const {lines, className, style} = this.props;
    const {
      expanded, truncateElement, expandElement, collapseElement, preparationError,
    } = this.state;

    if (preparationError) {
      return <ErrorNotification errorMessage={preparationError} />;
    } else if (!truncateElement) {
      return null;
    }

    const ellipsis = <span>{truncateElement}{expandElement}</span>;
    return (
      <div className={className} style={style}>
        <ReactTruncate
          lines={expanded ? 0 : lines || 1}
          ellipsis={ellipsis}>
          {this.props.children}
        </ReactTruncate>
        {expanded ? collapseElement : null}
      </div>
    );
  }
}

export default TextTruncate;
