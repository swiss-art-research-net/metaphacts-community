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
import * as Kefir from 'kefir';

import { requestAsProperty } from 'platform/api/async';
import * as request from 'platform/api/http';
import { PageService } from 'platform/api/services/page';

import { purgeRemoteTemplateCache } from './RemoteTemplateFetcher';

type PageLayoutTemplateName = 'header' | 'footer' | 'noPermissionsPage';

export function getPageLayoutTemplate(name: PageLayoutTemplateName): Kefir.Property<string> {
  const req = request
    .get(`/rest/template/${name}`)
    .accept('text/html');
  return requestAsProperty(req).map(res => res.text);
}

PageService.beforeSave.observe({
  value: () => purgeRemoteTemplateCache(),
});

export { DataContext, mergeInContextOverride } from './DataContext';
export {
  ExtractedTemplate, extractTemplates, extractTemplateBody, findImportedComponents,
  isNonEmptyNode, isTemplate, parseHtml, renderHtml,
} from './TemplateParser';
export {
  RawTemplateScope, RAW_TEMPLATES_ATTRIBUTE, CAPTURED_DATA_CONTEXT_ATTRIBUTE,
} from './TemplateExecution';
export { matchJsonAttributeValue } from './JsonTemplateParser';
export { TemplateScope, TemplateScopeProps, CompiledTemplate } from './TemplateScope';
