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
import '../scss/main.scss';
import '../scss/help.scss';

import { initModuleRegistry } from './bootstrap';
initModuleRegistry();

import {
  ModuleRegistry, ComponentsLoader, registerNativeComponent,
} from 'platform/api/module-loader';
import BrowserDetector from './BrowserDetector';

import {
  Component, ReactNode, createElement, SFC, ComponentClass, cloneElement, ReactElement,
} from 'react';
import * as D from 'react-dom-factories';
import { render } from 'react-dom';
import * as moment from 'moment';
import * as _ from 'lodash';
import * as Kefir from 'kefir';
import * as maybe from 'data.maybe';

/**
 * That is a special require, platform-components module will be generated by
 * webpack custom extensionsLoader that uses .mp-extensions file to create
 * set of dynamic imports for platform extensions.
 */
require('platform-extensions');

import { SparqlUtil } from 'platform/api/sparql';
import {
  renderNotificationSystem, registerNotificationSystem, addNotification,
} from 'platform/components/ui/notification';
import {
  renderOverlaySystem, registerOverlaySystem, getOverlaySystem,
} from 'platform/components/ui/overlay';
import {
  listen, init as initNavigation, getCurrentUrl, getCurrentResource,
} from 'platform/api/navigation';
import { ConfigHolder } from 'platform/api/services/config-holder';
import { propagatePreferredUserLanguage } from 'platform/api/services/language';
import { getRegisteredPrefixes } from 'platform/api/services/namespace';
import * as TemplateService from 'platform/api/services/template';
import * as SecurityService from 'platform/api/services/security';
import { getLabel } from 'platform/api/services/resource-label';

import { DefaultRepositoryInfo } from 'platform/api/services/repository';

import PageComponent from './page/Page';


import { TemplateItemComponent } from 'platform/components/ui/template';
customElements.define('mp-template-item', TemplateItemComponent);

import * as Cookies from 'js-cookie';
import { TableAggregationExtension, TableFilterExtension } from 'platform/components/semantic/data-table/extensions';
import { getExtensionScripts } from 'platform/api/services/extension';
const WINDOW_SESSION_TIMEOUT = 'sessionTimeout';
const WINDOW_LAST_REQUEST_TIME = 'lastRequestTime';
const WINDOW_ANONYMOUS_WARNING = 'anonymousWarning';
const BROWSER_WARNING = 'browserWarning';

/**
 * Document title that is initially set in the HTML head. It is used as a base title for all pages.
 */
const BASE_TITLE = document.title;

const AsyncSparqlEndpointComponent =
  (props: any) => ComponentsLoader.factory({
    componentTagName: 'mp-internal-sparql-endpoint', componentProps: props,
  });

