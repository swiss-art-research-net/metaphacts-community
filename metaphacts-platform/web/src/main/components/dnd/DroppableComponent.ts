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
  Children,
  ReactElement,
  cloneElement,
  createFactory,
  CSSProperties,
  createElement,
  FunctionComponent
} from 'react';
import { findDOMNode } from 'react-dom';
import * as ReactBootstrap from 'react-bootstrap';
import { OverlayChildren } from 'react-bootstrap/esm/Overlay';
import * as classNames from 'classnames';
import * as maybe from 'data.maybe';
import * as _ from 'lodash';

import { Rdf } from 'platform/api/rdf';
import { SparqlClient } from 'platform/api/sparql';
import {
  DroppableContextTypes,
  DroppableContext,
  DRAG_AND_DROP_FORMAT,
  DRAG_AND_DROP_FORMAT_IE,
} from './DragAndDropApi';

const Popover = createFactory(ReactBootstrap.Popover);

// We should use OverlayTrigger as root in render return value
// OverlayTrigger documentation doesn't describe methods to show/hide it
// so we need to call it manually in shouldComponentUpdate through custom interface
interface OverlayTriggerOverride {
  show: () => void
  hide: () => void
}

export interface DroppableProps {
  /**
   * Allows to ignore event when a source being dragged.
   */
  shouldReactToDrag?: (dragged: Rdf.Iri) => boolean;

  /**
   * SPARQL ASK query
   */
  query?: string

  /**
   * Repository to execute ASK query, "default" repository is used by default
   */
  repository?: string;

  /**
   * Callback that called when a source is dropped into the component
   */
  onDrop?: (drop: Rdf.Iri) => void
  /**
   * Styles that are added to the component when it receives the appropriate state.
   */
  dropStyles?: {
    enabled?: CSSProperties
    enabledHover?: CSSProperties
    disabled?: CSSProperties
    disabledHover?: CSSProperties
  }
  /**
   * Components that will be displayed inside Overlay with child element
   */
  dropComponents?: {
    disabledHover?: any
  }
}

interface State {
  iri?: Data.Maybe<Rdf.Iri>;
  isSourceDragged?: boolean;
  isDropEnabledKnown?: boolean;
  isDropEnabled?: boolean;
  isHover?: boolean;
}

/**
 * This component takes inner html and makes it droppable.
 * Child element could be any HTML-element (not text node).
 * When a source has been dragged the component takes source's iri
 * and checks with SPARQL ASK query if it can be accepted or not.
 *
 * CSS classes for child component:
 *  - `mp-droppable-enabled`
 *  - `mp-droppable-disabled`
 *  - `mp-droppable-hover`
 */
export class Droppable extends Component<DroppableProps, State> {
  private target: Element;

  constructor(props: DroppableProps) {
    super(props);
    this.state = {
      iri: maybe.Nothing<Rdf.Iri>(),
      isSourceDragged: false,
      isDropEnabledKnown: false,
      isDropEnabled: false,
      isHover: false,
    };
  }

  static childContextTypes = DroppableContextTypes;

  getChildContext(): DroppableContext {
    return {
      droppableApi: {
        drop: this.state.iri,
      },
    };
  }

  componentWillMount() {
    const {children} = this.props;

    if (typeof children === 'string') {
      throw Error(`The child element couldn't be a text node`);
    }

    if (!children) {
      throw Error(`The child element doesn't exists`);
    }
  }

  private setHandlers = (target: any) => {
    type DragListener = (e: Event) => void;
    const child = Children.only(this.props.children) as ReactElement<any>;
    if (target) {
      this.target = findDOMNode(target) as HTMLElement;

      window.addEventListener('mp-dragstart', this.onDragStart);
      window.addEventListener('mp-dragend', this.onDragEnd as unknown as DragListener);

      this.target.addEventListener('dragenter', this.onDragEnter as unknown as DragListener);
      this.target.addEventListener('dragover', this.onDragOver as unknown as DragListener);
      this.target.addEventListener('dragleave', this.onDragLeave as unknown as DragListener);
      this.target.addEventListener('drop', this.onDrop as unknown as DragListener);
    } else if (this.target) {
      window.removeEventListener('mp-dragstart', this.onDragStart);
      window.removeEventListener('mp-dragend', this.onDragEnd as unknown as DragListener);

      this.target.removeEventListener('dragenter', this.onDragEnter as unknown as DragListener);
      this.target.removeEventListener('dragover', this.onDragOver as unknown as DragListener);
      this.target.removeEventListener('dragleave', this.onDragLeave as unknown as DragListener);
      this.target.removeEventListener('drop', this.onDrop as unknown as DragListener);
      this.target = null;
    }
    // DroppableComponent insert own ref callback in order to set event handlers
    // so we need to call original ref callback
    // string refs are not supported, see ReactRef.attachRef/detachRef if you need
    if ((child as any).ref && typeof (child as any).ref === 'function') {
      (child as any).ref(target);
    }
  }

