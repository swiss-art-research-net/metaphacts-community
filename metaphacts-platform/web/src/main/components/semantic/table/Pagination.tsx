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
import * as React from 'react';

interface GriddlePaginationProps {
  maxPage: number;
  currentPage: number;
  setPage: (pageN: number) => void;
  previous: () => void;
  next: () => void;
}

export interface CustomPaginationProps {
  externalCurrentPage?: number;
  onPageChange?: (newPage: number) => void;
}

export type PaginationProps = GriddlePaginationProps & CustomPaginationProps;

export class Pagination extends React.Component<PaginationProps, {}> {
  constructor(props: PaginationProps) {
    super(props);
  }

  static defaultProps = {
    maxPage: 0,
    currentPage: 0,
  };

  componentDidMount() {
    this.updateCurrentPageIfRequested(this.props);
  }

  componentWillUpdate(nextProps: PaginationProps) {
    if (
      this.props.onPageChange &&
      nextProps.externalCurrentPage !== this.props.externalCurrentPage
    ) {
      // update page only in controlled mode
      this.updateCurrentPageIfRequested(nextProps);
    }
  }

  private updateCurrentPageIfRequested(props: PaginationProps) {
    const shouldUpdatePage =
      typeof props.externalCurrentPage === 'number' &&
      props.externalCurrentPage !== props.currentPage;

    if (shouldUpdatePage) {
      this.setPage(props.externalCurrentPage);
    }
  }

  private onPageButtonClick = (e: React.MouseEvent) => {
    const targetPage = parseInt((e.target as Element).getAttribute('data-value'));
    this.setPage(targetPage);
  }

  private setPage(newPage: number) {
    if (!Number.isFinite(newPage)) { return; }
    this.props.setPage(newPage);
    if (this.props.onPageChange) {
      this.props.onPageChange(newPage);
    }
  }

  render() {
    if (this.props.maxPage > 1) {
      const previous = (
        <li className={this.props.currentPage === 0 ? 'disabled' : ''}>
          <a onClick={this.props.previous}>
            <span>{'\xAB'}</span>
          </a>
        </li>
      );

      const next = (
        <li className={this.props.currentPage === (this.props.maxPage - 1) ? 'disabled' : ''}>
          <a onClick={this.props.next}>
            <span>{'\xBB'}</span>
          </a>
        </li>
      );

      let startIndex = Math.max(this.props.currentPage - 5, 0);
      const endIndex = Math.min(startIndex + 11, this.props.maxPage);

      if (this.props.maxPage >= 11 && (endIndex - startIndex) <= 10) {
        startIndex = endIndex - 11;
      }

      const options: JSX.Element[] = [];
      for (let i = startIndex; i < endIndex ; i++) {
        const selected = this.props.currentPage === i ? 'active' : '';
        options.push(
          <li key={i} className={selected}>
            <a data-value={i} onClick={this.onPageButtonClick}>{i + 1}</a>
          </li>
        );
      }

      return (
        <nav>
          <ul className='pagination' onMouseDown={this.onListMouseDown}>
            {previous}
            {options}
            {next}
          </ul>
        </nav>
      );
    } else {
      return <nav></nav>;
    }
  }

  private onListMouseDown = (e: React.MouseEvent) => {
    // prevent text selection on click
    e.preventDefault();
  }
}
