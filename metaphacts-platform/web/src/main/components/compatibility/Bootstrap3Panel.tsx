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
import { Accordion, Button, Card, CardProps } from 'react-bootstrap';

interface Bootstrap3PanelProps extends CardProps {
  collapsible?: boolean;
  header?: string;
}

export class Bootstrap3Panel extends React.Component<Bootstrap3PanelProps, {}> {
  render() {
    const { header, children, collapsible, ...restProps } = this.props;

    const cardBody = <Card.Body>{children}</Card.Body>;
    const cardComp = <Card {...restProps}>
      {header ? <Card.Header>
        {collapsible ?
          <Accordion.Toggle eventKey='body' as={Button} variant='link'>{header}</Accordion.Toggle>
          : header}
      </Card.Header> : null}
      {collapsible ? <Accordion.Collapse eventKey='body'>{cardBody}</Accordion.Collapse> : cardBody}
    </Card>;

    return collapsible ? <Accordion>{cardComp}</Accordion> : cardComp;
  }
}

export default Bootstrap3Panel;
