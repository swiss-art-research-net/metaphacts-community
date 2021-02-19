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
import { Component, CSSProperties } from 'react';
import * as classnames from 'classnames';

import { isValidChild } from 'platform/components/utils';

import { Ordering } from './Ordering';

import * as styles from './ReorderableList.scss';

interface Props {
  ordering?: Ordering;
  onOrderChanged?: (ordering: Ordering) => void;
  /**
   * Reorder items only by dragging by handle, which allows mouse events
   * to pass through.
   */
  dragByHandle?: boolean;
  className?: string;
  itemClass?: string;
  itemBodyClass?: string;
  style?: CSSProperties;
}

interface State {
  readonly ordering?: Ordering;
  readonly draggingIndex?: number;
}

export class ReorderableList extends Component<Props, State> {
  private isDragging = false;
  private lastHoverIndex: number;

  constructor(props: Props) {
    super(props);
    this.state = {
      ordering: (this.props.ordering || Ordering.empty).setSize(
        React.Children.count(this.props.children)),
    };
  }

  render() {
    const {className, style, children, dragByHandle} = this.props;
    const positionToIndex = this.state.ordering.getPositionToIndex();
    const items = React.Children.toArray(children);
    const classes = {
      [styles.component]: true,
      [styles.dragging]: typeof this.state.draggingIndex === 'number',
      [styles.dragByHandle]: dragByHandle,
      [styles.dragWhole]: !dragByHandle,
    };
    return (
      <div className={classnames(className, classes)} style={style}>
        {positionToIndex.map((index, position) => this.renderItem(items[index], index))}
      </div>
    );
  }

  renderItem(item: React.ReactNode, index: number) {
    const {dragByHandle, itemClass, itemBodyClass} = this.props;
    const {draggingIndex} = this.state;
    return (
      <div key={getChildKey(item)}
        className={classnames(styles.item, itemClass)}
        data-dragged={index === draggingIndex ? true : undefined}
        draggable={!dragByHandle}
        onDragStart={e => {
          // required to perform d'n'd operation in Firefox
          e.dataTransfer.setData('mp-reorderable-list-item', '');
        }}
        onDrag={e => this.onDrag(index, e)}
        onDragEnd={e => this.onDragEnd()}
        onDragOver={e => e.preventDefault()}
        onDragEnter={e => this.onDragEnterTarget(index, e)}
        onDragLeave={e => this.onDragLeaveTarget(index)}
        onDrop={e => this.onDropAtTarget(index, e)}>
        <div className={styles.itemHandle} draggable={dragByHandle}></div>
        <div className={classnames(styles.itemBody, itemBodyClass)}>
          {item}
        </div>
      </div>
    );
  }

  componentWillReceiveProps(nextProps: Props & React.Props<any>) {
    const ordering = (nextProps.ordering || this.state.ordering).setSize(
      React.Children.count(nextProps.children));
    this.setState({ordering});
  }

  private onDrag(itemIndex: number, e: React.DragEvent<HTMLDivElement>) {
    if (this.isDragging) { return; }
    e.stopPropagation();
    this.isDragging = true;
    this.setState({draggingIndex: itemIndex});
  }

  private onDragEnd() {
    if (!this.isDragging) { return; }
    this.isDragging = false;

    if (this.props.onOrderChanged && this.state.ordering !== this.props.ordering) {
      this.props.onOrderChanged(this.state.ordering);
    }

    this.setState({draggingIndex: undefined});
  }

  private onDropAtTarget(targetIndex: number, e: React.DragEvent<HTMLDivElement>) {
    if (!this.isDragging) { return; }
    e.preventDefault();
    this.lastHoverIndex = undefined;
    this.setState({draggingIndex: undefined});
  }

  private onDragEnterTarget(itemIndex: number, e: React.DragEvent<HTMLDivElement>) {
    if (!this.isDragging) { return; }
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const {draggingIndex} = this.state;
    if (itemIndex !== this.lastHoverIndex && itemIndex !== draggingIndex) {
      this.lastHoverIndex = itemIndex;
      const {ordering} = this.state;
      const newOrdering = ordering.moveItemFromTo(
        ordering.getPosition(draggingIndex),
        ordering.getPosition(itemIndex));
      this.setState({ordering: newOrdering});
    }
  }

  private onDragLeaveTarget(itemIndex: number) {
    if (!this.isDragging) { return; }
    this.lastHoverIndex = undefined;
  }
}

function getChildKey(child: React.ReactNode): string | number {
  if (typeof child === 'string' || typeof child === 'number') {
    return child;
  } else if (isValidChild(child)) {
    return child.key;
  } else {
    throw new Error('Unexpected child type for ReorderableList');
  }
}

export default ReorderableList;
