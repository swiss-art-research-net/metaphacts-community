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
import { InputHTMLAttributes, CSSProperties, Children } from 'react';
import * as classnames from 'classnames';

import './clearable-input.scss';

export interface ClearableInputProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string;
  style?: CSSProperties;
  inputClassName?: string;
  inputStyle?: CSSProperties;
  clearTitle?: string;
  onClear: () => void;
}

interface State {
  readonly focused?: boolean;
}

const CLASS_NAME = 'clearable-input';

export class ClearableInput extends React.Component<ClearableInputProps, State> {
  static defaultProps: Required<Pick<ClearableInputProps, 'clearTitle'>> = {
    clearTitle: 'Clear input',
  };

  private input: HTMLInputElement;

  constructor(props: ClearableInputProps, context: any) {
    super(props, context);
    this.state = {focused: false};
  }

  render() {
    const {
      className, style, inputClassName, inputStyle, onClear, clearTitle, children,
      ...inputProps
    } = this.props;

    const hasNonEmptyAddon = Children.count(children) > 0;

    const groupClass = classnames(
      `${CLASS_NAME} input-group has-feedback`,
      this.state.focused ? `${CLASS_NAME}--focused` : undefined,
      className
    );
    const controlClass = classnames(
      `${CLASS_NAME}__input form-control`,
      inputClassName,
    );

    return <div className={groupClass} style={style} onClick={this.onClickSelf}>
      {hasNonEmptyAddon ? children : null}
      <div className={`${CLASS_NAME}__input-with-clear`}>
        <input type='text' {...inputProps}
          ref={this.onInputMount}
          className={controlClass}
          style={inputStyle}
          placeholder={hasNonEmptyAddon ? undefined : inputProps.placeholder}
          onFocus={this.onFocus}
          onBlur={this.onBlur}
        />
        <div className={`${CLASS_NAME}__clear`}
          title={clearTitle} onClick={onClear}>
          <span className='fa fa-times' aria-hidden='true'></span>
        </div>
      </div>
    </div>;
  }

  private onInputMount = (input: HTMLInputElement) => {
    this.input = input;
  }

  private onClickSelf = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.currentTarget === e.target && this.input) {
      this.input.focus();
    }
  }

  private onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    this.setState({focused: true});
    const {onFocus} = this.props;
    if (onFocus) {
      onFocus(e);
    }
  }

  private onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    this.setState({focused: false});
    const {onBlur} = this.props;
    if (onBlur) {
      onBlur(e);
    }
  }
}
