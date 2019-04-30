/*
 * Copyright (C) 2015-2019, metaphacts GmbH
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
import { render } from 'react-dom';

import { Rdf } from 'platform/api/rdf';
import { SparqlUtil } from 'platform/api/sparql';
import { DefaultRepositoryInfo } from 'platform/api/services/repository';
import { ConfigHolder } from 'platform/api/services/config-holder';
import { getRegisteredPrefixes } from 'platform/api/services/namespace';
import PageViewer from '../page/PageViewer';

import { init as initNavigation, __unsafe__setCurrentResource } from 'platform/api/navigation';
import { init as initBaseUrl } from 'platform/api/http';

function initPlatform(baseUrl?: string) {
  initBaseUrl(baseUrl);
  return Kefir.combine({
    url: initNavigation(),
    prefixes: getRegisteredPrefixes(),
    rawConfig: ConfigHolder.fetchConfig(),
    repositories: DefaultRepositoryInfo.init(),
  }).flatMap(({url, prefixes, rawConfig}) => {
    try {
      SparqlUtil.init(prefixes);
      ConfigHolder.initializeConfig(rawConfig);
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

let platform = null;
declare var __webpack_public_path__;

window['metaphactory'] = {
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
