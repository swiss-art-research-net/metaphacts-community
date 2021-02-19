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
import * as h from 'history';
import * as _ from 'lodash';
import * as Kefir from 'kefir';
import * as uri from 'urijs';
import * as Maybe from 'data.maybe';

import { Rdf } from 'platform/api/rdf';
import { SparqlUtil } from 'platform/api/sparql';
import { getFullIri } from 'platform/api/services/namespace';
import { ConfigHolder } from 'platform/api/services/config-holder';

import { init as initPersistentHistory, persistRecentPages } from './PersistentHistory';

export type EventType = 'NAVIGATED' | 'BEFORE_NAVIGATE';
export type Listener = NavigatedListener | BeforeNavigateListener;

export interface NavigatedListener {
  eventType: 'NAVIGATED';
  callback: (e: Event) => void;
}

export interface BeforeNavigateListener {
  eventType: 'BEFORE_NAVIGATE';
  callback: (e: Event, performNavigation: (navigate: boolean) => void) => void;
}

export type PageView = 'graph' | 'statements' | 'page';

/**
 * Location change event.
 */
export interface Event {
  url: uri.URI

  /**
   * REFRESH should be used when one want to refresh current page with actual page reload
   */
  action: 'PUSH' | 'REPLACE' | 'POP' | 'REFRESH' | 'BEFORE_NAVIGATE'
}
const listeners: Map<string, Listener> = new Map();
let currentLocation: uri.URI;

let currentResource: Rdf.Iri;

const history = h.createBrowserHistory();
history.listen(
  (location, action) =>
    init(location).onValue(
      mUrl => mUrl.map(url => notifyAll({url: url, action: action}))
    )
);

/**
 * Listen to browser Location changes.
 * @return a callback to unsubscribe.
 */
export function listen(cb: Listener) {
  const id = _.uniqueId();
  listeners.set(id, cb);
  return () => { listeners.delete(id); };
}

/**
 * Returns current resource IRI.
 */
export function getCurrentResource(): Rdf.Iri {
  return currentResource;
}

export function getCurrentRepository(): string {
  return currentLocation.search(true)['repository'] || 'default';
}

export function getCurrentView(): PageView | null {
  return currentLocation.search(true)['view'];
}

/**
 * For testing purpose only
 */
export function __unsafe__setCurrentResource(resource: Rdf.Iri) {
  currentResource = resource;
  SparqlUtil.__unsafe__setLegacyCurrentResource(resource);
}

/**
 * Returns current browser Location URL.
 */
export function getCurrentUrl(): uri.URI {
  return currentLocation;
}

/**
 * Navigate to specified resource, it is possible to provide
 * additional query parameters with 'props' map.
 */
export function navigateToResource(
  iri: Rdf.Iri, props?: {}, repository?: string, fragment?: string,
): Kefir.Property<void> {
  return constructUrlForResource(iri, props, repository, fragment).flatMap(
    navigateToUrl
  ).toProperty();
}

/**
 * This function opens a link in a new window, it is synchronous, so we can't create pretty
 * URL with namespace.
 * We can't have async call here, because by default browsers prevent opening of
 * new windows/tab not from the action triggered by the user
 */
export function openResourceInNewWindow(
  iri: Rdf.Iri, props?: {}, repository?: string
): void {
  window.open(
    constructUrlForResourceSync(iri, props, repository).toString(), '_blank'
  );
}

export function openExternalLink(url: uri.URI, target = '_blank') {
  return confirmAll(url).filter(c => c).map(() => {
    window.open(url.toString(), target);
  });
}

const START_PAGE = uri('/');

/**
 * Navigate to platform internal URL, e.g '/sparql'. In case of navigation to root we redirect to
 * start page.
 */
