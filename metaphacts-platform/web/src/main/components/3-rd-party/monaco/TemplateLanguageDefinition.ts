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
import * as monaco from './MonacoBundle';
// TODO: re-implement worker adapters to avoid accessing this module
const htmlMode = require('monaco-editor/esm/vs/language/html/htmlMode.js');

import { languageConfiguration, languageGrammar } from './TemplateLanguageSyntax';
import {
  TemplateLanguageServiceData, ComponentMetadata, JsonSchema,
} from './TemplateLanguageWorkerCommon';

const TEMPLATE_LANGUAGE_ID = 'mp-template';

let registered = false;
let templateLanguageOverrides: Partial<TemplateLanguageOptions> = {};
let languageDefaults: TemplateLanguageDefaults | undefined;

export function registerTemplateLanguage() {
  if (!registered) {
    monaco.languages.register({
      id: TEMPLATE_LANGUAGE_ID,
      mimetypes: ['text/metaphactory-template'],
    });
    monaco.editor.defineTheme('mp-template-theme', getTemplateThemeData());
    monaco.languages.onLanguage(TEMPLATE_LANGUAGE_ID, () => {
      loadBundledTemplateLanguageData().then(languageData => {
        monaco.languages.setLanguageConfiguration(TEMPLATE_LANGUAGE_ID, languageConfiguration);
        monaco.languages.setMonarchTokensProvider(TEMPLATE_LANGUAGE_ID, languageGrammar);
        languageDefaults = new TemplateLanguageDefaults(
          languageData,
          applyTemplateLanguageOptions()
        );
        languageDefaults.install();
      });
    });
  }
}

const DEFAULT_MODE_CONFIGURATION: monaco.languages.html.ModeConfiguration = {
  completionItems: true,
  hovers: true,
  documentSymbols: true,
  links: true,
  documentHighlights: true,
  rename: true,
  colors: true,
  foldingRanges: true,
  selectionRanges: true,
  // TODO: enable diagnostics by default in the future
  diagnostics: false,
  documentFormattingEdits: true,
  documentRangeFormattingEdits: true,
};

class TemplateLanguageDefaults implements monaco.languages.html.LanguageServiceDefaults {
  private readonly _onDidChange =
    new monaco.Emitter<monaco.languages.html.LanguageServiceDefaults>();
  private _modeConfiguration: monaco.languages.html.ModeConfiguration;
  private _installedMode: monaco.IDisposable | undefined;

  readonly languageId: string;

  constructor(
    private readonly languageData: TemplateLanguageServiceData,
    modeConfiguration: monaco.languages.html.ModeConfiguration
  ) {
    this.languageId = TEMPLATE_LANGUAGE_ID;
    this._modeConfiguration = modeConfiguration;
  }

  get onDidChange(): monaco.IEvent<monaco.languages.html.LanguageServiceDefaults> {
    return this._onDidChange.event;
  }

  get modeConfiguration(): monaco.languages.html.ModeConfiguration {
    return this._modeConfiguration;
  }

  setModeConfiguration(modeConfiguration: monaco.languages.html.ModeConfiguration) {
    this._modeConfiguration = modeConfiguration;
    this.install();
    if (!modeConfiguration.diagnostics) {
      for (const model of monaco.editor.getModels()) {
        if (model.getModeId() === TEMPLATE_LANGUAGE_ID) {
          monaco.editor.setModelMarkers(model, TEMPLATE_LANGUAGE_ID, []);
        }
      }
    }
  }

  get options(): monaco.languages.html.Options {
    return this.languageData as any;
  }

  setOptions(options: monaco.languages.html.Options): void {
    /* nothing */
  }

  install() {
    if (this._installedMode) {
      this._installedMode.dispose();
    }
    this._installedMode = htmlMode.setupMode(languageDefaults);
  }
}

export interface TemplateLanguageOptions {
  readonly diagnostics: boolean;
}

export function getTemplateLanguageOptions(): TemplateLanguageOptions {
  const {diagnostics = DEFAULT_MODE_CONFIGURATION.diagnostics} = templateLanguageOverrides;
  return {diagnostics};
}

export function updateTemplateLanguageOptions(options: Partial<TemplateLanguageOptions>) {
  templateLanguageOverrides = {...templateLanguageOverrides, ...options};
  if (languageDefaults) {
    languageDefaults.setModeConfiguration(applyTemplateLanguageOptions());
  }
}

function applyTemplateLanguageOptions(): monaco.languages.html.ModeConfiguration {
  const {diagnostics = DEFAULT_MODE_CONFIGURATION.diagnostics} = templateLanguageOverrides;
  return {...DEFAULT_MODE_CONFIGURATION, diagnostics};
}

export async function loadBundledTemplateLanguageData(): Promise<TemplateLanguageServiceData> {
  type BundleLoader =
    ((tagName: string) => { metadata?: ComponentMetadata | null }) &
    { readonly allTags: ReadonlyArray<string> };
  const getBundleLoaderTask: Promise<BundleLoader> = import('platform-components' as string);

  type AllSchemas = { [schemaName: string]: JsonSchema };
  const schemasTask: Promise<AllSchemas> = import('platform-schemas' as string);

  const getBundleLoader = await getBundleLoaderTask;
  const schemas = await schemasTask;

  const components: { [tag: string]: ComponentMetadata | null } = {};
  for (const tag of getBundleLoader.allTags) {
    const loader = getBundleLoader(tag);
    components[tag] = loader && loader.metadata ? loader.metadata : null;
  }
  return {components, schemas};
}

function getTemplateThemeData(): monaco.editor.IStandaloneThemeData {
  return {
    base: 'vs',
    inherit: true,
    colors: {},
    rules: [
      {token: 'comment', foreground: 'b06327'},
      {token: 'tag', foreground: '197c09'},
      {token: 'attribute.name', foreground: '3151da'},
      {token: 'attribute.value.html', foreground: 'bd2c25'},
      {token: 'metatag.content.html', foreground: '196ac5'},
    ]
  };
}
