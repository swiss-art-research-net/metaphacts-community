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
  createFactory,
  ReactElement,
  createElement,
  cloneElement,
  Children,
  FunctionComponent,
} from 'react';
import * as D from 'react-dom-factories';
import * as ReactBootstrap from 'react-bootstrap';
import * as CopyToClipboard from 'react-copy-to-clipboard';
import * as assign from 'object-assign';
import * as Kefir from 'kefir';
import * as uri from 'urijs';

import { Rdf } from 'platform/api/rdf';
import * as URLMinifierService from 'platform/api/services/url-minifier';
import { Component } from 'platform/api/components';

const FormControl = createFactory(ReactBootstrap.FormControl);
const InputGroup = createFactory(ReactBootstrap.InputGroup);
const OverlayTrigger = createFactory(ReactBootstrap.OverlayTrigger  as
  FunctionComponent<ReactBootstrap.OverlayTriggerProps>);
const Popover = createFactory(ReactBootstrap.Popover);
const Button = createFactory(ReactBootstrap.Button);


export interface Props {
  /** IRI of resource to make minified URL for. */
  iri?: string
}

interface State {
  isLoading?: boolean
  showLink?: boolean
  gotLink?: string
}

/**
 * Allow to create and copy minified URL for page.
 * If target resource IRI is not specified then current URL is used instead.
 *
 * @example
 * <mp-url-minifier iri='[[this]]'>
 *   <button class="btn btn-secondary">Get short URL</button>
 * </mp-url-minifier>
 */
class URLMinifier extends Component<Props, State> {
  constructor(props: Props, context: any) {
    super(props, context);
    this.state = {
      isLoading: false,
      showLink: false,
      gotLink: undefined,
    };
  }

  private generateTargetURL(): Kefir.Property<string> {
    if (typeof this.props.iri === 'string') {
      return URLMinifierService.getShortURLForResource(
        Rdf.iri(this.props.iri), this.context.semanticContext.repository
      );
    } else {
      return URLMinifierService.makeShortURL(uri().toString());
    }
  }

  onClick = () => {
    if (this.state.showLink) {
      this.setState({showLink: false});
    } else {
      this.generateTargetURL().onValue(url => {
        this.setState({
          isLoading: false,
          showLink: true,
          gotLink: url,
        });
      }).onError(() => {
        this.setState({
          isLoading: false,
          showLink: false,
          gotLink: undefined,
        });
      });
    }
  }

  shouldComponentUpdate(nextProps: Props, nextState: State) {
    if (!this.state.showLink && nextState.showLink) {
      (this.refs['trigger'] as any).show();
    } else if (this.state.showLink && !nextState.showLink) {
      (this.refs['trigger'] as any).hide();
    }
    return true;
  }

  render(): ReactElement<any> {
    const child = Children.only(this.props.children) as ReactElement<any>;
    return OverlayTrigger({
      trigger: [],
      placement: 'bottom',
      rootClose: true,
      onExit: () => {
        this.setState({ showLink: false });
      },
      overlay: () => Popover({ id: 'url-minifier' },
        InputGroup({},
          FormControl({ type: 'text', className: 'input-sm', value: this.state.gotLink, readOnly: true }),
          D.span({ className: 'input-group-btn' },
            createElement(CopyToClipboard,
              { text: this.state.showLink ? this.state.gotLink : '' },
              Button({ size: 'sm' }, D.i({ className: 'fa fa-copy' }))
            )
          )
        )
      ),
      children: cloneElement(child, assign({ ref: 'trigger' }, child.props, {
        disabled: this.state.isLoading,
        onClick: this.onClick,
      }))
    });
  }
}

export type component = URLMinifier;
export const component = URLMinifier;
export const factory = createFactory(URLMinifier);
export default component;
