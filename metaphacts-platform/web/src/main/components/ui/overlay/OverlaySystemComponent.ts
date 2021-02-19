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
import { Props as ReactProps, Component, ReactElement, cloneElement, createElement } from 'react';
import * as D from 'react-dom-factories';
import { OrderedMap } from 'immutable';
import * as Maybe from 'data.maybe';

import { SemanticContext, SemanticContextProvider } from 'platform/api/components';
import { BuiltInEvents, listen } from 'platform/api/events';

interface Props extends ReactProps<OverlaySystem> {

}

interface StateItem {
  element: ReactElement<any>;
  context?: SemanticContext;
}
interface State {
  dialogs: OrderedMap<string, StateItem>;
}

/**
 * This is the holder of temporary top-level component, as dialog or overlay
 * OverlaySystem should be placed high in DOM tree to avoid being detached by react.
 * (now it's done in App.ts)
 *
 * Multiple overlays can be displayed at the same time.
 */
export class OverlaySystem extends Component<Props, State> {
  constructor(props: Props, context: any) {
    super(props, context);

    this.state = {
      dialogs: OrderedMap<string, StateItem>(),
    };
  }

  componentDidMount() {
    listen({
      eventType: BuiltInEvents.DialogHideAll,
    }).observe({
      value: () => this.hideAll()
    });
  }

  render() {
    return D.div(
      {}, this.state.dialogs
        .map((modal, key) => {
          const semanticContext =
            Maybe.fromNullable(modal.context).map(c => c.semanticContext).getOrElse({});
          const {repository, bindings} = semanticContext;
          return createElement(
            SemanticContextProvider,
            {key, repository, bindings},
            modal.element
          );
        })
        .toArray());
  }

  public show = (key: string, dialog: ReactElement<any>, context?: SemanticContext) => {
    this.setState({
      dialogs: this.state.dialogs.set(key, {element: dialog, context}),
    });
  }

  public hide = (key: string) => {
    this.setState({
      dialogs: this.state.dialogs.remove(key),
    });
  }

  public hideAll = () => {
    this.setState({
      dialogs: this.state.dialogs.clear(),
    });
  }
}

export default OverlaySystem;