export class MainAppComponent extends Component<{}, {
  headerHTML?: Data.Maybe<ReactNode>;
  footerHTML?: Data.Maybe<ReactNode>;
  route?: ComponentClass<any> | SFC<any>
}> {
  private sessionIntervalID: number;

  constructor(props: {}, context: any) {
    super(props, context);
    this.state = {
      headerHTML : maybe.Nothing<ReactNode>(),
      footerHTML : maybe.Nothing<ReactNode>(),
      route: this.getRoute(getCurrentUrl()),
    };
  }

  private getRoute(location: uri.URI): ComponentClass<any> | SFC<any> {
    if (_.last(location.segment()) === 'sparql') {
      this.updatePageTitle(true);
      return AsyncSparqlEndpointComponent;
    } else {
      this.updatePageTitle(false);
      return PageComponent;
    }
  }

  /**
   * Set HTML header title based on the title of the current resource.
   */
  private updatePageTitle(isSparqlEndpoint: boolean) {
    if (isSparqlEndpoint) {
      document.title = `SPARQL Endpoint [${BASE_TITLE}]`;
    } else {
      try {
        getLabel(getCurrentResource())
          .onValue(
            label => document.title = `${label} [${BASE_TITLE}]`
          )
          .onError(e => {
            document.title = BASE_TITLE;
            console.error(e);
          });
      } catch (e) {
        console.error(e);
        document.title = BASE_TITLE;
      }

    }

  }

  public componentDidMount () {
    // get sessionTimeout from backend
    this.getSessionTimeout();

    // get header template
    TemplateService.getPageLayoutTemplate('header')
      .flatMap(html => ModuleRegistry.parseHtmlToReact(html))
      .observe({
        value: components => this.setState({
          headerHTML: maybe.Just(components),
        }),
        error: error => console.error('Failed to load header', error),
      });

    // get footer template
    TemplateService.getPageLayoutTemplate('footer')
      .flatMap(html => ModuleRegistry.parseHtmlToReact(html))
      .observe({
        value: components => this.setState({
          footerHTML: maybe.Just(components),
        }),
        error: error => console.error('Failed to load footer', error),
      });

    this.addLastRequestTimeInterceptorToHttpRequests();
    registerNotificationSystem(this);
    registerOverlaySystem(this);

    // check all 10 seconds whether session is about to expire
    this.setupSessionTimeoutCheck();

    listen({
      eventType: 'NAVIGATED',
      callback: event => {
        this.setState({route: this.getRoute(event.url)});
      },
    });

    const browserWarningShown = Cookies.get(BROWSER_WARNING);
    const supportedBrowsers = ConfigHolder.getUIConfig().supportedBrowsers;
    const browserWarningMessage = ConfigHolder.getUIConfig().unsupportedBrowserMessage;
    let showBrowserWarning = false;

    if (!browserWarningShown && supportedBrowsers && browserWarningMessage) {
      showBrowserWarning = supportedBrowsers.some((browserAndMinVersion) => {
        const browserAndVersion = browserAndMinVersion.split(/-\s*([^-]+)$/);
        if (BrowserDetector.browserName === browserAndVersion[0] &&
          BrowserDetector.majorVersion < parseInt(browserAndVersion[1], 10)) {
          return true;
        }
      }) || supportedBrowsers.every((browserAndMinVersion) => {
        const browserAndVersion = browserAndMinVersion.split(/-\s*([^-]+)$/);
        if (BrowserDetector.browserName !== browserAndVersion[0]) {
          return true;
        }
      });

      if (showBrowserWarning) {
        addNotification({
          title: 'Browser not supported',
          autoDismiss: 0,
          message: browserWarningMessage,
          level: 'error',
        });
        Cookies.set(BROWSER_WARNING, true);
      }
    }
  }

  /**
   * Adds interceptor to all AJAX requests to track the
   * lastRequest time in Cookies.get(WINDOW_LAST_REQUEST_TIME) variable
   * http://stackoverflow.com/questions/25335648/how-to-intercept-all-ajax-requests-made-by-different-js-libraries
   */
  addLastRequestTimeInterceptorToHttpRequests(): void {
    (function(open) {
      XMLHttpRequest.prototype.open = function (
        method: any, url: any, async?: any, user?: any, pass?: any
      ) {
          this.addEventListener('readystatechange', function() {
                Cookies.set(WINDOW_LAST_REQUEST_TIME, Date.now());
          }, false);
          open.call(this, method, url, async, user, pass);
      };
    })(XMLHttpRequest.prototype.open);
  }

  private getSessionTimeout = (): void => {
    SecurityService.Util.getSessionInfo(
        (sessionObject: SecurityService.SessionInfoI) => {
          Cookies.set(WINDOW_SESSION_TIMEOUT, sessionObject.timout);
        }
      );
  }

  private setupSessionTimeoutCheck = (): void => {
    SecurityService.Util.getUser(  (user: SecurityService.UserI) => {
        if ( user.isAnonymous && !_.isEqual(Cookies.get(WINDOW_ANONYMOUS_WARNING), Cookies.get('JSESSIONID'))) {
          addNotification({
            message: 'Your are authenticated as anonymous "guest" user only',
            level: 'warning',
            autoDismiss: 2,
            action: {
              label: 'Login',
              callback: () => window.location.href = '/login',
            },
          });
          Cookies.set(WINDOW_ANONYMOUS_WARNING, Cookies.get('JSESSIONID'));
        }else if (!user.isAnonymous) {
          // check session timeout every minute
          this.sessionIntervalID = window.setInterval(this.checkSessionTimeout.bind(this), 60000);
        }
      }
    );
  }

  /**
   * Checks whether the session is likely about to expire within the next 5minutes
   * and pushes a warning to the notificationSystem. Uses the cached last request
   * time and the session timeout from backend.
   *
   */
  private checkSessionTimeout = (): void => {
    const lastRequestTime = parseInt(Cookies.get(WINDOW_LAST_REQUEST_TIME));
    const sessionTimeout = parseInt(Cookies.get(WINDOW_SESSION_TIMEOUT));

    if ( _.isNaN(sessionTimeout) && _.isNaN(lastRequestTime)) {
      return;
    }

    const timeLeftMinutes = moment(sessionTimeout).diff(moment(Date.now() - lastRequestTime), 'minutes');
    if ( timeLeftMinutes > 10 ) {
      return;
    }

    const timeLeftFormated = moment(Date.now() - lastRequestTime).to(sessionTimeout);
    const clearScreenOnLogout = ConfigHolder.getUIConfig().clearScreenOnLogout;

    if ( timeLeftMinutes < 0 && !clearScreenOnLogout) {
      addNotification({
          title: 'Session Info',
          autoDismiss: 0,
          message: 'Your session is expired.',
          level: 'error',
          action: {
            label: 'Login',
            // navigate to / (which will induce a login in almost all cases, i.e. SSO or form-based
            // authentication). Note that for form-based authentication it will redirect to /login
            // automatically, while in SSO the login happens implicitly
            callback: () => window.location.href = '/',
          },
      });
      window.clearInterval(this.sessionIntervalID);
    } else if (timeLeftMinutes < 0 && clearScreenOnLogout) {
      window.clearInterval(this.sessionIntervalID);
      // navigate to the logged out page
      window.location.href = '/logged-out/index.html';
    }

    addNotification({
        title: 'Session Info',
        autoDismiss: 57,
        message: 'Your session is about to expire ' + timeLeftFormated,
        level: 'warning',
        action: {
          label: 'Extend Session',
          callback: () => SecurityService.Util.touchSession(() => {}), // some success notification to be shown here ?
        },
    });

  }

  public render() {
    return D.div(
      {},
      ...this.getHeader(),
      renderNotificationSystem(),
      renderOverlaySystem(),
      // we need to assign key to route component here because the component is created
      // when header is loading, in the beginning it is one null element. But after loading
      // we have two header elements, because number of elements changes react can't properly
      // unify components and fully recreate route component.
      createElement(this.state.route, {key: 'page-holder'}),
      this.state.footerHTML.isNothing ? null : this.state.footerHTML.get()
    );
  }

  private getHeader() {
    if (this.state.headerHTML.isNothing) {
      return [null];
    } else {
      const header = this.state.headerHTML.get() as ReactElement<any>;
      // to make sure that page layout can adapt to header of any height we duplicate the header's
      // dom element and re-insert it as a hidden element with relative position.
      const hiddenHeader =
        cloneElement(
          header, {style: {visibility: 'hidden', position: 'relative'}, key: 'hidden-header'}
        );
      return [header, hiddenHeader];
    }
  }
}

