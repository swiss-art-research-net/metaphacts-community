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
  createFactory, createElement,
} from 'react';
import * as maybe from 'data.maybe';
import * as Kefir from 'kefir';

import { Component } from 'platform/api/components';
import { Rdf } from 'platform/api/rdf';
import { LdpService } from 'platform/api/services/ldp';
import { navigateToResource, refresh } from 'platform/api/navigation';
import { getOverlaySystem } from 'platform/components/ui/overlay';

import { CreateResourceDialog } from './CreateResourceDialog';

import './create-ldp-resource.scss';

/**
 * Duplicates existing LDP resource.
 *
 * **Example**:
 * ```
 * <mp-ldp-duplicate-resource-action iri="http://example.com/resource">
 *   <button class="btn btn-secondary">Duplicate resource</button>
 * </mp-ldp-duplicate-resource-action>
 * ```
 */
interface LdpDuplicateResourceActionConfig {
  /** Initial title for created object. */
  title?: string;
  /** Prompt to enter title. */
  placeholder?: string;
  /** IRI of container where original and copied resource resides. */
  container?: string;
  /** IRI of resource to duplicate. */
  iri: string;
  /**
   * @default "redirect"
   */
  postAction?: 'redirect' | 'reload' | string;
}

export interface DuplicateResourceProps extends LdpDuplicateResourceActionConfig {}

class DuplicateResource extends Component<DuplicateResourceProps, {}>  {
  public static defaultProps: Required<Pick<DuplicateResourceProps, 'postAction'>> = {
    postAction: 'redirect',
  };

  public render() {
    const child = Children.only(this.props.children) as ReactElement<any>;
    const props = {
      onClick: () => {
        const dialogRef = 'duplicate-resource';
        getOverlaySystem().show(
          dialogRef,
          createElement(CreateResourceDialog, {
            onSave: this.onSave,
            onHide: () => getOverlaySystem().hide(dialogRef),
            show: true,
            title: this.props.title ? this.props.title : 'Duplicate resource',
            placeholder: this.props.placeholder,
          })
        );
      },
    };
    return cloneElement(child, props);
  }

  private onSave = (name: string): Kefir.Property<any> => {
    const service = new LdpService(this.props.container, this.context.semanticContext);
    return service.copyResource(
      Rdf.iri(this.props.iri),
      maybe.fromNullable(this.props.container).map(Rdf.iri),
      maybe.Just(name)
    ).map(Rdf.iri).flatMap((newResourceIri: Rdf.Iri) => {
      if (!this.props.postAction || this.props.postAction === 'reload') {
        refresh();
      } else if (this.props.postAction === 'redirect') {
        // assumption is that ldp resources are always stored in the assets repository
        return navigateToResource(newResourceIri, {}, 'assets').onValue(() => {/**/});
      } else {
        navigateToResource(Rdf.iri(this.props.postAction)).onValue(v => v);
      }
    }).toProperty();
  }
}

export default DuplicateResource;
