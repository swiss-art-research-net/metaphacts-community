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
import { createFactory, createElement, Component, ReactNode } from 'react';
import * as D from 'react-dom-factories';
import { Row, Col, Button, ColProps } from 'react-bootstrap';
import * as bem from 'bem-cn';

const row = createFactory(Row);
const col = createFactory(Col);

export const CLASS_NAME = 'field-editor';
const block = bem(CLASS_NAME);

interface Props {
  expandOnMount?: boolean;
  expanded: boolean;
  onExpand?: () => void;
  onCollapse?: () => void;
  label: string;
  error?: Error;
  element?: ReactNode;
}

export class FieldEditorRow extends Component<Props, {}> {
  componentDidMount() {
    if (this.props.expandOnMount) {
      this.toggle({expand: true});
    }
  }

  componentWillReceiveProps(nextProps: Props) {
    if (!this.props.expandOnMount && nextProps.expandOnMount) {
      // expand if row becomes non-collapsible
      this.toggle({expand: true});
    }
  }

  render() {
    const {onCollapse, expanded, label, error} = this.props;
    const children = this.props.element || this.props.children;
    const canBeCollapsed = expanded && onCollapse;
    return row(
      {className: block('row').toString()},
      col(
        {md: 3, onClick: () => this.toggle({expand: true})} as ColProps,
        D.span({}, label)
      ),
      col(
        {md: canBeCollapsed ? 8 : 9},
        row({},
          expanded ? col({}, children) : D.i(
            {
              className: block('expand').toString(),
              onClick: () => this.toggle({expand: true}),
            },
            `Click to add an optional ${label}.`
          ),
        ),
        error
          ? row({className: block('error').toString()}, error.message)
          : null,
      ),
      col({md: 1, style: {display: canBeCollapsed ? undefined : 'none'}} as ColProps,
        createElement(Button,
          {
            className: block('collapse').toString(),
            size: 'sm',
            variant: 'secondary',
            onClick: () => this.toggle({expand: false}),
          },
          D.span({className: 'fa fa-times'})
        )
      ),
    );
  }

  private toggle = ({expand}: { expand: boolean }) => {
    if (this.props.expanded === expand) {
      return;
    }

    if (expand && this.props.onExpand) {
      this.props.onExpand();
    } else if (!expand && this.props.onCollapse) {
      this.props.onCollapse();
    }
  }
}

export default createFactory(FieldEditorRow);
