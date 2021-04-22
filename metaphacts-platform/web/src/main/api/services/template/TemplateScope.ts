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
import { Node } from 'html-to-react';

import { loadPermittedComponents } from 'platform/api/module-loader/ComponentBasedSecurity';
import { loadComponents } from 'platform/api/module-loader/ComponentsStore';
import { Rdf } from 'platform/api/rdf';

import { DefaultHelpers } from './functions';

import { DataContext, emptyDataStack } from './DataContext';
import { ExtractedTemplate, SystemHelpers, parseHtml, extractTemplateBody } from './TemplateParser';
import {
  ALLOWED_DYNAMIC_HTML_COMPONENTS, createTemplateRenderingHandlebars, renderTemplate,
} from './TemplateExecution';
import { getRemoteTemplate, preloadReferencedRemoteTemplates } from './RemoteTemplateFetcher';

export type CompiledTemplate = (dataContext: DataContext) => Node[];

export interface TemplateScopeProps {
  partials?: { readonly [id: string]: string };
}

const EMPTY_TEMPLATES: ReadonlyMap<string, ExtractedTemplate> =
  new Map<string, ExtractedTemplate>();

const EMPTY_TEMPLATE: CompiledTemplate = () => [];

const KNOWN_HELPERS: { [helperName: string]: boolean } = {
  [SystemHelpers.NODE]: true,
  [SystemHelpers.ATTRIBUTE]: true,
  [SystemHelpers.TEMPLATE]: true,
  [SystemHelpers.TEXT]: true,
};
for (const helperName in DefaultHelpers) {
  if (!Object.prototype.hasOwnProperty.call(DefaultHelpers, helperName)) { continue; }
  KNOWN_HELPERS[helperName] = true;
}

/**
 * Represents an isolated Handlebars compiler instance acting as a container
 * for partials and helpers with an ability to clone it.
 *
 * Cloned scope doesn't depend on it's parent, e.g. registering a helper or a
 * partial on a parent scope won't affect cloned scope.
 *
 * @example
 * // compile template with default global partials and helpers
 * TemplateScope.empty().prepare('<div>{{foo}}</div>')
 *   .then(template => { ... });
 *
 * // create an isolated scope with partials using `fromProps()`
 * const isolateScope = TemplateScope.fromProps({
 *   partials: {
 *     foo: '<span>{{> @partial-block}}<span>',
 *   }
 * });
 *
 * // use either local partials or remote ones
 * // (by specifying IRI as a partial name)
 * isolateScope.prepare('{{#> foo}} {{> platform:someTemplate}} {{/foo}}')
 *   .then(template => { ... });
 */
export class TemplateScope {
  private static readonly emptyScope = new TemplateScope();
  private readonly handlebars = createTemplateRenderingHandlebars();

  private readonly localTemplates: ReadonlyMap<string, ExtractedTemplate>;
  private readonly referencedTemplates = new Map<number, ExtractedTemplate>();

  private constructor(
    templates?: ReadonlyMap<string, ExtractedTemplate>
  ) {
    for (const helperName in DefaultHelpers) {
      if (!Object.prototype.hasOwnProperty.call(DefaultHelpers, helperName)) { continue; }
      type DefaultHelperName = keyof typeof DefaultHelpers;
      this.handlebars.registerHelper(helperName, DefaultHelpers[helperName as DefaultHelperName]);
    }

    this.localTemplates = templates || EMPTY_TEMPLATES;
    this.localTemplates.forEach((body, localName) => {
      this.referencedTemplates.set(body.globalKey, body);
      this.handlebars.registerPartial(localName, body.transformedAst);
    });
  }

  static empty(): TemplateScope {
    return TemplateScope.emptyScope;
  }

  static emptyTemplate(): CompiledTemplate {
    return EMPTY_TEMPLATE;
  }

  static fromProps(options: TemplateScopeProps): TemplateScope {
    return TemplateScope.empty().addOverrides(options.partials || {});
  }

  static fromTemplates(
    templates: ReadonlyMap<string, ExtractedTemplate> | undefined
  ): TemplateScope {
    return new TemplateScope(templates);
  }

  addOverrides(overrides: { [localName: string]: string }): TemplateScope {
    const templates = new Map<string, ExtractedTemplate>();
    this.localTemplates.forEach(
      (template, localName) => templates.set(localName, template)
    );
    for (const localName of Object.keys(overrides)) {
      const templateNodes = parseHtml(overrides[localName]);
      const template = extractTemplateBody(templateNodes, localName);
      templates.set(template.localName, template);
    }
    return new TemplateScope(templates);
  }

