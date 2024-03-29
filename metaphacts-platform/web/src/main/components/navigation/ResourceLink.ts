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
import { createElement, ClassAttributes, MouseEvent, CSSProperties } from 'react';
import * as D from 'react-dom-factories';
import { assign } from 'lodash';
import * as classNames from 'classnames';
import * as _ from 'lodash';

import { Component } from 'platform/api/components';
import { Rdf } from 'platform/api/rdf';
import { Draggable } from 'platform/components/dnd';
import {
  getCurrentResource, navigateToResource, getCurrentUrl, constructUrlForResourceSync,
} from 'platform/api/navigation/Navigation';

export enum ResourceLinkAction {
  edit,
}

interface ResourceLinkProps extends ClassAttributes<ResourceLink> {
  resource: Rdf.Iri;
  title?: string;
  draggable?: boolean;
  action?: ResourceLinkAction;
  params?: {};
  className?: string;
  activeClassName?: string;
  style?: CSSProperties;
  repository?: string;
  target?: '_self' | '_blank';
  fragment?: string;
}

interface State {
  readonly url?: uri.URI;
}

export class ResourceLink extends Component<ResourceLinkProps, State> {
  static defaultProps: Required<Pick<ResourceLinkProps, 'target'>> = {
    target: '_self' as const,
  };

  constructor(props: ResourceLinkProps, context: any) {
    super(props, context);
    const queryParams = makeQueryParams(this.props);
    this.state = {
      url: constructUrlForResourceSync(
        this.props.resource, queryParams, this.getRepository(), this.props.fragment
      ),
    };
  }

  public render() {
    const {
      title, className, activeClassName, style, resource, draggable, target,
    } = this.props;
    const {url} = this.state;
    const props = {
      href: url.toString(),
      title: title,
      className: classNames(className, {
        [activeClassName]: this.isLinkActive(),
      }),
      style: style,
      onClick: this.onClick,
      target: target,
    };

    // by default all links are draggable, but sometimes we want to disable this behavior
    if (draggable === false) {
      return D.a(props, this.props.children);
    } else {
      return createElement(Draggable,
        {iri: resource.value},
        D.a(props, this.props.children)
      );
    }
  }

  private onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (isSimpleClick(e) && this.props.target === '_self') {
      e.preventDefault();
      e.stopPropagation();

      const query = makeQueryParams(this.props);
      navigateToResource(this.props.resource, query, this.getRepository(), this.props.fragment)
        .onValue(() => {/**/});
    }
    // otherwise we just let default link action trigger, and for example if
    // target='_blank' is set it will just open the page in a new window
  }

  private getRepository = () => {
    return this.props.repository ? this.props.repository :
      (this.context.semanticContext ? this.context.semanticContext.repository : undefined);
  }

  private isLinkActive = () => {
    const {resource} = this.props;
    const urlParams = makeQueryParams(this.props);

    // extract params from current url and drop ?uri param
    // for comparison i.e. in case of dealing with full uris
    const currentUrlParms = assign({}, getCurrentUrl().search(true));
    delete currentUrlParms.uri;
    return getCurrentResource().equals(resource) &&
      _.isEqual(currentUrlParms, urlParams);
  }
}

function makeQueryParams(props: ResourceLinkProps): { [param: string]: string } {
  return {
    action: ResourceLinkAction[props.action],
    ...props.params,
  };
}

/**
 * make sure that we don't hijack Ctrl+Click, Meta+Click, middle mouse click default actions
 */
export function isSimpleClick(e: MouseEvent<HTMLAnchorElement>) {
  return e.button === 0 && !(e.ctrlKey || e.metaKey);
}
