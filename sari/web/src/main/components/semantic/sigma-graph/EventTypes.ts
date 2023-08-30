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

import { EventMaker } from 'platform/api/events';

export interface SigmaEventData {
  /**
   * Event which should be triggered when a node is clicked
   */
  'Sigma.NodeClicked': {
    /**
     * Node IRI.
     */
    nodes: string[];
  };

  /**
   * Event that listens to a external event that triggers
   * a click on a given node
   */
  'Sigma.TriggerNodeClicked': {
    node: string;
  }

  /**
   * Event that listens to an external event that
   * focusses on a given node
   */
  'Sigma.FocusNode': {
    node: string;
  }
  
  /**
   * Event that listens to an external event and expands the given group node, replacing the group node with its children
   * 
   * @param id The id of the group node to expand
   * @param mode The mode in which the group node should be expanded. Default is 'replace'
   */
  'Sigma.ScatterGroupNode': {
    id: string;
    mode: 'expand' | 'replace';
  }
}
const event: EventMaker<SigmaEventData> = EventMaker;

export const ScatterGroupNode = event('Sigma.ScatterGroupNode');
export const FocusNode = event('Sigma.FocusNode');
export const NodeClicked = event('Sigma.NodeClicked');
export const TriggerNodeClicked = event('Sigma.TriggerNodeClicked');