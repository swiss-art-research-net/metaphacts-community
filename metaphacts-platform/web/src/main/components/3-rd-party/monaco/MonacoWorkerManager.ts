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

export interface MonacoWorkerManagerOptions {
  readonly moduleId: string;
  readonly label: string;
  readonly createData: {
    languageId: string;
    languageSettings: unknown;
  };
}

export class MonacoWorkerManager<WorkerApi> implements monaco.IDisposable {
  private worker: monaco.editor.MonacoWebWorker<WorkerApi> | undefined;
  private apiProxy: Promise<WorkerApi> | undefined;

  constructor(
    private readonly options: MonacoWorkerManagerOptions
  ) {}

  getWorker(...uris: monaco.Uri[]): Promise<WorkerApi> {
    if (!this.apiProxy) {
      const {moduleId, label, createData} = this.options;
      this.worker = monaco.editor.createWebWorker({
        moduleId,
        label,
        createData,
      });
      this.apiProxy = this.worker.getProxy();
    }
    let createdApi: WorkerApi | undefined;
    return this.apiProxy
      .then(api => {
        createdApi = api;
        return this.worker.withSyncedResources(uris);
      })
      .then(() => createdApi);
  }

  dispose() {
    if (this.worker) {
      this.worker.dispose();
      this.worker = undefined;
    }
    this.apiProxy = undefined;
  }
}

export interface TrackModelChangesOptions {
  readonly editor: monaco.editor.ICodeEditor;
  readonly debounceInterval: number;
  readonly onAddOrChange: (model: monaco.editor.IModel) => void;
  readonly onRemove?: (model: monaco.editor.IModel) => void;
}

export function trackModelChanges(options: TrackModelChangesOptions): monaco.IDisposable {
  const {editor, debounceInterval, onAddOrChange, onRemove} = options;
  const listeners = new Map<string, monaco.IDisposable>();

  const addModel = (model: monaco.editor.IModel) => {
    let handle: ReturnType<typeof setTimeout> | null;
    const changeListener = model.onDidChangeContent(() => {
      clearTimeout(handle);
      handle = setTimeout(() => {
        handle = null;
        onAddOrChange(model);
      }, debounceInterval);
    });
    listeners.set(model.uri.toString(), {
      dispose: () => {
        if (handle !== null) {
          clearTimeout(handle);
        }
        changeListener.dispose();
      }
    });
    onAddOrChange(model);
  };

  const removeModel = (model: monaco.editor.IModel) => {
    if (onRemove) {
      onRemove(model);
    }
    const modelUri = model.uri.toString();
    const listener = listeners.get(modelUri);
    if (listener) {
      listener.dispose();
      listeners.delete(modelUri);
    }
  };

  const subscriptions: monaco.IDisposable[] = [
    editor.onDidChangeModel(e => {
      removeModel(monaco.editor.getModel(e.oldModelUrl));
      addModel(monaco.editor.getModel(e.newModelUrl));
    }),
    monaco.editor.onWillDisposeModel(removeModel),
    monaco.editor.onDidChangeModelLanguage(e => {
      if (listeners.has(e.model.uri.toString())) {
        removeModel(e.model);
        addModel(e.model);
      }
    }),
  ];
  const disposeAll = () => {
    for (const subscription of subscriptions) {
      subscription.dispose();
    }
    listeners.forEach(listener => listener.dispose());
  };
  addModel(editor.getModel());
  return {dispose: disposeAll};
}
