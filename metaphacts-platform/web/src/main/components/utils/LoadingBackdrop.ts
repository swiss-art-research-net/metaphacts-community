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
import { Component, createElement } from 'react';
import * as D from 'react-dom-factories';

import { Spinner } from 'platform/components/ui/spinner';

interface State {
  showBackdrop: boolean
}

/**
 * Covers the full screen with an overlay. Useful when one need to prevent user
 * form clicking while something is in progress.
 *
 * Element is adaptable and is shown only in 0.5 seconds to avoid annoying flickering
 * if some action takes less then that.
 */
export class LoadingBackdrop extends Component<{}, State> {

  private showBackdropTimeout: ReturnType<typeof setTimeout>;

  constructor(props: {}) {
    super(props);
    this.state = {
      showBackdrop: false,
    };
  }

  componentDidMount() {
    this.showBackdropTimeout =
      setTimeout(
        () => this.setState({showBackdrop: true}), 500
      );
  }

  componentWillUnmount() {
    clearTimeout(this.showBackdropTimeout);
  }

  render() {
    return this.state.showBackdrop ?
      D.div(
        {className: 'modal-backdrop show'},
        createElement(Spinner)
      ) : D.div({}) ;
  }
}
