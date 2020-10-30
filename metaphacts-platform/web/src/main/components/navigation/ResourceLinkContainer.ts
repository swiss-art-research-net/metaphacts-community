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
import { Props as ReactProps, createElement,
         cloneElement, Children, MouseEvent } from 'react';

import { Rdf } from 'platform/api/rdf';
import {
  navigateToResource, NavigationUtils, openResourceInNewWindow,
  constructUrlForResource, construcUrlForResourceSync,
} from 'platform/api/navigation';
import { Draggable } from 'platform/components/dnd';
import { Component } from 'platform/api/components';
import { ErrorNotification } from 'platform/components/ui/notification';
import { isSimpleClick } from './ResourceLink';
import { Cancellation } from 'platform/api/async';

/**
 * See 'Link'.
 */
export interface ResourceLinkContainerConfig {
  /**
   * resource IRI to navigate
   */
  iri: string;
  /**
   * resource IRI to navigate
   * @deprecated
   */
  uri?: string;

  /**
   * Specify if link should be draggable, e.g. into sets.
   *
   * @default true
   */
  draggable?: boolean;

  /**
   * Specify if the link attributes should be propagated to the child.
   * Undocumented, as the default should usually be correct.
   * @ignore
   */
  propagateLink?: boolean;

  /**
   * Equivalent to the `target` attribute of the `<a>` DOM element.
   * Can be set to `_blank` to open the link in a new tab/window.
   *
   * @default '_self'
   */
  target?: '_self' | '_blank';

  // catcher for query params
  [index: string]: any;
}
export type ResourceLinkContainerProps =
  ResourceLinkContainerConfig & ReactProps<ResourceLinkContainer>;

interface State {
  readonly url?: uri.URI;
  readonly propagateLink: boolean;
}

export class ResourceLinkContainer extends Component<ResourceLinkContainerProps, State> {
  private readonly cancellation = new Cancellation();

  static defaultProps: Partial<ResourceLinkContainerProps> = {
    target: '_self' as '_self',
  };

  constructor(props: ResourceLinkContainerProps, context: any) {
    super(props, context);

    const propagateLink = this.propagateLink();
    this.state = {
      propagateLink,
      url: propagateLink ? construcUrlForResourceSync(
        Rdf.iri(this.getIri()), this.getParams(), this.getRepository()
      ) : null,
    };
  }

  componentDidMount() {
    if (this.state.propagateLink) {
      this.cancellation.map(
        constructUrlForResource(
          Rdf.iri(this.getIri()), this.getParams(), this.getRepository()
        )
      ).observe({
        value: url => this.setState({url}),
        error: error => console.error(error),
      });
    }
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  private getIri = () => {
    // tslint:disable-next-line: deprecation
    const {iri, uri} = this.props;
    return iri || uri;
  }

  private getParams = () => NavigationUtils.extractParams(this.props);

  private getRepository = () =>
    this.context.semanticContext ? this.context.semanticContext.repository : undefined


  onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const iri = Rdf.iri(this.getIri());
    const repository = this.getRepository();
    const params = this.getParams();

    if (isSimpleClick(event) && this.props.target === '_self') {
      navigateToResource(iri, params, repository).onValue(() => {/**/});
    } else {
      openResourceInNewWindow(iri, params, repository);
    }
  }

  private propagateLink = () => {
    if (this.props.propagateLink !== null && this.props.propagateLink !== undefined) {
      return this.props.propagateLink;
    }

    const onlyChild = Children.only(this.props.children);
    const typeObj = (onlyChild as any).type;
    const childType = (typeof typeObj === 'string') ? typeObj : typeObj.name;

    // Propagate to anchors.
    // While the child could already have a href set, there wouldn't be reason to
    // use the ResourceLinkContainer for that case, so it can be overwritten.
    // This would also be useful for MenuItem (which renders a link), but type
    // information is not available on runtime.
    return childType === 'a';
  }

  render() {
    const iri = this.getIri();
    if (!iri) {
      return createElement(ErrorNotification, {
        errorMessage: `The component doesn't have the "iri" property`
      });
    }

    const props = this.state.propagateLink ? {
      onClick: this.onClick,
      href: this.state.url.toString(),
      target: this.props.target
    } : {
      onClick: this.onClick,
    };

    if (this.props.draggable === false) {
      return cloneElement(<any>Children.only(this.props.children), props);
    } else {
      return createElement(Draggable,
        {iri},
        cloneElement(<any>Children.only(this.props.children), props)
      );
    }
  }
}
export default ResourceLinkContainer;
