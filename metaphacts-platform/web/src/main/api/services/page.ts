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
import * as request from 'platform/api/http';
import * as Kefir from 'kefir';
import { pick } from 'lodash';

import { requestAsProperty } from 'platform/api/async';
import { Rdf } from 'platform/api/rdf';

import { getPreferredUserLanguage } from './language';

export interface TemplateContent {
  appId: string | null;
  revision: string | null;
  source: string;
  definedByApps: ReadonlyArray<string>;
  applicableTemplates: string[];
  appliedTemplate: string;
  includes: Array<{ readonly '@id': string }>;
}

interface RenderedTemplate {
  jsurls: string[];
  templateHtml: string;
}

export interface RevisionInfo {
  appId: string;
  iri: string;
  revision: string | undefined;
}

export interface PageViewConfig {
  pageViewTemplateIri: string;
  statementsViewTemplateIri: string;
  graphViewTemplateIri: string;
  knowledgeGraphBarTemplateIri: string;
  breadcrumbsTemplateIri?: string;
  showKnowledgeGraphBar: boolean;
  showKnowledgeGraphBarToggle: boolean;
  editable: boolean;
  defaultView: string;
}

const REVISION_INFO_TEMPLATE: { [K in keyof RevisionInfo]: null } = {
  appId: null,
  iri: null,
  revision: null,
};
/** Compiler-enforced array with all the keys of revision info */
const REVISION_INFO_KEYS = Object.keys(REVISION_INFO_TEMPLATE);

export interface TemplateInfo extends RevisionInfo {
  author: string;
  date?: string;
}

export interface TemplateStorageStatus {
  appId: string;
  writable: boolean;
}

export module PageService {
  const GET_SOURCE = '/rest/template/source';
  const GET_PAGE_HTML = '/rest/template/pageHtml';
  const GET_HTML = '/rest/template/html';
  const GET_PAGE_RENDER_INFO = '/rest/template/pageViewConfig';
  const PUT_SOURCE = '/rest/template/source';
  const GET_ALL_INFO = '/rest/template/getAllInfo';
  const POST_EXPORT_REVISIONS = '/rest/template/exportRevisions';
  const DELETE_REVISIONS = '/rest/template/deleteRevisions';
  const GET_STORAGE_STATUS = '/rest/template/storageStatus';
  const GET_KNOWLEDGE_PANEL = '/rest/template/knowledgePanel/html';

  export function loadTemplateSource(iri: string): Kefir.Property<TemplateContent> {
    const req = request
        .get(GET_SOURCE)
        .query({iri: iri})
        .type('application/json')
        .accept('application/json');

    return requestAsProperty(req)
      .mapErrors(err => err.status)
      .map(res => JSON.parse(res.text) as TemplateContent);
  }

  export function loadPageTemplateHtml(iri: Rdf.Iri): Kefir.Property<{ templateHtml: string }> {
    const req = request
      .get(GET_PAGE_HTML)
      .query({
        iri: iri.value,
        preferredLanguage: getPreferredUserLanguage(),
      })
      .type('application/json')
      .accept('application/json');

    return requestAsProperty(req)
      .map(res => JSON.parse(res.text));
  }

  export function getPageViewConfig(
    iri: Rdf.Iri,
    repository: string
  ): Kefir.Property<PageViewConfig> {
    const req = request
      .get(GET_PAGE_RENDER_INFO)
      .query({
        iri: iri.value,
        repository: repository
      })
      .type('application/json')
      .accept('application/json');

    return requestAsProperty(req)
      .mapErrors(err => err.rawResponse)
      .map(res => JSON.parse(res.text) as PageViewConfig);
  }

  export function loadRenderedTemplate(
    iri: Rdf.Iri, contextIri?: Rdf.Iri, params?: { [index: string]: string }
  ): Kefir.Property<RenderedTemplate> {
    const req = request
        .get(GET_HTML)
        .query({
          iri: iri.value,
          preferredLanguage: getPreferredUserLanguage(),
        })
        .query(params)
        .type('application/json')
        .accept('application/json');

    if (contextIri) {
      req.query({context: contextIri.value});
    }

    return requestAsProperty(req)
      .mapErrors(err => err.rawResponse)
      .map(res => JSON.parse(res.text) as RenderedTemplate);
  }

  let beforeSaveEmitter: Kefir.Emitter<void>;
  export const beforeSave = Kefir.stream<void>(emitter => {
    beforeSaveEmitter = emitter;
  });

  export function save(params: {
    iri: string;
    targetAppId: string;
    sourceAppId?: string;
    sourceRevision?: string;
    rawContent: string;
  }): Kefir.Property<boolean> {
    const {iri, targetAppId, sourceAppId, sourceRevision, rawContent} = params;

    beforeSaveEmitter.emit();

    const req = request
        .put(PUT_SOURCE)
      .query({
        iri,
        targetAppId,
        sourceAppId,
        sourceRevision,
      })
        .send(rawContent)
        .type('text/html')
        .accept('application/json');

    return requestAsProperty(req)
      .mapErrors(err => err.rawResponse)
      .map(res => res.status === 201);
  }

  export function getAllTemplateInfos(): Kefir.Property<TemplateInfo[]> {
    const req = request
        .get(GET_ALL_INFO)
        .type('application/json')
        .accept('application/json');

    return requestAsProperty(req)
      .mapErrors(err => err.response.statusText)
      .map(res => JSON.parse(res.text));
  }

  export function deleteTemplateRevisions(
    selected: ReadonlyArray<RevisionInfo>
  ): Kefir.Property<boolean> {
    const req = request
        .del(DELETE_REVISIONS)
        .type('application/json')
        .send(selected.map(cleanRevisionInfo));

    return requestAsProperty(req)
      .map(res => true);
  }

  export function exportTemplateRevisions(
    selected: ReadonlyArray<RevisionInfo>
  ): Kefir.Property<request.Response> {
    const req = request
        .post(POST_EXPORT_REVISIONS)
        .type('application/json')
        .accept('application/zip' )
        .on('request', function (re: { readonly xhr: XMLHttpRequest }) {
          re.xhr.responseType = 'arraybuffer'; // or blob
        })
        .send(selected.map(cleanRevisionInfo));

    return requestAsProperty(req)
      .mapErrors(err => err.response.statusText);
  }

  export function getStorageStatus(): Kefir.Property<TemplateStorageStatus[]> {
    const req = request
      .get(GET_STORAGE_STATUS)
      .accept('application/json');

    return requestAsProperty(req)
      .mapErrors(err => err.response.statusText)
      .map(res => JSON.parse(res.text) as TemplateStorageStatus[]);
  }

  export function loadKnowledgePanelTemplate(
    iri: string,
    params?: { [index: string]: string }
  ): Kefir.Property<{ templateHtml: string }> {
    const req = request.get(GET_KNOWLEDGE_PANEL)
      .query({
        iri,
        context: iri,
        preferredLanguage: getPreferredUserLanguage(),
      })
      .query(params);
    return requestAsProperty(req)
      .mapErrors(err => err.response.statusText)
      .map(res => JSON.parse(res.text));
  }
}

/**
 * Removes extra properties from template revision info to
 * avoid server error when trying to deserialize object.
 */
function cleanRevisionInfo(info: RevisionInfo): RevisionInfo {
  return pick(info, REVISION_INFO_KEYS);
}
