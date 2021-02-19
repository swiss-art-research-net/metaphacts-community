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

import { Cancellation } from 'platform/api/async';

export class ExtensionPoint<T> {
  private loaded = false;
  private value: T | undefined;
  private error: any;
  // intialize with no-op loader
  private loader: () => Kefir.Stream<T> = () => Kefir.later(0, undefined);
  private loadingExtension: Kefir.Stream<T>;

  constructor() {}

  isLoading(): boolean {
    return !this.loaded;
  }

  get(): T | undefined {
    if (!this.loaded) {
      throw new Error('Extension must be loaded before calling ExtensionPoint.get()');
    } else if (this.error) {
      throw this.error;
    }
    return this.value;
  }

  load(): Kefir.Stream<T> {
    if (this.value) {
      return Kefir.never();
    } if (this.loadingExtension) {
      return this.loadingExtension;
    } else {
      const {loader} = this;
      this.loadingExtension = loader()
        .flatMap(newValue => {
          if (this.loader === loader) {
            this.loaded = true;
            this.value = newValue;
            return Kefir.constant(newValue);
          } else {
            // load again if loader was changed in the middle of loading
            return this.load();
          }
        })
        .mapErrors(error => {
          this.loaded = true;
          this.error = error;
          console.error(error);
          return error;
        });
      return this.loadingExtension;
    }
  }

  loadAndUpdate(component: { forceUpdate(): void }, cancellation: Cancellation) {
    const updateWhenLoaded = () => component.forceUpdate();
    cancellation.map(this.load()).observe({
      value: updateWhenLoaded,
      error: updateWhenLoaded,
    });
  }

  chainLoader(loader: (previous: T | undefined) => Kefir.Stream<T>) {
    const previousValue = this.value;
    const previousLoader = this.loader;
    this.loader = () => {
      return (
        previousValue ? loader(previousValue) :
        previousLoader().flatMap(loader)
      );
    };
    this.loaded = false;
    this.value = undefined;
    this.error = undefined;
    this.loadingExtension = undefined;
  }

  chainLoaderPromise(loader: (previous: T | undefined) => Promise<T>) {
    this.chainLoader(previous => Kefir.fromPromise(loader(previous)));
  }
}
