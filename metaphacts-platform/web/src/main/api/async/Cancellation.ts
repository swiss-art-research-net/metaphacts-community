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
import * as Kefir from 'kefir';
import { useEffect, useRef } from 'react';

/**
 * Utility object to propagate Kefir.Observable deactivation (cancellation).
 *
 * @example
 *
 * const cancellation = new Cancellation();
 *
 * const taskA = cancellation.map(query(...))
 *  .onValue(value => { [only called if not cancelled] });
 * const taskB = cancellation.map(query(...));
 *
 * // ends all mapped observables (taskA, taskB, taskC)
 * cancellation.cancelAll();
 *
 * @author Alexey Morozov
 */
export class Cancellation {
  static readonly cancelled = new Cancellation();

  private isCancelled = false;
  private cancelHandlers: Array<() => void> = [];

  get aborted() {
    return this.isCancelled;
  }

  /**
   * Wraps observable as another which produces the same values and errors,
   * unsubscribes from source and ends when .cancelAll() invoked.
   */
  map<T>(observable: Kefir.Observable<T>): Kefir.Property<T> {
    if (this.isCancelled) {
      return Kefir.never<T>().toProperty();
    }
    const {observable: mapped, dispose} = subscribe(observable);
    this.onCancel(dispose);
    return mapped.toProperty();
  }

  /**
   * Creates derived Cancellation which becomes cancelled when parent is cancelled.
   *
   * @deprecated This method may cause memory leaks when creating many derived cancellations.
   */
  derive(): Cancellation {
    const derived = new Cancellation();
    if (!this.isCancelled) {
      this.onCancel(() => derived.cancelAll());
    }
    return derived;
  }

  /**
   * Convenient method to cancel token and replace it with a newly derived one.
   *
   * @deprecated This method may cause memory leaks when creating many derived cancellations.
   */
  deriveAndCancel(previous: Cancellation): Cancellation {
    previous.cancelAll();
    // tslint:disable-next-line: deprecation
    return this.derive();
  }

  /**
   * Register handler which is invoked when this Cancellation
   * becomes cancelled or if it was already cancelled.
   */
  onCancel(handler: () => void) {
    if (this.isCancelled) {
      handler();
    } else {
      this.cancelHandlers.push(handler);
    }
  }

  /**
   * Unregisters specified handler from cancel notifications.
   */
  offCancel(handler: () => void) {
    if (!this.isCancelled && this.cancelHandlers) {
      const index = this.cancelHandlers.findIndex(handler);
      if (index >= 0) {
        this.cancelHandlers.splice(index, 1);
      }
    }
  }

  /**
   * Makes this Cancellation cancelled and ends all wrapped observables.
   */
  cancelAll() {
    if (this.isCancelled) { return; }
    this.isCancelled = true;
    for (const onCancel of this.cancelHandlers) {
      onCancel();
    }
    this.cancelHandlers = undefined;
  }
}

function subscribe<T>(source: Kefir.Observable<T>): {
  observable: Kefir.Stream<T>;
  dispose: () => void;
} {
  if (!source) { throw new Error('source observable must be present'); }

  let disposed = false;
  let subscription: Kefir.Subscription;
  const dispose = () => {
    if (disposed) { return; }
    disposed = true;
    if (subscription) {
      subscription.unsubscribe();
    }
  };

  const observable = Kefir.stream<T>(emitter => {
    if (disposed) {
      emitter.end();
    } else {
      subscription = source.observe({
        value: value => emitter.emit(value),
        error: error => emitter.error(error),
        end: () => emitter.end(),
      });
    }
    return dispose;
  });

  return {observable, dispose};
}

export function useCancellation() {
  const ref = useRef<Cancellation>();
  if (!ref.current) {
    ref.current = new Cancellation();
  }
  useEffect(() => {
    return () => {
      if (ref.current) {
        ref.current.cancelAll();
      }
    };
  }, []);
  return ref.current;
}

Cancellation.cancelled.cancelAll();
