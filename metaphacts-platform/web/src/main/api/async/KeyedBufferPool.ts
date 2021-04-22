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
import * as Immutable from 'immutable';
import * as Kefir from 'kefir';

import { Cancellation } from './Cancellation';

export class KeyedBufferPool<K, V> {
  private activeCount = 0;
  private _targets: Immutable.Set<K>;
  private _result: Immutable.Map<K, V>;
  private _error: unknown;

  private loadingTargets = Immutable.Set<K>();

  constructor(
    initialValue: Immutable.Map<K, V>,
    private cancellation: Cancellation,
    private onLoad: (keys: Immutable.Set<K>) => Kefir.Property<Immutable.Map<K, V>>,
    private onCompleted: (loaded: Immutable.Set<K>) => void
  ) {
    this._targets = initialValue.keySeq().toSet();
    this._result = initialValue;
  }

  get targets() { return this._targets; }
  get result() { return this._result; }
  get error() { return this._error; }

  get loading() {
    return this.activeCount > 0;
  }

  load(keys: Immutable.Set<K>): void {
    if (keys.size === 0) {
      return;
    }
    this.activeCount++;
    this._targets = this._targets.merge(keys);
    this.loadingTargets = this.loadingTargets.merge(keys);
    this.cancellation.map(this.onLoad(keys)).observe({
      value: value => {
        this._result = this._result.merge(value);
      },
      error: error => {
        this._error = error;
      },
      end: () => {
        this.activeCount--;
        if (this.activeCount === 0 && !this.cancellation.aborted) {
          const loadedTargets = this.loadingTargets;
          this.loadingTargets = Immutable.Set<K>();
          this.onCompleted(loadedTargets);
        }
      }
    });
  }
}
