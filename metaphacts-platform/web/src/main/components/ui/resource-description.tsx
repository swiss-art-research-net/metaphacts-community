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

import { Rdf } from 'platform/api/rdf';
import { Component } from 'platform/api/components';
import { TemplateItem } from 'platform/components/ui/template';
import { ErrorNotification } from 'platform/components/ui/notification';
import { Spinner } from 'platform/components/ui/spinner';

import * as DescriptionService from 'platform/api/services/resource-description';
import { Cancellation } from 'platform/api/async';

export interface DescriptionProps {
  /**
   * IRI of resource to fetch description for
   */
  iri: string;
  /**
   * Additional class names for component root element
   */
  className?: string;
  /**
   * Additional styles for description element
   */
  style?: React.CSSProperties;
  /**
   * Tells whether description can contain inline html or not.
   * Only used if no custom template has been provided.
   */
  inlineHtml?: boolean;

  /**
   * Template that gets the description as a parameter. Can be used with `{{description}}`.
   */
  template: string;
}

interface State {
  description: string | undefined | null;
  error?: any;
}

/**
 * @example
 * <div style="
 *  max-width: 500px;
 *  text-overflow: ellipsis;
 *  white-space: nowrap;
 *  overflow: hidden;
 * ">
 *  <mp-description iri="http://www.wikidata.org/entity/Q937" inline-html=true/>
 * </div>
 */
export class ResourceDescription extends Component<DescriptionProps, State> {
  private cancellation = new Cancellation();

  constructor(props: DescriptionProps, context: any) {
    super(props, context);
    this.state = {description: undefined};
  }

  componentDidMount() {
    this.fetchDescription(Rdf.iri(this.props.iri));
  }

  componentWillReceiveProps(nextProps: DescriptionProps) {
    const {iri} = this.props;
    if (nextProps.iri !== iri) {
      this.fetchDescription(Rdf.iri(nextProps.iri));
    }
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  private fetchDescription = (iri: Rdf.Iri) => {
    const context = this.context.semanticContext;
    this.cancellation.cancelAll();
    this.cancellation = new Cancellation();
    this.cancellation.map(DescriptionService.getDescription(iri, {context})).observe({
      value: description => this.setState({description, error: undefined}),
      error: error => this.setState({description: undefined, error: error}),
    });
  }

  render() {
    const {className, style, inlineHtml} = this.props;
    const {description, error} = this.state;

    if (error) {
      return <ErrorNotification errorMessage={error}></ErrorNotification>;
    } else if (description === undefined) {
      return <Spinner></Spinner>;
    } else if (description === null) {
      return null;
    // Right now we support only strings: html or plain
    } else if (typeof description !== 'string') {
      return <ErrorNotification
        errorMessage='Description has unsupported type!'>
      </ErrorNotification>;
    } else {
      const templateString = this.getTemplateString(this.props.template, this.props.inlineHtml);
      return <TemplateItem
        template={{source: templateString, options: {description}}}
        componentProps={{style, className}}
      ></TemplateItem>;
    }
  }

  /**
   * Returns a handlebars tempalte for displaying the description. If the user
   * provided a custom template, that one is returned. Otherwise a default template
   * is used, which shows the description and takes the inlineHtml setting into account.
   *
   * @param template Custom template
   * @param description Description to show inside the tempalte
   * @returns {string}
   */
  private getTemplateString = (template: string, inlineHtml: boolean): string => {
    if (template) {
      return template;
    }

    const descriptionBinding = inlineHtml ? '{{{description}}}' : '{{description}}';
    return `<span>${descriptionBinding}</span>`;
  }
}

export default ResourceDescription;
