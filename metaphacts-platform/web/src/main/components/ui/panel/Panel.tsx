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
import { ReactElement, ComponentClass, Component, Children } from 'react';
import * as _ from 'lodash';
import { Card } from 'react-bootstrap';

export interface PanelProps {
  className?: string;
}

import { PanelHeader } from './PanelHeader';
import { PanelFooter } from './PanelFooter';
import { PanelBody } from './PanelBody';

/**
 * Wrapper for react-bootstrap Panel component with custom header and footer templates.
 *
 * @example
 *  <mp-panel>
 *    <mp-panel-header>
 *      <div>Title</div>
 *    </mp-panel-header>
 *    <mp-panel-body>
 *      <div>Title</div>
 *    </mp-panel-body>
 *    <mp-panel-footer>
 *      <div>Title</div>
 *    </mp-panel-footer>
 *  </mp-panel>
 */
export class Panel extends Component<PanelProps, {}> {
  render() {
    const children = Children.toArray(this.props.children);
    const header = this.findComponent(children, PanelHeader);
    const body = this.findComponent(children, PanelBody);
    const footer = this.findComponent(children, PanelFooter);

    const { className, ...restProps } = this.props;
    return <Card className={'mb-4 ' + (className ?? '')} {...restProps}>
      {header ? <Card.Header>{header}</Card.Header> : null}
      <Card.Body>{body}</Card.Body>
      {footer ? <Card.Footer>{footer}</Card.Footer> : null}
    </Card>;
  }

  private findComponent =
    (children: Array<React.ReactNode>, component: ComponentClass<any>): ReactElement<any> => {
      const element =
        _.find(
          children, child => (child as React.ReactElement<any>).type === component
        ) as ReactElement<any>;
      return element;
    }
}
export default Panel;
