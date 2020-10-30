/*
 * Copyright (C) 2015-2020, © Trustees of the British Museum
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
// @flow
import * as React from 'react';
import { Component } from 'react';
import { shouldPureComponentUpdate } from 'ory-editor-core/lib/helper/shouldComponentUpdate';
import { DragSource as dragSource } from 'react-dnd';
import { source, collect } from './DraggableHelper';
import * as classNames from 'classnames';
import { connect } from 'react-redux';
import { clearHover } from 'ory-editor-core/lib/actions/cell/drag';
import {
  insertMode,
  editMode,
  layoutMode
} from 'ory-editor-core/lib/actions/display';

const instances: { [key: string]: any } = {};

class Draggable extends Component<{}, {}> {
  componentDidMount() {
    const img = new Image();
    img.onload = () => this.props.connectDragPreview(img);
    img.src =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAhCAYAAACbffiEAAAA6UlEQVRYhe2ZQQ6CMBBFX0njHg7ESXTp1p3uvIBewc3Em3AfdelSFwRDCAm01JRO+pa0lP8zzc9kMCKyAa7AFqhIixdwB44WuACHuHq8KWm1vwtgF1lMCPaWkevUNE3Qr9R17XTu1P5uvUdV+IpbG2qMGBH5xBYRAjUVUWPEjj10SS3XRFry3kha/VBTETVGcmqtDTVGFqdWn7k9ku96f88QNRVRYySn1tpQY8QptXz7qinmnpt7rZTIqbU21BgJ2mv1+XfCDVFTETVGjIg8SG8KP+RZ0I7lU+dmgRNgaKfyZVw9znT/R85fOHJJE77U6UcAAAAASUVORK5CYII='
  }

  shouldComponentUpdate(nextProps: {}, nextState: {}) {
    return shouldPureComponentUpdate;
  }

  props: {
    connectDragSource<T>(element: T): T,
    connectDragPreview<T>(element: T): T,
    isDragging: boolean,
    children: any,
    className: string,
    insert: any,
    layoutMode(): void
  };

  render() {
    const { connectDragSource, isDragging, children, className } = this.props;
    const classes = classNames(className, 'ory-toolbar-draggable',
      { 'ory-toolbar-draggable-is-dragged': isDragging });

    return connectDragSource(<div className={classes}>{children}</div>);
  }
}

const mapStateToProps: any = null;

const mapDispatchToProps = { insertMode, editMode, layoutMode, clearHover };

export default (dragType: string = 'CELL') => {
  if (!instances[dragType]) {
    instances[dragType] = connect(mapStateToProps, mapDispatchToProps)(
      dragSource(dragType, source, collect)(Draggable as any)
    );
  }

  return instances[dragType];
};
