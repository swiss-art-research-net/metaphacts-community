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
import { Component } from 'react';
import * as moment from 'moment';
import * as Immutable from 'immutable';

import { Cancellation } from 'platform/api/async';
import { BrowserPersistence } from 'platform/components/utils';

import { ContextTypes, ComponentContext } from './SparqlQueryEditorContext';

export interface RecentQueriesProps { }

const LS_RECENT_QUERIES = 'recentQueries';
const MAX_LS_RECENT_QUERIES = 30;
const LOCALE_FORMAT = getLocaleFormat();
const STORAGE_FORMAT = 'MM/DD/YY, HH:mm';

type StoredQuery = Immutable.Map<'repository' | 'date' | 'query', string>;
type StoredQueries = Immutable.List<StoredQuery>;

export class RecentQueries extends Component<RecentQueriesProps, void> {
  static readonly contextTypes = ContextTypes;
  context: ComponentContext;

  private readonly cancellation = new Cancellation();

  private lastQuery: { query: string; repository?: string };

  render() {
    const recentQueries: StoredQueries = BrowserPersistence.getItem(LS_RECENT_QUERIES);
    if (!recentQueries) {
      return <span>no queries</span>;
    }

    const labelStyle: React.CSSProperties = {
      background: 'lightgrey',
      color: '#fff',
      display: 'inline-block',
      fontSize: '0.8em',
      padding: '1px 5px',
      marginBottom: 3,
      marginRight: 3,
    };
    return <div className='list-group' style={{marginBottom: 0}}>
      {recentQueries.map((item, index) =>
        <a key={index} href='' className='list-group-item'
          title={item.get('query')}
          onClick={e => {
            e.preventDefault();
            const {queryEditorContext} = this.context;
            const query: string = item.get('query');
            const repository: string | undefined = item.get('repository');
            this.lastQuery = {query, repository};
            queryEditorContext.setQuery(query, {repository});
          }}>
          <span style={labelStyle}>
            {renderDate(item.get('date'))}
          </span>
          {
            item.get('repository') ? (
              <span style={labelStyle}>{item.get('repository')}</span>
            ) : null
          }
          <div style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
            {item.get('query')}
          </div>
        </a>,
      ).toArray()}
    </div>;
  }

  componentDidMount() {
    const {queryEditorContext} = this.context;
    this.cancellation.map(queryEditorContext.queryChanges).onValue(({query, repository}) => {
      if (query.isJust && (!this.lastQuery || (query.get() !== this.lastQuery.query ||
        repository.getOrElse(undefined) !== this.lastQuery.repository))) {
        this.addRecentQueries(query.get(), repository.getOrElse(undefined));
      }
    });
  }

  private addRecentQueries = (query: string, repository?: string) => {
    const recentQueries: StoredQueries = BrowserPersistence.getItem(LS_RECENT_QUERIES);

    const recentQuery = {
      query: query,
      date: moment().format(STORAGE_FORMAT),
      repository,
    };

    if (recentQueries) {
      const queries: Array<StoredQuery | typeof recentQuery> = recentQueries.toArray();

      const lastQuery = queries[0] as StoredQuery;
      if (lastQuery.get('query') !== query || lastQuery.get('repository') !== repository) {
        queries.unshift(recentQuery);
      } else {
        queries.splice(0, 1, recentQuery);
      }

      if (queries.length > MAX_LS_RECENT_QUERIES) { queries.pop(); }

      BrowserPersistence.setItem(LS_RECENT_QUERIES, queries);
    } else {
      BrowserPersistence.setItem(LS_RECENT_QUERIES, [recentQuery]);
    }

    this.forceUpdate();
  }
}

export default RecentQueries;

function renderDate(date: string) {
  const dateString = moment(date, STORAGE_FORMAT).format(LOCALE_FORMAT);
  return dateString;
}

function getLocaleFormat() {
  const locale: string = (window.navigator as any).userLanguage || window.navigator.language;
  const localMoment = moment();
  localMoment.locale(locale);
  const localeData = localMoment.localeData();
  const dateFormat = localeData.longDateFormat('L');
  const timeFormat = localeData.longDateFormat('LT');
  const format = `${dateFormat}, ${timeFormat}`;

  return format;
}