  getPartial(name: string): ExtractedTemplate {
    return this.localTemplates.get(name);
  }

  exportProps(): TemplateScopeProps {
    const partials: { [id: string]: string } = {};
    this.localTemplates.forEach((partial, id) => partials[id] = partial.source);
    return {partials};
  }

  prepare(templateSource: string): Kefir.Property<CompiledTemplate> {
    if (!templateSource) {
      return Kefir.constant(TemplateScope.emptyTemplate());
    }

    let template: ExtractedTemplate;
    try {
      const templateNodes = parseHtml(templateSource);
      template = extractTemplateBody(templateNodes, '');
    } catch (err) {
      return Kefir.constantError<any>(err);
    }

    const localTemplates = this.findAllReferencedLocalTemplates(template);
    return preloadReferencedRemoteTemplates(localTemplates)
      .flatMap(loadedRemotes => {
        this.registerRemoteTemplates(loadedRemotes);
        let importedComponents: Set<string>;
        try {
          importedComponents = this.findAllImportedComponents(template);
        } catch (err) {
          return Kefir.constantError(err);
        }
        return loadPermittedComponents(importedComponents);
      }).flatMap(permittedComponents => {
        return Kefir.fromPromise(loadComponents(permittedComponents));
      })
      .map(() => this.compilePreloadedTemplate(template))
      .toProperty();
  }

  private registerRemoteTemplates(remoteReferences: ReadonlyArray<Rdf.Iri>) {
    for (const remoteName of remoteReferences) {
      if (this.localTemplates.has(remoteName.value)) { continue; }
      const remoteTemplate = getRemoteTemplate(remoteName);
      if (this.referencedTemplates.has(remoteTemplate.globalKey)) { continue; }
      this.referencedTemplates.set(remoteTemplate.globalKey, remoteTemplate);
      this.handlebars.registerPartial(remoteName.value, remoteTemplate.transformedAst);
    }
  }

  private findAllReferencedLocalTemplates(root: ExtractedTemplate): Set<ExtractedTemplate> {
    const localReferences = new Set<ExtractedTemplate>();

    const visitTemplate = (template: ExtractedTemplate) => {
      if (!localReferences.has(template)) {
        localReferences.add(template);
        template.localReferences.forEach(visitLocalReference);
      }
    };

    const visitLocalReference = (localName: string) => {
      const referencedTemplate = this.localTemplates.get(localName);
      if (!referencedTemplate) {
        throw new Error(`Missing local template for reference {{>${localName}}}`);
      }
      visitTemplate(referencedTemplate);
    };

    visitTemplate(root);
    return localReferences;
  }

  private findAllImportedComponents(template: ExtractedTemplate): Set<string> {
    const visited = new Set<number>();
    const importedComponents = new Set<string>();
    let mayRenderDynamicHtml = false;

    const visitSource = (globalKey: number) => {
      if (visited.has(globalKey)) { return; }
      const source = globalKey === template.globalKey
        ? template : this.referencedTemplates.get(globalKey);
      visited.add(source.globalKey);
      if (source.hasDynamicHtml) {
        mayRenderDynamicHtml = true;
      }
      source.importedComponents.forEach(
        component => importedComponents.add(component)
      );
      source.localReferences.forEach(localReference => {
        const referencedTemplate = this.localTemplates.get(localReference);
        if (!referencedTemplate) {
          throw new Error(`Missing local template for reference {{>${localReference}}}`);
        }
        visitSource(referencedTemplate.globalKey);
      });
      for (const remoteReference of source.remoteReferences) {
        // this will throw an exception if remote not found
        const referencedTemplate = getRemoteTemplate(remoteReference);
        visitSource(referencedTemplate.globalKey);
      }
    };

    visitSource(template.globalKey);
    if (mayRenderDynamicHtml) {
      ALLOWED_DYNAMIC_HTML_COMPONENTS.forEach(tag => importedComponents.add(tag));
    }
    return importedComponents;
  }

  private compilePreloadedTemplate(template: ExtractedTemplate): CompiledTemplate {
    const compiledSource = this.handlebars.compile(template.transformedAst, {
      knownHelpers: KNOWN_HELPERS,
      preventIndent: true,
    });
    const compiledTemplate: CompiledTemplate = (dataContext) => {
      return renderTemplate(
        compiledSource,
        sourceKey => {
          return sourceKey === template.globalKey
            ? template : this.referencedTemplates.get(sourceKey);
        },
        dataContext.context,
        dataContext.data || emptyDataStack()
      );
    };
    return compiledTemplate;
  }
}
