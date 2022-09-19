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
import * as D from 'react-dom-factories';
import { Children, ReactElement, cloneElement, createFactory } from 'react';
import { Component } from 'platform/api/components';

interface SparqlQueryConfig {
  /**
   * SPARQL SELECT or CONSTRUCT query
   */
  query: string;
}

export type SparqlQueryProps = SparqlQueryConfig;

class SparqlQueryComponent extends Component<SparqlQueryProps, {}> {

  public render() {
    const textarea = D.textarea({
      "value": this.props.query,
      "rows": 10,
      "cols": 80
    })
    return textarea
  }
}

export type component = SparqlQueryComponent;
export const component = SparqlQueryComponent;
export const factory = createFactory(component);
export default component;
