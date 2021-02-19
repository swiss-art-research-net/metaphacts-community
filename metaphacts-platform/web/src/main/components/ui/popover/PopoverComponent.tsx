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
import * as ReactBootstrap from 'react-bootstrap';
import * as _ from 'lodash';

import { componentHasType, isValidChild } from 'platform/components/utils';
import { ErrorNotification } from 'platform/components/ui/notification';

import { PopoverContentComponent, PopoverContentProps } from './PopoverContentComponent';
import { PopoverTriggerComponent, PopoverTriggerProps } from './PopoverTriggerComponent';
import { OverlayInjectedProps } from 'react-bootstrap/esm/Overlay';

/**
 * **Example**:
 * ```
 * <mp-popover title="my popover">
 *   <mp-popover-trigger placement="left"
 *     trigger='["click", "hover", "focus"]'
 *     root-close='false'>
 *     <i class="fa fa-question-circle" aria-hidden="true"></i>
 *   </mp-popover-trigger>
 *   <mp-popover-content>Content</mp-popover-content>
 * </mp-popover>
 * ```
 */
interface PopoverConfig {
  /**
   * Popover title.
   *
   * If empty or `undefined` no title will be visible in the popover.
   */
  title?: string;
}

export type PopoverProps = PopoverConfig;

type PropsWithChildren<P> = P & { children?: React.ReactNode };

export class Popover extends React.Component<PopoverProps, {}> {
  render() {
    const { title, ...restProps } = this.props;

    const children = React.Children.toArray(this.props.children);

    const triggerComponent = children.find(
      (child): child is React.ReactElement<PropsWithChildren<PopoverTriggerProps>> =>
        componentHasType(child, PopoverTriggerComponent)
    );
    const contentComponent = children.find(
      (child): child is React.ReactElement<PropsWithChildren<PopoverContentProps>> =>
        componentHasType(child, PopoverContentComponent)
    );

    if (!(triggerComponent && contentComponent)) {
      const message =
        'Cannot find <mp-popover-trigger> or <mp-popover-content> for <mp-popover> component.';
      return <ErrorNotification errorMessage={message} />;
    }

    const triggerChildren = triggerComponent.props.children;
    const contentChildren = contentComponent.props.children;

    if (!isValidChild(triggerChildren)) {
      return <ErrorNotification errorMessage='Popover trigger is not a valid element.' />;
    }

    const popover = <UpdatingPopover
      title={title}
      contentProps={contentComponent.props}
      {...restProps}>
      {contentChildren}
    </UpdatingPopover>;

    const { trigger, placement, rootClose } = triggerComponent.props;

    return <ReactBootstrap.OverlayTrigger
      overlay={popover}
      trigger={trigger || ['click']}
      placement={placement}
      rootClose={rootClose || true}
      children={triggerChildren}
    ></ReactBootstrap.OverlayTrigger>;
  }
}

interface UpdatingPopoverProps extends OverlayInjectedProps {
  title: string;
  contentProps?: object;
}
const UpdatingPopover = React.forwardRef(
  ({ popper, children, title, contentProps, show: _, ...props }: UpdatingPopoverProps, ref) => {
    const childRef = React.useRef<HTMLDivElement>();
    React.useEffect(() => {
      if (childRef.current == null) {
        return undefined;
      }

      const observer = new MutationObserver(() => {
        popper.scheduleUpdate();
      });
      observer.observe(childRef.current, { attributes: true, childList: true, subtree: true });

      return () => {
        observer.disconnect();
      };
    }, [childRef.current, popper]);

    return <ReactBootstrap.Popover ref={ref} id='mp-popover' {...props}>
      {title != null ? <ReactBootstrap.PopoverTitle key='title'>
        {title}
      </ReactBootstrap.PopoverTitle> : null}
      <ReactBootstrap.PopoverContent key='content' ref={childRef} {...contentProps}>
        {children}
      </ReactBootstrap.PopoverContent>
    </ReactBootstrap.Popover>;
  },
);

export default Popover;
