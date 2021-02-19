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
import * as React from 'react';
import { findDOMNode } from 'react-dom';
import { Overlay, Popover } from 'react-bootstrap';

export interface TargetedPopoverProps {
  id: string;
  reference?: HTMLElement;
  targetLeft: number;
  targetTop: number;
  popoverSide: 'left' | 'right' | 'top' | 'bottom';
  arrowAlignment: 'start' | 'center' | 'end';
  arrowOffset?: number;
  onHide?: () => void;
  hideTimeout?: number;
}

interface State {
  contentSize?: { width: number; height: number };
}

export class TargetedPopover extends React.Component<TargetedPopoverProps, State> {
  static defaultProps: Required<Pick<TargetedPopoverProps, 'arrowOffset' | 'hideTimeout'>> = {
    arrowOffset: 15,
    hideTimeout: 2000,
  };

  private popover: HTMLDivElement | undefined;
  private observer: MutationObserver | undefined;

  private hovering = false;
  private showTimeout: any;

  constructor(props: TargetedPopoverProps) {
    super(props);
    this.state = {};
  }

  render() {
    const {
      id, reference, targetLeft, targetTop, popoverSide, arrowAlignment, arrowOffset, children
    } = this.props;
    const {contentSize} = this.state;

    let positionLeft = targetLeft;
    let positionTop = targetTop;
    let arrowOffsetLeft: number | undefined;
    let arrowOffsetTop: number | undefined;

    const targetReference = reference ?? document.documentElement;
    const virtualTarget = this.createVirtualTarget(targetReference, positionLeft, positionTop);

    return (
      <Overlay target={virtualTarget as any} show={true} placement={popoverSide}>
        <Popover ref={this.onPopoverMount}
          id={id}
          style={{ whiteSpace: 'nowrap', maxWidth: 'unset' }}
          onMouseEnter={this.onMouseEnter}
          onMouseLeave={this.onMouseLeave}>
          <div ref={this.onObservedChildMount}>
            {children}
          </div>
        </Popover>
      </Overlay>
    );
  }
  private onPopoverMount = (popover: HTMLDivElement | undefined) => {
    this.popover = popover;
    this.onPotentialSizeChange();
  }

  private onObservedChildMount = (target: HTMLElement | undefined) => {
    if (this.observer) {
      this.observer.disconnect();
    }

    if (target) {
      this.observer = new MutationObserver(this.onPotentialSizeChange);
      this.observer.observe(
        target, {subtree: true, attributes: true, childList: true, characterData: true}
      );
      this.onPotentialSizeChange();
    }
  }

  private onPotentialSizeChange = () => {
    const target = this.popover
      ? findDOMNode(this.popover) as HTMLElement | undefined : undefined;
    if (target) {
      const width = target.offsetWidth;
      const height = target.offsetHeight;
      this.setState(({contentSize}): State => {
        if (!(contentSize && width === contentSize.width && height === contentSize.height)) {
          return {contentSize: {width, height}};
        }
        return null;
      });
    }
  }

  private createVirtualTarget(reference: HTMLElement, left: number, top: number) {
    return {
      getBoundingClientRect: () => {
        const bbox = reference.getBoundingClientRect();
        return {
          width: 0,
          height: 0,
          get top() { return bbox.top + top; },
          get bottom() { return bbox.top + top; },
          get left() { return bbox.left + left; },
          get right() { return bbox.left + left; },
        }
      },
      // setting a nodeType because react-bootstrap is checking for this
      nodeType: 'virtual',
    };
  }

  componentDidMount() {
    this.restartTimeout();
  }

  componentDidUpdate(prevProps: TargetedPopoverProps) {
    if (Boolean(this.props.onHide) !== Boolean(prevProps.onHide)) {
      this.restartTimeout();
    }
  }

  componentWillUnmount() {
    this.clearTimeout();
  }

  private onMouseEnter = () => {
    this.hovering = true;
    this.restartTimeout();
  }

  private onMouseLeave = () => {
    this.hovering = false;
    this.restartTimeout();
  }

  private restartTimeout() {
    this.clearTimeout();
    if (this.props.onHide && !this.hovering) {
      this.showTimeout = setTimeout(this.onHideByTimeout, this.props.hideTimeout);
    }
  }

  private clearTimeout() {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
      this.showTimeout = undefined;
    }
  }

  private onHideByTimeout = () => {
    const {onHide} = this.props;
    if (onHide && !this.hovering) {
      onHide();
    }
  }
}

export function choosePopoverSide(
  targetX: number, targetY: number, areaWidth: number, areaHeight: number
): Pick<TargetedPopoverProps, 'popoverSide' | 'arrowAlignment'> {
  const x = targetX / areaWidth;
  const y = targetY / areaHeight;

  const topOrRight = y > x;
  const topOrLeft = y > (1 - x);
  const popoverSide = topOrRight
    ? (topOrLeft ? 'top' : 'right')
    : (topOrLeft ? 'left' : 'bottom');

  let arrowAlignment: TargetedPopoverProps['arrowAlignment'] = 'center';
  if (popoverSide === 'top' || popoverSide === 'bottom') {
    if (x < 0.1) {
      arrowAlignment = 'start';
    } else if (x > 0.9) {
      arrowAlignment = 'end';
    }
  }

  return {popoverSide, arrowAlignment};
}
