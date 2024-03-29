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
  Props as ReactProps, Component, ReactElement, createFactory,
  Children, cloneElement, SFC,
} from 'react';
import * as ReactBootstrap from 'react-bootstrap';
import * as assign from 'object-assign';
import * as _ from 'lodash';
import * as block from 'bem-cn';
import * as classNames from 'classnames';

import { componentHasType } from 'platform/components/utils';

import { OverlayDialogTrigger } from './OverlayDialogTrigger';
import { OverlayDialogContent } from './OverlayDialogContent';
import { getOverlaySystem } from './OverlaySystem';

const Modal = createFactory(ReactBootstrap.Modal);
const ModalHeader = createFactory(ReactBootstrap.Modal.Header);
const ModalTitle = createFactory(ReactBootstrap.Modal.Title);
const ModalBody = createFactory(ReactBootstrap.Modal.Body);

import './overlay-dialog.scss';

// These props are delegates of OverlayProps
export interface OverlayDialogProps extends ReactBootstrap.ModalDialogProps {
  onHide: () => void;
  title?: string;
  type?: string;
  className?: string;
  show?: boolean;
  bsSize?: 'lg' | 'large' | 'sm' | 'small';
  enforceFocus?: boolean;
}

export const OverlayDialog: SFC<OverlayDialogProps> = (props: OverlayDialogProps) => {
    // if type is not set or incorrect we will default silently to modal
  const type = props.type && (
    props.type === 'modal' || props.type === 'lightbox'
  ) ? props.type : 'modal';
    // use provided classname or choose on type
    const className = props.className ? props.className :
      (type === 'lightbox' ? 'overlay-lightbox' : 'overlay-modal');

    const b = block(className);

    return Modal(
        assign(
          {}, props,
          // we don't want to have backdrop for lightbox
          {onHide: props.onHide, backdrop: type === 'modal' ? 'static' : false,
           className: b('').toString(),
           dialogClassName: classNames('modal-dialog', b('dialog').toString()),
           size: (props.type === 'modal' || props.type === undefined) && props.bsSize
             ? getModalSize(props.bsSize) : null}),
        props.title ? ModalHeader(
          {closeButton: true, className: b('header').toString()},
          ModalTitle({}, props.title)
        ) : null,
        ModalBody(
          {
            className: b('body').toString(),
          },
          props.children
        )
    );
  };

/**
 * Component that displays it's contents in page-wide lightbox or overlay.
 *
 * **Example**:
 * ```
 * <overlay-dialog title='Title here' type='modal'>
 *   <overlay-trigger>
 *     <button class='btn btn-primary'>Open in modal</button>
 *   </overlay-trigger>
 *   <overlay-content>
 *     Content here
 *   </overlay-content>
 * </overlay-dialog>
 * ```
 */
interface OverlayComponentConfig {
  /** Title to render */
  title: string;
  /**
   * Overlay type:
   *   - `lightbox` will span over all space;
   *   - `modal` modal dialog with customizable size using `bs-size`;
   *
   * @default "modal"
   */
  type?: 'lightbox' | 'modal';
  /**
   * What dialog css class to use.
   *
   * Defaults to `overlay-modal` when `type='modal'` and
   * `overlay-lightbox` when `type=lightbox`.
   */
  className?: string;
  /**
   * Size of dialog; used only when `type='modal'`.
   *
   * Default width of the dialog is `600px`.
   *
   * Width is `900px` when `bsSize` is equal to `lg` or `large`
   * and `300px` when `bsSize` is equal to `sm` or `small`.
   */
  bsSize?: 'lg' | 'large' | 'sm' | 'small';
  /**
   * Whether to enforce focus to stay within the dialog.
   *
   * @default true
   */
  enforceFocus?: boolean;
}

export type OverlayComponentProps = OverlayComponentConfig;

export class OverlayComponent extends Component<OverlayComponentProps, {}> {
  render() {
    // 1. find anchor child and body child
    let children = Children.toArray(this.props.children);
    const anchorComponent =
      _.find(children,  child => componentHasType(child, OverlayDialogTrigger));
    const bodyComponent =
      _.find(children,  child => componentHasType(child, OverlayDialogContent));

    const anchorChild = (Children.only(anchorComponent) as ReactElement<any>).props.children;
    const bodyChild = (Children.only(bodyComponent) as ReactElement<any>).props.children;
    // use childs to create anchor and body
    const props = {
      onClick: (event: React.SyntheticEvent<any>) => {
        event.preventDefault();
        getOverlaySystem().show(
          this.props.title,
          OverlayDialog({
            show: true,
            title: this.props.title,
            type: this.props.type,
            className: this.props.className,
            onHide: () => getOverlaySystem().hide(this.props.title),
            children: bodyChild,
            bsSize: getModalSize(this.props.bsSize),
            enforceFocus: this.props.enforceFocus,
          })
        );
      },
    };
    return cloneElement(anchorChild, props);
  }
}

const getModalSize = (size: string): 'sm' | 'lg' => {
  switch (size) {
    case 'small':
    case 'sm':
      return 'sm';
    case 'large':
    case 'lg':
      return 'lg';
    default:
      return size as any;
  }
};


export default OverlayComponent;
