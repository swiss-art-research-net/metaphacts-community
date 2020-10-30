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
import { Component, Props as ReactProps, MouseEvent } from 'react';
import * as D from 'react-dom-factories';
import * as classNames from 'classnames';
import * as uri from 'urijs';
import * as _ from 'lodash';

import { navigateToUrl, getCurrentUrl } from 'platform/api/navigation/Navigation';
import { extractParams } from 'platform/api/navigation/NavigationUtils';
import { isSimpleClick } from './ResourceLink';

/**
 * Component that uses platform 'Navigation',
 * to navigate to the given internal URL without page reload.
 *
 * @example
 *   <mp-link url="/sparql">sparql</mp-link>
 */
export interface LinkConfig {
  /**
   * Root-relative URL to navigate to. e.g "/sparql"
   */
  url: string;

  /**
   * link title shown on mouse-hover
   */
  title?: string;

  /**
   * 'urlqueryparam-*' attribute specify additional url query parameters
   * that will be attached to the resulting url
   */
  params?: {[name: string]: string};

  /**
   * if link should be highlighted as active, if not specified
   * link will be highlighted by active if link's url
   * and parameters fully match current location
   */
  active?: boolean;

  /**
   * css class names list
   */
  className?: string;

  /**
   * css classes that should be applied to the active link
   */
  activeClassName?: string;
}
export type LinkProps = LinkConfig & ReactProps<LinkComponent>;

export class LinkComponent extends Component<LinkProps, {}> {

  public render() {
    const {title, className, activeClassName} = this.props;
    const targetUri = this.constructUrl(this.props);
    const props = {
      title: title,
      className: classNames(className, {
        [activeClassName]: this.isLinkActive(this.props),
      }),
      href: targetUri.toString(),
      onClick: (e: MouseEvent<HTMLAnchorElement>) => this.onClick(e, targetUri),
    };
    return D.a(props, this.props.children);
  }

  private onClick = (e: MouseEvent<HTMLAnchorElement>, targetUri: uri.URI) => {
    // Go through navigation for keeping history if it's a simple click.
    // Else let the browser handle the href.
    if (isSimpleClick(e)) {
      e.preventDefault();
      e.stopPropagation();

      navigateToUrl(targetUri).onValue(() => {/**/});
    }
  }

  private constructUrl(props: LinkProps) {
    const { url } = props;
    const query = extractParams(props);
    return uri(url).setSearch(query);
  }

  private isLinkActive(props: LinkProps) {
    const url = this.constructUrl(props);
    return getCurrentUrl().equals(url) &&
      (_.isUndefined(this.props.active) ? true : this.props.active);
  }
}
export default LinkComponent;