listen({
  eventType: 'NAVIGATED',
  callback: event => {
    if (getOverlaySystem()) {
      getOverlaySystem().hideAll();
    }
  },
});


// publish extension points;
declare global {
  interface Window {
    metaphacts: {
      tableAggregationsLoader: typeof TableAggregationExtension.chainLoaderPromise,
      tableFiltersLoader: typeof TableFilterExtension.chainLoaderPromise,
    }
  }
}

window.metaphacts = {
  ...(window.metaphacts),
  tableAggregationsLoader: TableAggregationExtension.chainLoaderPromise
    .bind(TableAggregationExtension),
  tableFiltersLoader: TableFilterExtension.chainLoaderPromise
    .bind(TableFilterExtension),
};

window.addEventListener('DOMContentLoaded', function () {
  Kefir.combine({
      url: initNavigation(),
      prefixes: getRegisteredPrefixes(),
      rawConfig: ConfigHolder.fetchConfig(),
      repositories: DefaultRepositoryInfo.init(),
  }).flatMap(loaded => {
      // load extensions after configuration init
      return loadExtensions().map(() => loaded);
  }).flatMap(({ url, prefixes, rawConfig }) => {
    try {
      SparqlUtil.init(prefixes);
      ConfigHolder.initializeConfig(rawConfig);
      propagatePreferredUserLanguage();
    } catch (e) {
      return Kefir.constantError<any>(e);
    }
    return Kefir.constant(url);
  }).onValue(
    () => {
      render(
        createElement(
          MainAppComponent
        ),
        document.getElementById('application')
      );
    }
  ).onError(e => {
    if (e instanceof SecurityService.NotEnoughPermissionsError) {
      TemplateService.getPageLayoutTemplate('noPermissionsPage').observe({
        value: page => {
          document.getElementById('application').innerHTML = page;
        }
      });
    } else {
      const message =
        `Platform initialization failed: \n
         ${e} \n
         Please contact the system administrator.
        `;
      render(
        D.div(
          {style: {color: 'red'}},
          message
        ),
        document.getElementById('application')
      );
    }
  });
});

function loadExtensions(): Kefir.Property<void> {
  const loadScriptOnce = makeOnlyOnceLoader(loadScript);
  const loadStyleOnce = makeOnlyOnceLoader(loadStyle);
  return getExtensionScripts().flatMap(extensions => {
    for (const tagName of Object.keys(extensions.components)) {
      const {loadScripts, loadStyles} = extensions.components[tagName];
      registerNativeComponent(tagName, () => {
        const scriptTasks = (loadScripts ?? []).map(loadScriptOnce);
        const styleTasks = (loadStyles ?? []).map(loadStyleOnce);
        return Promise.all([...scriptTasks, ...styleTasks]).then(() => {/* void */});
      });
    }
    if (extensions.extensions.length === 0) {
      return Kefir.constant(undefined);
    }
    const tasks = extensions.extensions.map(ext =>
      Kefir.fromPromise(loadScriptOnce(ext)).flatMapErrors(err => {
        // an extension failing to load shouldn't break the platform init, so resolve
        console.warn(`Failed to load extension ${ext}: `, err);
        return Kefir.constant(undefined);
      })
    );
    return Kefir.zip(tasks).map(() => undefined);
  }).toProperty();
}

function makeOnlyOnceLoader(
  loader: (url: string) => Promise<unknown>
): (url: string) => Promise<unknown> {
  const cache = new Map<string, Promise<unknown>>();
  return url => {
    if (cache.has(url)) {
      return cache.get(url);
    }
    const task = loader(url);
    cache.set(url, task);
    return task;
  };
}

function loadScript(scriptUrl: string): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function loadStyle(styleUrl: string): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = styleUrl;
    link.onload = resolve;
    link.onerror = reject;
    document.head.appendChild(link);
  });
}
