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
import { initModuleRegistry } from '../bootstrap';
initModuleRegistry();

import * as Kefir from 'kefir';
import * as ReactDOM from 'react-dom';
import { render } from 'react-dom';
import { Component, createElement } from 'react';

import { Rdf } from 'platform/api/rdf';
import { SparqlUtil } from 'platform/api/sparql';
import { DefaultRepositoryInfo } from 'platform/api/services/repository';
import { ConfigHolder } from 'platform/api/services/config-holder';
import { propagatePreferredUserLanguage } from 'platform/api/services/language';
import { getRegisteredPrefixes } from 'platform/api/services/namespace';
import PageViewer from '../page/PageViewer';
import * as D from 'react-dom-factories';

import { init as initNavigation, __unsafe__setCurrentResource } from 'platform/api/navigation';
import { init as initBaseUrl } from 'platform/api/http';
import {
  renderNotificationSystem,
  registerNotificationSystem
} from 'platform/components/ui/notification';
import {
  renderOverlaySystem,
  registerOverlaySystem
} from 'platform/components/ui/overlay';

/*
 * Example for using
 *
 * @example
 * <html lang="en">
 *  <head>
 *    <meta name="version" content="{{version}}" />
 *    <meta name="viewport" content="width=device-width, initial-scale=1">
 *    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
 *    <meta http-equiv="X-UA-Compatible" content="IE=Edge,chrome=1" />
 *    {{{html-head}}}
 *    <script defer type='text/javascript' src='{{assetsMap.vendor}}'></script>
 *    <script defer type='text/javascript'
 *      src='http://localhost:3000/assets/page-renderer-bundle.js'>
 *    </script>
 *  </head>
 *  <body>
 *    <div id="application"></div>
 *    <script>
 *      addEventListener('DOMContentLoaded', () => {
 *        metaphactory.init();
 *        var app = document.getElementById('application');
 *        metaphactory.render('http://www.metaphacts.com/resource/assets/OntodiaView', {}, app);
 *      });
 *    </script>
 *  </body>
 *  </html>
 */

export class SubsystemContainer extends Component<{}, {}> {
  constructor(props: {}, context: any) {
    super(props, context);
  }

  componentDidMount() {
    registerNotificationSystem(this);
    registerOverlaySystem(this);
  }

  render() {
    return D.div(
      {},
      renderNotificationSystem(),
      renderOverlaySystem()
    );
  }
}

function initPlatform(baseUrl?: string) {
  initBaseUrl(baseUrl);
  return Kefir.combine({
    url: initNavigation(),
    prefixes: getRegisteredPrefixes(),
    rawConfig: ConfigHolder.fetchConfig(),
    repositories: DefaultRepositoryInfo.init(),
    subsystem: initSubsystems(),
  }).flatMap<unknown>(({url, prefixes, rawConfig}) => {
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
      console.log('metaphacts platform has been initialized successfully!');
    }
  );
}

function initSubsystems() {
  const element = document.createElement('div');
  return Kefir.stream<SubsystemContainer>(emitter => {
    const ref = (instance: SubsystemContainer) => {
      if (instance) {
        emitter.emit(instance);
        emitter.end();
      }
    };
    ReactDOM.render(
      createElement(SubsystemContainer, {ref}),
      document.body.appendChild(element)
    );
  }).toProperty();
}

let platform: Kefir.Stream<unknown> = null;
declare var __webpack_public_path__: string;

(window as any)['metaphactory'] = {
  init: function(baseUrl?: string) {
    if (baseUrl) {
      __webpack_public_path__ = baseUrl + '/assets/';
    }
    platform = initPlatform(baseUrl);
  },
  render: function(pageIri: string, params: {}, htmlElement: HTMLElement) {
    platform.onValue(
      () => {
        const resource = Rdf.iri(pageIri);
        __unsafe__setCurrentResource(resource);
        render(
          PageViewer({
            iri: resource,
            context: resource,
            params: params,
            noBackdrop: true,
          }),
          htmlElement
        );
      }
    );
  }
};