export function navigateToUrl(url: uri.URI): Kefir.Property<void> {
  return confirmAll(url).filter(c => c).map(
    () => {
      if (url.equals(START_PAGE)) {
        // Because home page configuration value can be full or prefixed IRI we
        // need to apply the same heuristic that we use in HomePageFilter.java#guessStartPage
        const homePage = SparqlUtil.resolveIris(
          [ConfigHolder.getGlobalConfig().homePage.value]
        )[0];
        navigateToResource(homePage).onValue(() => {/**/});
      } else {
        let newUrl = url.toString();
        history.push(newUrl);
        persistRecentPages(newUrl);
      }
    }
  );
}

export function navigateToView(view: PageView) {
  const currentUrl = getCurrentUrl();
  const newUrl = currentUrl
    .removeSearch('view')
    .addSearch('view', view)
    .toString();
  history.push(newUrl);
  persistRecentPages(newUrl);
}

/**
 * Refresh current Location with actual page reload.
 */
export function refresh(): void {
  notifyAll({url: currentLocation, action: 'REFRESH'});
}

/**
 * Construct URL for resource page with optional additional query parameters.
 * If possible, shortcuts full IRI to prefixed IRI.
 *
 * @deprecated Use `constructUrlForResourceSync()` instead
 */
export function constructUrlForResource(
  iri: Rdf.Iri, props: {} = {}, repository = 'default', fragment = ''
): Kefir.Property<uri.URI> {
  return Kefir.constant(constructUrlForResourceSync(iri, props, repository, fragment));
}

export function constructUrlForResourceSync(
  iri: Rdf.Iri, props: {} = {}, repository = 'default', fragment = ''
) {
  const prefixedIri = SparqlUtil.tryCompactIriUsingPrefix(iri);
  const baseQuery = repository === 'default' ? {} : {repository: repository};
  const resourceUrl = ConfigHolder.getEnvironmentConfig().resourceUrlMapping.value;
  if (!prefixedIri) {
    const url = uri(`${resourceUrl}`);
    url.setQuery({...baseQuery, ...props, uri: iri.value});
    url.fragment(fragment);
    return url;
  } else {
    const url = uri(`${resourceUrl}${prefixedIri}`);
    url.setQuery({...baseQuery, ...props});
    url.fragment(fragment);
    return url;
  }
}

/**
 * Initialize Navigation with current browser Location.
 */
export function init(location = history.location): Kefir.Property<Data.Maybe<uri.URI>> {
  currentLocation = uri({
    path: location.pathname,
    query: location.search,
  }).fragment(location.hash);
  return resolveResourceIri(currentLocation).map(
    maybeIri =>
      maybeIri.map(
        iri => __unsafe__setCurrentResource(iri)
      ).map(() => currentLocation)
  );
}



/**
 * Notify all subscribed listeners.
 */
export function notifyAll(event: Event) {
  listeners.forEach(
    listener => {
      if (isNavigationListener(listener)) {
        listener.callback(event);
      }
    }
  );
}

function confirmAll(url: uri.URI): Kefir.Property<boolean> {
  const responsess: Array<Kefir.Property<boolean>> = [];
  listeners.forEach(
    listener => {
      if (isBeforeNavigationListener(listener)) {
        responsess.push(
          Kefir.fromCallback<boolean>(
            cb => listener.callback({action: 'BEFORE_NAVIGATE', url: url}, cb)
          ).toProperty()
        );
      } else {
        responsess.push(
          Kefir.constant(true)
        );
      }
    }
  );
  return Kefir.combine(responsess).map(_.every).toProperty();
}

function isNavigationListener(listener: Listener): listener is NavigatedListener {
  return listener.eventType === 'NAVIGATED';
}

function isBeforeNavigationListener(listener: Listener): listener is BeforeNavigateListener {
  return listener.eventType === 'BEFORE_NAVIGATE';
}

export function resolveResourceIri(url: uri.URI): Kefir.Property<Data.Maybe<Rdf.Iri>> {
  if (url.hasSearch('uri')) {
    const iriStr = url.search(true)['uri'];
    return Kefir.constant(
      Maybe.Just(Rdf.iri(iriStr))
    );
  } else {
    const prefixedIriStr = url.filename();
    return getFullIri(prefixedIriStr);
  }
}

initPersistentHistory(init);
