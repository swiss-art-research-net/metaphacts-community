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
 * Copyright (C) 2015-2020, metaphacts GmbH
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
/// <reference types="codemirror/codemirror-runmode" />

import { Component, createFactory } from 'react';
import * as D from 'react-dom-factories';
import { findDOMNode } from 'react-dom';

import * as CodeMirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/htmlmixed/htmlmixed';
import 'codemirror/addon/mode/simple';
import 'codemirror/addon/runmode/runmode';
import 'codemirror/addon/mode/multiplex';
import 'codemirror/mode/handlebars/handlebars';
import 'codemirror/mode/xml/xml';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/clike/clike';
import 'codemirror/mode/sparql/sparql';
import 'codemirror/mode/turtle/turtle';
import 'codemirror/mode/shell/shell';

export interface CodeHighlightProps {
  codeText: string;

  /**
   * Supported modes:
   * 'text/html' - HTML
   * 'text/x-java' - Java
   * 'text/typescript' - TypeScript
   * 'text/javascript' - JavaScript
   * 'application/json' - JSON
   * 'application/ld+json' - JSON-LD
   * 'application/sparql-query' - SPARQL
   * 'text/turtle' - Turtle
   * 'application/n-triples' - N-Triples
   * 'application/n-quads' - N-Quads
   * 'text/x-sh' - Shell/Bash
   * 'application/xml' - XML
   *
   * @default text/html
   */
  mode?: string;
}

/**
 * Component for code highlight. In templates it is exposed as a <code> tag.
 *
 * For inline code highlight with default 'html' mode one can just use '<code>' tag:
 * @example
 *   <p>Some text <code><a>Hello World</a></code> </p>
 *
 */
export class CodeHighlightComponent extends Component<CodeHighlightProps, {}> {

  static defaultProps = {
    codeText: '',
    mode: 'text/html',
  };

  componentDidMount() {
    const codeNode = findDOMNode(this) as HTMLElement;
    const options = {tabSize: 2};
    CodeMirror.runMode(this.props.codeText, this.props.mode, codeNode, options);
  }

  render() {
    return D.code({className: 'cm-s-default'});
  }
}

export const CodeHighlight = createFactory(CodeHighlightComponent);
export default CodeHighlight;
