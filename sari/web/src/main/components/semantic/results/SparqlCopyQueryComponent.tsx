/*
 * Copyright (C) 2022, © Swiss Art Research Infrastructure, University of Zurich
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import * as React from 'react';
import * as CopyToClipboard from 'react-copy-to-clipboard';
import { addNotification } from 'platform/components/ui/notification';
import { createFactory } from 'react';
import { Component } from 'platform/api/components';

/**
 * 
 * Component to copy the a SPARQL query to the clipboard.
 * Can be used within a semantic-search-result component to copy the query created
 * through a semantic search to the clipboard
 * 
 * **Example**:
 * ```
 * <sari-copy-query-to-clipboard id='query-copy' query="SELECT * WHERE { }">            
 *   <button class='btn btn-secondary'>
 *        <i class='fa fa-copy'></i> Copy Query
 *    </button>
 *  </sari-copy-query-to-clipboard>
 * ```
 */

interface SparqlQueryConfig {
  /**
   * SPARQL SELECT or CONSTRUCT query
   */
  query: string;
  /**
   * The message that will be displayed in the notification when the query has been copied.
   *
   * @default "The query has been copied!"
   */
  message?: string;
}

export type SparqlQueryProps = SparqlQueryConfig;

class SparqlQueryComponent extends Component<SparqlQueryProps, {}> {
  
  static defaultProps = {
    message: 'The query has been copied!',
  };

  private onCopy = () => {
    addNotification({
      level: 'success',
      message: this.props.message,
    });
  }

  public render() {
    return (
      <CopyToClipboard text={this.props.query} onCopy={this.onCopy}>
        {this.props.children}
      </CopyToClipboard>
    );
  }
}

export type component = SparqlQueryComponent;
export const component = SparqlQueryComponent;
export const factory = createFactory(component);
export default component;
