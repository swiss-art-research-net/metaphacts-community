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
import {
  ReactElement, cloneElement, Children,
} from 'react';
import * as assign from 'object-assign';
import * as _ from 'lodash';
import * as moment from 'moment';

import { Component, ComponentContext } from 'platform/api/components';
import { LdpService } from 'platform/api/services/ldp';
import { Cancellation } from 'platform/api/async';
import { getLabels } from 'platform/api/services/resource-label';
import { Rdf } from 'platform/api/rdf';

/**
 * Exports LDP resource.
 *
 * **Example**:
 * ```
 * <mp-ldp-export-resource iri="http://example.com/resource">
 *   <button class="btn btn-secondary">Export resource</button>
 * </mp-ldp-export-resource>
 * ```
 */
interface LdpExportResourceConfig {
  iri?: string;
  selection?: string[];
}

interface ExportResourceProps extends LdpExportResourceConfig {}

interface IriProps extends ExportResourceProps {
  iri: string;
}
interface SelectionProps extends ExportResourceProps {
  selection: string[];
}

function isIriProps(props: ExportResourceProps): props is IriProps {
  return _.has(props, 'iri');
}
function isSelectionProps(props: ExportResourceProps): props is SelectionProps {
  return _.has(props, 'selection');
}

export class ExportResource extends Component<ExportResourceProps, {}> {
  private readonly cancellation = new Cancellation();

  constructor(props: ExportResourceProps, context: ComponentContext) {
    super(props, context);
    this.checkProps(props);
  }

  componentWillReceiveProps(props: ExportResourceProps) {
    this.checkProps(props);
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  checkProps(props: ExportResourceProps) {
    if (isIriProps(props) === isSelectionProps(props)) {
      throw 'Property iri xor selection of mp-ldp-export-resource should be set';
    }
  }

  getLDPService() {
    return new LdpService('', this.context.semanticContext);
  }

  private onClick = () => {
    const selection = isIriProps(this.props) ? [this.props.iri] : this.props.selection;
    const exportURL = this.getLDPService().getExportURL(selection);
    const {repository} = this.context.semanticContext;
    this.cancellation.map(
      getLabels(selection.map(Rdf.iri), {context: {repository}})
    ).observe({
      value: labels => {
        const name = labels.toArray().reduce((acc, curr) => {
          const label = curr.replace(/\s/g, '-');
          return acc === '' ? label : `${acc}-${label}`;
        }, '');
        const filename = (
          `${moment().format('YYYY-MM-DDTHH-mm')}-${window.location.hostname}-${name}.trig`
        );
        window.open(`${exportURL}&filename=${filename}`, '_blank');
      },
      error: error => {
        throw Error(error);
      },
    });
  }

  public render() {
    const child = Children.only(this.props.children) as ReactElement<any>;
    return cloneElement(child, assign({}, child.props, {
      disabled: isSelectionProps(this.props) && this.props.selection.length === 0,
      onClick: this.onClick,
    }));
  }
}

export default ExportResource;
