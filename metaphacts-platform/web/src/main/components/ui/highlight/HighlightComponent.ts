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
import { Component, CSSProperties, ReactElement, ReactNode, HTMLProps } from 'react';
import * as D from 'react-dom-factories';
import * as styles from './HighlightComponent.scss';
import { escapeRegExp } from 'lodash';

/**
 * **Example**:
 * ```
 * <mp-highlight highlight="text">some text here</mp-highlight>
 * ```
 */
interface HighlightConfig {
  /**
   * Additional class names for component root element
   */
  className?: string;
  /**
   * Additional styles for label element
   */
  style?: CSSProperties;
  /**
   * Substring to highlight
   */
  highlight?: string | number;
  /**
   * Props for highlighted substring span
   */
  highlightProps?: {};
  /**
   * Whether to split the highlight term into individual tokens / words.
   * If active, highlighting is done on matched words.
   */
  splitToken?: boolean;
}

export interface HighlightProps extends HighlightConfig {
  highlightProps?: HTMLProps<HTMLSpanElement>;
}

export class HighlightComponent extends Component<HighlightProps, {}> {
  render(): ReactElement<any> {
    if (typeof this.props.children !== 'string') {
      throw 'Children of HighlightComponent must be string';
    }
    const label = this.props.children;
    const {className, style} = this.props;
    const highlightedString = String(this.props.highlight);
    const highlightedTerms = this.props.splitToken
      ? highlightedString.split(' ').map(t => t.trim())
      : [highlightedString];
    return D.span(
      {className, style},
      ...highlight(label, highlightedTerms, this.props.highlightProps)
    );
  }
}

function highlight(
  sourceText: string,
  highlightedTerms: ReadonlyArray<string>,
  highlightProps: HTMLProps<HTMLSpanElement> = {className: styles.highlight}
): ReactNode[] {
  const alternatives: string[] = [];
  for (const term of highlightedTerms) {
    if (term) {
      alternatives.push(escapeRegExp(term));
    }
  }
  if (alternatives.length === 0) {
    return [sourceText];
  } else {
    const termRegexp = new RegExp(alternatives.join('|'), 'ig');

    const parts: ReactNode[] = [];
    let nextIndex = 0;
    while (true) {
      const match = termRegexp.exec(sourceText);
      if (!match) {
        break;
      }
      if (nextIndex < match.index) {
        parts.push(sourceText.substring(nextIndex, match.index));
      }
      parts.push(D.span(highlightProps, match[0]));
      nextIndex = termRegexp.lastIndex;
    }
    if (nextIndex < sourceText.length) {
      parts.push(sourceText.substring(nextIndex));
    }
    return parts;
  }
}

export default HighlightComponent;