  private onDragStart = (e: any) => {
    const dragged = Rdf.iri(e.detail.iri);
    if (this.props.shouldReactToDrag && !this.props.shouldReactToDrag(dragged)) {
      return;
    }

    this.setState({isSourceDragged: true});
    if (this.props.query) {
      SparqlClient.prepareQuery(this.props.query, [{'value': dragged}])
        .flatMap(query => SparqlClient.ask(query, {context: {repository: this.props.repository}}))
        .onValue(res => {
          this.setState({isDropEnabledKnown: true, isDropEnabled: res});
        });
    } else {
      this.setState({isDropEnabledKnown: true, isDropEnabled: true});
    }
  }

  private isEventInsideRect(event: DragEvent, target: Element): boolean {
    const rect = target.getBoundingClientRect();
    const dists = [
      event.clientX - rect.left, rect.right - event.clientX,
      event.clientY - rect.top, rect.bottom - event.clientY,
    ];
    return dists[0] > 0 && dists[1] > 0 && dists[2] > 0 && dists[3] > 0;
  }

  private onDragEnter = (e: DragEvent) => {
    if (this.state.isSourceDragged && this.isEventInsideRect(e, this.target)) {
      this.setState({isHover: true});
    }
  }

  private onDragLeave = (e: DragEvent) => {
    if (this.state.isSourceDragged && !this.isEventInsideRect(e, this.target)) {
      this.setState({isHover: false});
    }
  }

  private onDragOver = (e: DragEvent) => {
    if (!this.state.isSourceDragged) { return; }

    if (e.preventDefault) {
      e.preventDefault(); // Necessary. Allows us to drop.
    }

    if (!this.state.isDropEnabled) {
      e.dataTransfer.dropEffect = 'none';
    }

    if (!this.state.isHover && this.isEventInsideRect(e, this.target)) {
      this.setState({isHover: true});
    }

    return false;
  }

  private onDrop = (e: DragEvent) => {
    e.preventDefault();
    if (e.stopPropagation) {
      // Stops some browsers from redirecting.
      e.stopPropagation();
    }

    if (!this.state.isSourceDragged) { return; }

    if (this.state.isDropEnabled) {
      let iriStr: string;

      try {
        iriStr = e.dataTransfer.getData(DRAG_AND_DROP_FORMAT);
      } catch (ex) { // IE fix
        iriStr = e.dataTransfer.getData(DRAG_AND_DROP_FORMAT_IE);
      }

      const iri = maybe.fromNullable(iriStr).map(Rdf.iri);

      this.setState({iri: iri});

      if (this.props.onDrop && !iri.isNothing) {
        this.props.onDrop(iri.get());
      }
    }

    return false;
  }

  private onDragEnd = (e: DragEvent) => {
    this.setState({
      isSourceDragged: false,
      isDropEnabledKnown: false,
      isDropEnabled: false,
      isHover: false,
    });
  }

  public render() {
    const child = Children.only(this.props.children) as ReactElement<any>;
    const {dropStyles} = this.props;
    const {isSourceDragged, isDropEnabledKnown, isDropEnabled, isHover} = this.state;

    const style = {};
    _.extend(style, child.props.style || {});

    if (isDropEnabledKnown && isSourceDragged && dropStyles) {
      const enabledStyle = dropStyles.enabled,
        enabledHoverStyle = dropStyles.enabledHover,
        disabledStyle = dropStyles.disabled,
        disabledHoverStyle = dropStyles.disabledHover;

      _.extend(style, isDropEnabled && enabledStyle ? enabledStyle : {});
      _.extend(style, isDropEnabled && isHover && enabledHoverStyle ? enabledHoverStyle : {});
      _.extend(style, !isDropEnabled && disabledStyle ? disabledStyle : {});
      _.extend(style, !isDropEnabled && isHover && disabledHoverStyle ? disabledHoverStyle : {});
    }

    const className = classNames(child.props.className, {
      'mp-droppable-enabled': isDropEnabledKnown && isSourceDragged && isDropEnabled,
      'mp-droppable-disabled': isDropEnabledKnown && isSourceDragged && !isDropEnabled,
      'mp-droppable-hover': isDropEnabledKnown && isSourceDragged && isHover,
    });


    const result = cloneElement(
      child, {ref: this.setHandlers, key: 'wrapped-component', className: className, style: style}
    );
    if (this.props.dropComponents && this.props.dropComponents.disabledHover) {
      const Trigger = ReactBootstrap.OverlayTrigger as
        FunctionComponent<ReactBootstrap.OverlayTriggerProps>;
      return createElement(Trigger,
        {
          trigger: ['hover', 'focus'],
          placement: 'top',
          overlay: Popover({id: 'help'},
            cloneElement(this.props.dropComponents.disabledHover)
          ) as unknown as OverlayChildren,
          defaultShow: false,
          children: result
        }
      );
    } else {
      return result;
    }
  }
}
