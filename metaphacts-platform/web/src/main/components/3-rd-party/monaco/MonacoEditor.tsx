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

import { openResourceInNewWindow } from 'platform/api/navigation';
import { Rdf } from 'platform/api/rdf';
import { SparqlUtil } from 'platform/api/sparql';

import * as monaco from './MonacoBundle';
import { IOpenerService, SimpleOpenerService } from './MonacoOpenerService';

import { registerTemplateLanguage } from './TemplateLanguageDefinition';
import { TEMPLATE_INCLUDE_SCHEMA, TEMPLATE_RESOURCE_LINK } from './TemplateLanguageWorkerCommon';

export interface MonacoEditorProps {
  className?: string;
  style?: React.CSSProperties;
  language: 'mp-template' | 'html' | 'json';
  automaticLayout?: boolean;
  fixedOverflowWidgets?: boolean;
}

export class MonacoEditor extends React.Component<MonacoEditorProps> {
  private editor: monaco.editor.IStandaloneCodeEditor;

  render() {
    const {className, style} = this.props;
    return (
      <div ref={this.onEditorRootMount}
        className={className}
        style={style}>
      </div>
    );
  }

  getEditor() {
    return this.editor;
  }

  private onEditorRootMount = (editorRoot: HTMLElement | null) => {
    if (editorRoot) {
      const {language, automaticLayout, fixedOverflowWidgets} = this.props;
      registerTemplateLanguage();
      const options: monaco.editor.IStandaloneEditorConstructionOptions = {
        language,
        theme: language === 'mp-template' ?  'mp-template-theme' : undefined,
        automaticLayout,
        fixedOverflowWidgets,
      };
      this.editor = monaco.editor.create(editorRoot, options, {
        [IOpenerService]: new SimpleOpenerService(targetUri => {
          if (targetUri.startsWith(TEMPLATE_INCLUDE_SCHEMA)) {
            const includedResource = tryExpandTemplateInclude(
              targetUri.substring(TEMPLATE_INCLUDE_SCHEMA.length)
            );
            openResourceInNewWindow(includedResource, {action: 'edit'});
          } else if (targetUri.startsWith(TEMPLATE_RESOURCE_LINK)) {
            const resource = targetUri.substring(TEMPLATE_RESOURCE_LINK.length);
            openResourceInNewWindow(Rdf.iri(resource));
          } else {
            window.open(targetUri, '_blank', 'noreferrer noopener');
          }
          return Promise.resolve(true);
        }),
        storageService: {
          get() {/* nothing */},
          getNumber(key: string): number | undefined {
            return undefined;
          },
          getBoolean(key: string): boolean {
              if (key === 'expandSuggestionDocs') {
                // Expand description panel on auto-complete by default
                return true;
              }
              return false;
          },
          store() {/* nothing */},
          onWillSaveState() {/* nothing */},
          onDidChangeStorage() {/* nothing */},
        }
      });
      patchDefaultKeybindings(this.editor);
    } else {
      if (this.editor) {
        this.editor.dispose();
      }
    }
  }
}

const SPECIAL_INCLUDE_PREFIXES = ['Template:', 'PanelTemplate:'];

export function tryExpandTemplateInclude(targetUri: string): Rdf.Iri {
  // TODO: Move this to NamespaceService?
  let nonSpecialIri = targetUri;
  let specialPrefix: string | undefined;
  for (const prefix of SPECIAL_INCLUDE_PREFIXES) {
    if (targetUri.startsWith(prefix)) {
      specialPrefix = prefix;
      nonSpecialIri = targetUri.substring(prefix.length);
      break;
    }
  }

  let expandedIri: Rdf.Iri | undefined;
  try {
    [expandedIri] = SparqlUtil.resolveIris([nonSpecialIri]);
  } catch (err) {
    // iri is already in expanded form or prefix not found
    expandedIri = Rdf.iri(nonSpecialIri);
  }
  return specialPrefix ? Rdf.iri(specialPrefix + expandedIri.value) : expandedIri;
}

/**
 * HACK: workaround missing API for configuring default keybindings, see:
 * https://github.com/microsoft/monaco-editor/issues/102
 * https://github.com/microsoft/monaco-editor/issues/287
 */
function patchDefaultKeybindings(editor: monaco.editor.IStandaloneCodeEditor) {
  const keybindingService = (editor as any)._standaloneKeybindingService;
  // remove existing one; no official API yet
  // the '-' before the commandId removes the binding (Ctrl/⌘+L)
  // as of >=0.21.0 we need to supply a dummy command handler to not get errors
  // (because of the fix for https://github.com/microsoft/monaco-editor/issues/1857)
  keybindingService.addDynamicKeybinding('-expandLineSelection', undefined, () => {/**/});
}
