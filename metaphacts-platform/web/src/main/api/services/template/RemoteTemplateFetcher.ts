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

import { Cancellation, WrappingError } from 'platform/api/async';
import { Rdf } from 'platform/api/rdf';

import { PageService } from 'platform/api/services/page';

import { ExtractedTemplate, parseHtml, extractTemplateBody } from './TemplateParser';

let loadingCancellation = new Cancellation();
const loadingRemoteTemplates = new Map<string, Kefir.Property<ExtractedTemplate>>();
const cachedRemoteTemplates = new Map<string, ExtractedTemplate>();

export function purgeRemoteTemplateCache() {
  loadingCancellation.cancelAll();
  loadingCancellation = new Cancellation();
  loadingRemoteTemplates.clear();
  cachedRemoteTemplates.clear();
}

export function fetchRemoteTemplate(iri: Rdf.Iri): Kefir.Property<ExtractedTemplate> {
  if (cachedRemoteTemplates.has(iri.value)) {
    return Kefir.constant(cachedRemoteTemplates.get(iri.value));
  } else if (loadingRemoteTemplates.has(iri.value)) {
    return loadingRemoteTemplates.get(iri.value);
  }

  // fetching and parsing template source
  const task = loadingCancellation.map(
    PageService.loadPageTemplateHtml(iri)
      .map(source => {
        const nodes = source ? parseHtml(source.templateHtml) : [];
        const template = extractTemplateBody(nodes, iri.value);
        loadingRemoteTemplates.delete(iri.value);
        cachedRemoteTemplates.set(iri.value, template);
        return template;
      })
      .mapErrors(error => new WrappingError(
        `Failed to load the source of template ${iri}`, error
      ))
  );

  // ensure the task is always run fully to completion
  // even if fetching request was cancelled
  task.observe({});

  loadingRemoteTemplates.set(iri.value, task);
  return task;
}

export function hasRemoteTemplate(iri: Rdf.Iri): boolean {
  return cachedRemoteTemplates.has(iri.value);
}

export function getRemoteTemplate(iri: Rdf.Iri): ExtractedTemplate {
  if (cachedRemoteTemplates.has(iri.value)) {
    return cachedRemoteTemplates.get(iri.value);
  } else {
    throw new Error(`Cannot synchronously get remote template ${iri} as it is not preloaded`);
  }
}

export function preloadReferencedRemoteTemplates(
  roots: ReadonlySet<ExtractedTemplate>
): Kefir.Property<Rdf.Iri[]> {
  if (roots.size === 0) {
    return Kefir.constant<Rdf.Iri[]>([]);
  }

  const dependencies = new Map<string, ExtractedTemplate | null>();

  function addAndResolve(template: ExtractedTemplate): Kefir.Property<unknown> {
    dependencies.set(template.localName, template);
    return resolve(template);
  }

  function resolve(template: ExtractedTemplate): Kefir.Property<unknown> {
    if (template.remoteReferences.length === 0) {
      return Kefir.constant(undefined);
    }
    const referencesToLoad: Rdf.Iri[] = [];
    for (const reference of template.remoteReferences) {
      if (!dependencies.has(reference.value)) {
        referencesToLoad.push(reference);
      }
    }

    if (referencesToLoad.length === 0) {
      return Kefir.constant(undefined);
    }

    for (const iri of referencesToLoad) {
      // mark dependency to prevent multiple loading
      dependencies.set(iri.value, null);
    }

    const dependenciesTasks = referencesToLoad.map(
      iri => fetchRemoteTemplate(iri)
        .mapErrors(error => new WrappingError(`Failed to load template ${iri}`, error))
        .flatMap(addAndResolve)
    );
    return Kefir.zip(dependenciesTasks)
      .toProperty()
      .mapErrors(error => new WrappingError(
        `Error while resolving dependencies of template '${template.localName}'`, error
      ));
  }

  return Kefir.zip(Array.from(roots, resolve))
    .map(() => {
      const loadedTemplates: Rdf.Iri[] = [];
      dependencies.forEach((template, iri) => loadedTemplates.push(Rdf.iri(iri)));
      return loadedTemplates;
    })
    .toProperty();
}
