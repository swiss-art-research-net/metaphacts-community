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
  CSSProperties,
} from 'react';
import { findDOMNode } from 'react-dom';
import * as classNames from 'classnames';
import * as _ from 'lodash';

import { DRAG_AND_DROP_FORMAT, DRAG_AND_DROP_FORMAT_IE } from './DragAndDropApi';

/**
 * This component takes inner html and makes it automatically draggable.
 * Child element could be any HTML-element (not text node).
 *
 * **Example**:
 * ```
 * <mp-draggable iri="http://collection.britishmuseum.org/id/object/PDB7385">
 *   <div>Content</div>
 * </mp-draggable>
 * ```
 */
interface DraggableConfig {
  /**
   * Resource identifier
   */
  iri: string;
  /**
   * Styles that are added to the component, if it dragged.
   */
  dragStyles?: CSSProperties;
}

export interface DraggableProps extends DraggableConfig {
  /**
   * Callback which fires when component becomes dragged.
   */
  onDragStart?: (iri?: string) => void;
  /**
   * Callback which fires when component stops being dragged.
   */
  onDragEnd?: () => void;
}

interface State {
  isDragged: boolean;
}

export class Draggable extends Component<DraggableProps, State> {
  private source: Element;

  constructor(props: DraggableProps) {
    super(props);
    this.state = {
      isDragged: false,
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

  private setHandlers = (source: any) => {
    type DragListener = (e: Event) => void;
    if (source) {
      this.source = findDOMNode(source) as Element;

      this.source.addEventListener('dragstart', this.onDragStart as unknown as DragListener);
      this.source.addEventListener('dragend', this.onDragEnd as unknown as DragListener);
    } else if (this.source) {
      this.source.removeEventListener('dragstart', this.onDragStart as unknown as DragListener);
      this.source.removeEventListener('dragend', this.onDragEnd as unknown as DragListener);
    }
  }

  private onDragStart = (e: DragEvent) => {
    try {
      e.dataTransfer.setData(DRAG_AND_DROP_FORMAT, this.props.iri);
    } catch (ex) { // IE fix
    }
    // One can drop into draft-js contenteditable only if some known to browser mime-type is set
    e.dataTransfer.setData(DRAG_AND_DROP_FORMAT_IE, this.props.iri);

    this.setState({isDragged: true});
    if (this.props.onDragStart) {
      this.props.onDragStart(this.props.iri);
    }

    const mpDragStart = new CustomEvent('mp-dragstart', {detail: {iri: this.props.iri}});
    window.dispatchEvent(mpDragStart);
  }

  private onDragEnd = (e: DragEvent) => {
    this.setState({isDragged: false});
    if (this.props.onDragEnd) {
      this.props.onDragEnd();
    }

    const mpDragEnd = new CustomEvent('mp-dragend');
    window.dispatchEvent(mpDragEnd);
  }

  public render() {
    const child = Children.only(this.props.children) as ReactElement<any>;
    const {dragStyles} = this.props;
    const {isDragged} = this.state;

    const style = {};
    _.extend(style, child.props.style || {});
    _.extend(style, isDragged && dragStyles ? dragStyles : {});

    const className = classNames(child.props.className, {
      'mp-draggable-dragged': isDragged,
    });

    return cloneElement(child, {
      ref: this.setHandlers,
      className: className,
      style: style,
      draggable: true,
      onMouseDown: (e: MouseEvent) =>
        e.stopPropagation(),
    });
  }
}

export default Draggable;
