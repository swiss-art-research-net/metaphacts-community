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
import { Tab, Tabs } from 'react-bootstrap';
import * as Maybe from 'data.maybe';

import { ModuleRegistry } from 'platform/api/module-loader';
import { Spinner } from 'platform/components/ui/spinner';

import { CodeBlock } from './CodeBlock';
import * as styles from './CodeExample.scss';

/**
 * Component which can be used to create interactive HTML snippets.
 * With code highlight and copy to clipboard option.
 *
 * **Example**:
 * ```
 * <mp-code-example>
 * <semantic-table>...</semantic-table>
 * </mp-code-example>
 * ```
 */
interface CodeExampleConfig {
  showCodeByDefault?: boolean;
  showCopyButton?: boolean;
}

export interface CodeExampleProps extends CodeExampleConfig {
  // provided by template markup parser, see Registry.ts
  codeText: string;
}

interface State {
  renderedCode?: Data.Maybe<React.ReactNode>;
}

export class CodeExample extends React.Component<CodeExampleProps, State> {
  static defaultProps = {
    showCodeByDefault: false,
    showCopyButton: true,
  };

  constructor(props: CodeExampleProps) {
    super(props);

    this.state = {
      renderedCode: Maybe.Nothing<React.ReactNode>(),
    };
  }

  componentDidMount() {
    this.loadCode(this.props.codeText);
  }

  componentWillReceiveProps(props: CodeExampleProps) {
    if (props.codeText !== this.props.codeText) {
      this.loadCode(props.codeText);
    }
  }

  private loadCode(codeText: string) {
    ModuleRegistry.parseHtmlToReact(codeText).observe({
      value: components => this.setState({renderedCode: Maybe.Just(components)})
    });
  }

  render() {
    const { codeText, showCopyButton } = this.props;
    return <div className={styles.holder}>
      <Tabs defaultActiveKey={this.props.showCodeByDefault ? 1 : 2} unmountOnExit={true}>
        <Tab eventKey='1' title='Code'>
          <CodeBlock codeText={codeText} showCopyButton={showCopyButton}/>
        </Tab>
        <Tab eventKey='2' title='Result'>
          {this.state.renderedCode.getOrElse(<Spinner/>)}
        </Tab>
      </Tabs>
    </div>;
  }
}

export default CodeExample;
