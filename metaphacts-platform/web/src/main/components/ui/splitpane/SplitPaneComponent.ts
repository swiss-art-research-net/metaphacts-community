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
  Component,
  createElement,
  Children,
  ReactNode,
  cloneElement,
  ReactElement,
} from 'react';
import * as SplitPane from 'react-split-pane';
import * as assign from 'object-assign';
import * as _ from 'lodash';

import { Cancellation } from 'platform/api/async/Cancellation';
import { listen } from 'platform/api/events';
import { BrowserPersistence, universalChildren } from 'platform/components/utils';
import { SplitPaneSidebarClosedComponent } from './SplitPaneSidebarClosedComponent';
import { SplitPaneSidebarOpenComponent } from './SplitPaneSidebarOpenComponent';
import { SplitPaneToggleOnComponent } from './SplitPaneToggleOnComponent';
import { SplitPaneToggleOffComponent } from './SplitPaneToggleOffComponent';

import { BaseSplitPaneConfig } from './SplitPaneConfig';
import * as SplitPaneEvents from './SplitPaneEvents';

import './split-pane.scss';

export type SplitPaneProps = BaseSplitPaneConfig<React.CSSProperties>;

export interface State {
  isOpen?: boolean;
  size?: number;
}

type DefaultProps = Required<Pick<SplitPaneProps, 'defaultSize' | 'defaultOpen' | 'navHeight'>>;

const LocalStorageState = BrowserPersistence.adapter<{
  readonly isOpen?: boolean;
  readonly size?: number;
}>();

export class SplitPaneComponent extends Component<SplitPaneProps, State> {
  static readonly defaultProps: DefaultProps = {
    defaultSize: 300,
    defaultOpen: true,
    navHeight: 105, // our default nav + breadcrumbs size
  };
  private readonly cancellation = new Cancellation();

  constructor(props: SplitPaneProps) {
    super(props);

    let isOpen: boolean;
    let size: number;
    if (this.isPersistResize()) {
      const localState = LocalStorageState.get(this.getLSIdentifier());
      isOpen = localState.isOpen;
      size = localState.size;
    }

    this.state = {
      isOpen: isOpen === undefined ? Boolean(this.props.defaultOpen) : isOpen,
      size: size === undefined ? this.props.defaultSize : size,
    };
  }

  componentDidMount() {
    const {id} = this.props;
    this.cancellation.map(
      listen({
        eventType: SplitPaneEvents.Open,
        target: id,
      })
    ).observe({
      value: () => {
        this.setState({isOpen: true});
      }
    });
    this.cancellation.map(
      listen({
        eventType: SplitPaneEvents.Close,
        target: id,
      })
    ).observe({
      value: () => {
        this.setState({isOpen: false});
      }
    });
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  private getLSIdentifier = () => {
    const id = this.props.id;
    return `mp-splitpane${id ? `-${id}` : ``}`;
  }

  private isPersistResize = (): boolean => {
    return this.props.persistResize || this.props.persistResize === undefined;
  }

  private handleOpen = () => {
    let size = this.state.size;

    const hasEnoughSize = size && this.consideredToBeOpened(size);
    if (!this.state.isOpen && !hasEnoughSize) {
      size = this.props.defaultSize;
    }

    this.setState({isOpen: !this.state.isOpen, size}, () => {
      if (this.isPersistResize()) {
        LocalStorageState.update(this.getLSIdentifier(), {
          isOpen: this.state.isOpen,
          size: this.state.size,
        });
      }

      this.triggerWindowResize();
    });
  }

  private handleDrag = (size: number) => {
    const {minSize} = this.props;
    const isOpen = this.consideredToBeOpened(size);

    this.setState({isOpen: isOpen, size: isOpen ? size : minSize}, () => {
      if (this.isPersistResize()) {
        LocalStorageState.update(this.getLSIdentifier(),
          isOpen ? {size, isOpen} : {isOpen});
      }
      this.triggerWindowResize();
    });
  }

  private consideredToBeOpened(size: number) {
    const {minSize, snapThreshold} = this.props;
    return size > minSize + (snapThreshold || 0);
  }

  private mapChildren = (children: ReactNode): ReactNode => {
    const isOpen = this.state.isOpen;

    return universalChildren(
      Children.map(children, child => {
        if (!child) { return null; }

        if (typeof child === 'string') { return child; }
        const element = child as ReactElement<any>;
        const isSidebarClosed = element.type === SplitPaneSidebarClosedComponent;
        const isSidebarOpen = element.type === SplitPaneSidebarOpenComponent;
        const isToggleOn = element.type === SplitPaneToggleOnComponent;
        const isToggleOff = element.type === SplitPaneToggleOffComponent;

        if (isSidebarClosed || isToggleOn) {
          return !isOpen ? cloneElement(element, {onClick: this.handleOpen}) : null;
        } else if (isSidebarOpen || isToggleOff) {
          return isOpen ? cloneElement(element, {onClick: this.handleOpen}) : null;
        }

        if (element.type === SplitPaneComponent) {
          return element;
        }

        return cloneElement(element, {children: this.mapChildren(element.props.children)});
      })
    );
  }

  render() {
    const {minSize, className, resizerClassName, style, sidebarStyle, resizerStyle, split,
           contentStyle, children, primary} = this.props;
    const isOpen = this.state.isOpen;

    const props = {
      minSize: minSize,
      size: isOpen ? this.state.size : minSize,
      onChange: this.handleDrag,
      onDragFinished: this.handleDrag,
      className: className,
      resizerClassName: resizerClassName,
      style: style,
      resizerStyle: resizerStyle,
      pane1Style: sidebarStyle,
      pane2Style: contentStyle,
      split,
      primary,
    };

    let [sidebarChild, contentChild] = children as [ReactElement, ReactElement];
    if (primary === 'second') {
      [sidebarChild, contentChild] = [contentChild, sidebarChild];
    }

    const sidebarChildStyle = assign(
      {},
      sidebarChild.props.style,
      this.props.dock ? {
        position: 'sticky',
        top: this.props.navHeight + 'px',
        height: `calc(100vh - ${this.props.navHeight}px)`,
      } : null
    );

    let firstChild: ReactNode = cloneElement(sidebarChild, {
      style: sidebarChildStyle,
      children: this.mapChildren(sidebarChild.props.children),
    });
    let secondChild: ReactNode = this.mapChildren(contentChild);

    if (primary === 'second') {
      [firstChild, secondChild] = [secondChild, firstChild];
    }

    return createElement(SplitPane, props, firstChild, secondChild);
  }

  /**
   * We need to trigger resize when size of the panel is changed
   * to force components inside the panel to adjust dimensions.
   *
   * e.g charts, or mp-text-truncate, etc.
   */
  private triggerWindowResize = _.debounce(
    () => window.dispatchEvent(new Event('resize')), 200
  );
}

export default SplitPaneComponent;
