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
import { createElement } from 'react';
import * as Kefir from 'kefir';
import * as assign from 'object-assign';

import { Component } from 'platform/api/components';
import { ErrorNotification } from 'platform/components/ui/notification';
import Spinner from '../ui/spinner/Spinner';

export interface StateBase {
  loading?: boolean;
  error?: any;
}

export abstract class KefirComponentBase<P, S extends StateBase, Loaded>
  extends Component<P, S & Loaded> {

  protected requests: Kefir.Pool<P>;

  constructor(props: P, context?: any) {
    super(props, context);

    this.requests = Kefir.pool<P>();

    this.requests
      .flatMapLatest<Loaded>(request => {
        if (!request) { return Kefir.never<Loaded>(); }
        try {
          const task = this.loadState(request);
          return task ? task : Kefir.never<Loaded>();
        } catch (e) {
          console.error(e);
          return Kefir.constantError<any>(e.message);
        }
      })
      .onValue(state => this.setState(previous =>
        assign({}, previous, {loading: false}, state)))
      .onError(error => this.setState(previous =>
        assign({}, previous, {loading: false, error})));

    this.state = this.updateState({loading: true});
  }

  protected abstract loadState(props: P): Kefir.Stream<Loaded> | undefined;

  protected updateState(partialState: StateBase | S | Loaded): Readonly<S & Loaded> {
    return assign({}, this.state, partialState);
  }

  componentDidMount() {
    this.requests.plug(Kefir.constant(this.props));
  }

  componentWillReceiveProps(nextProps: P) {
    this.requests.plug(Kefir.constant(nextProps));
  }

  componentWillUnmount() {
    this.requests.plug(Kefir.constant(undefined));
  }

  render(): React.ReactElement<any> {
    if (this.state.loading) {
      return Spinner({});
    } else if (this.state.error) {
      return createElement(ErrorNotification, {errorMessage: this.state.error});
    } else {
      return null;
    }
  }
}
