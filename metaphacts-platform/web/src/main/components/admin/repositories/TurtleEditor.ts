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

import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/turtle/turtle';

import 'codemirror/addon/fold/foldcode';
import 'codemirror/addon/fold/brace-fold';
import 'codemirror/addon/fold/indent-fold';
import 'codemirror/addon/edit/matchtags';
import 'codemirror/addon/edit/matchbrackets';
import 'codemirror/addon/search/search';
import 'codemirror/addon/search/searchcursor';
import 'codemirror/addon/dialog/dialog';
import 'codemirror/addon/dialog/dialog.css';

import { Controlled as ReactCodeMirror } from 'react-codemirror2';
import type { Editor } from 'codemirror';

interface Props {
 turtleString: string;
 onChange?: (turtle: string) => void;
}

export class TurtleEditorComponent extends React.Component<Props, {source: string}> {
  private instance: Editor;

  constructor(props: Props, context: any) {
    super(props, context);
    this.state = {
      source: props.turtleString ? props.turtleString : '',
    };
  }

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.turtleString !== nextProps.turtleString) {
      this.setState({ source: nextProps.turtleString }, () => {
        if (this.instance) {
          this.instance.refresh();
        }
      });
    }
  }

  componentDidMount() {
    if (this.instance) {
      this.instance.refresh();
    }
  }

  public render() {
    const codeMirrorAddonOptions = {
      foldGutter: false,
      textAreaClassName: ['form-control'],
      matchTags: {bothTags: true},
      matchBrackets: true,
    };
    return React.createElement(ReactCodeMirror, {
      className: 'turtle-editor',
      value: this.state.source,
      editorDidMount: (editor) => { this.instance = editor; },
      onBeforeChange: this.onChangeTurtle,
      options: {
        ...codeMirrorAddonOptions,
        mode: 'text/turtle',
        indentWithTabs: false, indentUnit: 2, tabSize: 2,
        lineNumbers: true,
        lineWrapping: true,
        gutters: ['CodeMirror-linenumbers'],
      },
    });
  }

  onChangeTurtle = (editor: {}, editorChange: {}, source: string) => {
    if (this.props.onChange) {
      this.props.onChange(source);
    } else {
      this.setState({
        source: source,
      });
    }
  }

  public getTurtle = () => {
    return this.state.source;
  }

}

export default TurtleEditorComponent;
