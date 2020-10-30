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
import * as Immutable from 'immutable';

interface FetchResult<Input, Output> {
  inputs: Immutable.Set<Input>;
  batch?: Immutable.Map<Input, Output>;
  error?: any;
}

const DEFAULT_INTERVAL_MS = 20;
const DEFAULT_BATCH_SIZE = 100;

/**
 * Combines multiple async request in a single batch by buffering
 * them using {@Kefir.Stream.bufferWithTimeOrCount}.
 *
 * @author Alexey Morozov
 */
export class BatchedPool<Input, Output> {
  private emitter: Kefir.Emitter<Input>;
  private bufferedStream: Kefir.Stream<FetchResult<Input, Output>>;

  readonly batchSize: number;

  constructor(params: {
    fetch: (inputs: Immutable.Set<Input>) => Kefir.Property<Immutable.Map<Input, Output>>;
    batchSize?: number;
    delayIntervalMs?: number;
  }) {
    const {
      batchSize = DEFAULT_BATCH_SIZE,
      delayIntervalMs = DEFAULT_INTERVAL_MS,
    } = params;

    this.batchSize = batchSize;

    const stream = Kefir.stream<Input>(
      emitter => { this.emitter = emitter; });
    this.bufferedStream = stream
      .bufferWithTimeOrCount(delayIntervalMs, batchSize)
      .filter(inputs => inputs.length > 0)
      .flatMap<FetchResult<Input, Output>>(inputArray => {
        const inputs = Immutable.Set(inputArray);
        return params.fetch(inputs)
          .map(batch => ({inputs, batch}))
          .flatMapErrors<any>(error => Kefir.constant({inputs, error}));
      })
      .onEnd(() => { /* to activate stream */ });
  }

  query(input: Input): Kefir.Property<Output> {
    this.emitter.emit(input);
    return this.bufferedStream
      .filter(result => result.inputs.has(input))
      .flatMap<Output>(result => {
        if (result.batch) {
          return Kefir.constant(result.batch.get(input));
        } else {
          return Kefir.constantError<any>(result.error);
        }
      }).take(1).takeErrors(1).toProperty();
  }
}
