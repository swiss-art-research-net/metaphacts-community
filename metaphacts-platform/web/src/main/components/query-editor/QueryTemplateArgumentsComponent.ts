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
import { Component, createFactory, createElement, FunctionComponent } from 'react';
import * as D from 'react-dom-factories';
import * as ReactBootstrap from 'react-bootstrap';

import { getOverlaySystem, OverlayDialog } from 'platform/components/ui/overlay';

import { Argument, CheckedArgument } from './QueryTemplateTypes';
import { QueryTemplateEditArgument } from './QueryTemplateEditArgument';

const Card = createFactory(ReactBootstrap.Card);
const CardHeader = createFactory(ReactBootstrap.Card.Header);
const CardBody = createFactory(ReactBootstrap.Card.Body);
const Accordion = createFactory(ReactBootstrap.Accordion);
const AccordionToggle = createFactory(ReactBootstrap.Accordion.Toggle);
const AccordionCollapse = createFactory(ReactBootstrap.Accordion.Collapse);
const FormGroup = createFactory(ReactBootstrap.FormGroup);
const FormLabel = createFactory(ReactBootstrap.FormLabel as FunctionComponent);
const Button = createFactory(ReactBootstrap.Button);
const ButtonToolbar = createFactory(ReactBootstrap.ButtonToolbar);

export interface Props {
  args: ReadonlyArray<CheckedArgument>;
  variables: string[];
  onAdd: (arg: CheckedArgument) => void;
  onDelete: (index: number) => void;
  onChange: (arg: CheckedArgument, index: number) => void;
}

export interface State {
  activeKey?: number;
}

export class QueryTemplateArgumentsComponent extends Component<Props, State> {

  constructor(props: Props) {
    super(props);

    this.state = {
      activeKey: 0,
    };
  }

  private handleAddNewArgument = () => {
    const emptyArgument = {
      label: '',
      variable: '',
      comment: '',
      optional: false,
      valueType: '',
    };

    this.setState({activeKey: this.props.args.length}, () => {
      this.props.onAdd({argument: emptyArgument, valid: false});
    });
  }

  private handleDeleteArgument = (index: number) => {
    const title = 'Delete Argument';
    const body = D.div({style: {textAlign: 'center'}},
      D.h5({style: {margin: '0 0 20px'}}, 'Are You Sure?'),
      ButtonToolbar({style: {display: 'inline-block'}} as ReactBootstrap.ButtonToolbarProps,
        Button({variant: 'success', onClick: () => {
          getOverlaySystem().hide(title);

          this.props.onDelete(index);
        }}, 'Yes'),
        Button({variant: 'danger', onClick: () => getOverlaySystem().hide(title)}, 'No')
      )
    );

    getOverlaySystem().show(
      title,
      createElement(OverlayDialog, {
        show: true,
        title: title,
        bsSize: 'sm',
        onHide: () => getOverlaySystem().hide(title),
        children: body,
      })
    );
  }

  private handleChangeArgument = (arg: Argument, index: number, isValid: boolean) => {
    this.props.onChange({argument: arg, valid: isValid}, index);
  }

  private renderArgument = (argument: Argument, index: number, isValid: boolean) => {
    const {args, variables} = this.props;

    const filteredArgs = args.filter((arg, i) => {
      return i !== index;
    });

    const notAvailableLabels = filteredArgs.map(arg => {
      return arg.argument.label;
    });

    const notAvailableVariables = filteredArgs.map(arg => {
      return arg.argument.variable;
    });

    return Accordion({
      key: index,
      onSelect: (key: any) => this.setState({ activeKey: key }),
    }, Card({
      border: isValid ? 'default' : 'danger',
    },
      CardHeader({},
        AccordionToggle({
          as: ReactBootstrap.Button,
          variant: 'link',
          eventKey: '' + index
        } as ReactBootstrap.AccordionToggleProps,
          argument.label.length ? argument.label : 'No Label')
      ),
      AccordionCollapse({ eventKey: '' + index } as ReactBootstrap.AccordionCollapseProps,
        CardBody({}, createElement(QueryTemplateEditArgument, {
          argument,
          variables,
          notAvailableLabels,
          notAvailableVariables,
          onDelete: () => {
            this.handleDeleteArgument(index);
          },
          onChange: (arg, flag) => {
            this.handleChangeArgument(arg, index, flag);
          },
        }))
      )
    ));
  }

  render() {
    const {activeKey} = this.state;

    return FormGroup({style: { width: '50%'}} as ReactBootstrap.FormGroupProps,
      FormLabel({}, 'Arguments'),
      Card({body: true, bg: 'light'},
        this.props.args.length
          ? Accordion({activeKey: '' + activeKey},
            this.props.args.map((item, index) => {
              return this.renderArgument(item.argument, index, item.valid);
            })
          )
          : null,
        Button({size: 'sm', onClick: this.handleAddNewArgument}, 'Add New Argument')
      )
    );
  }
}

export default QueryTemplateArgumentsComponent;
