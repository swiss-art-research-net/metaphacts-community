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
import * as CopyToClipboard from 'react-copy-to-clipboard';
import { Button, ButtonGroup } from 'react-bootstrap';

import { Component, ComponentProps } from 'platform/api/components';

import { CodeHighlightComponent, CodeHighlightConfig } from './CodeHighlight';
import * as styles from './CodeBlock.scss';

/**
 * Component for code block highlight with optional copy to clipboard button
 * and execute query button for sparql queries.
 *
 * **Example**:
 * ```
 * <mp-code-block data-mode="application/typescript">const x = 5</mp-code-block>
 * ```
 */
interface CodeBlockConfig extends CodeHighlightConfig {
  showCopyButton?: boolean;
  showRunQueryButton?: boolean;
}

export interface CodeBlockProps extends CodeBlockConfig, ComponentProps {
  // provided by template markup parser, see Registry.ts
  codeText: string;
}

const MODE_TEXT: { [mimeType: string]: string | undefined } = {
  'text/html': 'HTML',
  'application/sparql-query': 'SPARQL',
  'text/x-java': 'Java',
  'text/typescript': 'TypeScript',
  'text/javascript': 'JavaScript',
  'text/turtle': 'RDF/Turtle',
  'application/n-triples': 'RDF/N-Triples',
  'application/n-quads': 'RDF/N-Quads',
  'application/json': 'JSON',
  'application/ld+json': 'JSON-LD',
  'text/x-sh': 'Shell',
  'application/xml': 'XML',
};


export class CodeBlock extends Component<CodeBlockProps, {}> {
  static defaultProps = {
    mode: 'text/html',
    showCopyButton: true,
    showRunQueryButton: true,
  };

  render() {
    const { mode, showCopyButton, codeText } = this.props;
    return <div className={styles.holder}>
      <div className={styles.modeLabel}>{this.getCodeModeText(mode)}</div>
      <pre>
        <CodeHighlightComponent mode={mode} codeText={codeText} />
      </pre>
      <ButtonGroup>
        {this.copyButton(codeText, showCopyButton)}
        {this.showRunQueryButton(codeText)}
      </ButtonGroup>
    </div>;
  }

  private copyButton = (text: string, showCopyButton: boolean) => {
    if (showCopyButton) {
      return <CopyToClipboard text={text}>
        <Button variant='primary'>Copy to Clipboard</Button>
      </CopyToClipboard>;
    } else {
      return null;
    }
  }

  private showRunQueryButton = (text: string) => {
    const { mode, showRunQueryButton } = this.props;
    const {repository} = this.context.semanticContext;
    if (mode === 'application/sparql-query' && showRunQueryButton) {
      const url = `/sparql?query=${encodeURIComponent(text)}&repository=${repository}`;
      return <a style={{marginLeft: 10}}
                target='_blank' href={url}
                className='btn btn-primary run-query-button'>Run Query</a>;
    } else {
      return null;
    }
  }

  private getCodeModeText = (mode: string) => MODE_TEXT[mode] || mode;
}
export default CodeBlock;
