/*
 * Copyright (C) 2015-2019, metaphacts GmbH
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

import { expect } from 'chai';
import { listen, trigger, _subscribers } from 'platform/api/events';

describe('EventStore', function() {
  beforeEach(function() {
    for (let x in _subscribers) { if (x) { delete _subscribers[x]; }}
  });

  it('listen to events of specific type', function(done) {
    const SOME_EVENT_TYPE = 'SOME_EVENT_TYPE';
    listen({ eventType: SOME_EVENT_TYPE }).onValue(
      event => {
        expect(event.eventType).to.be.equal(SOME_EVENT_TYPE);
        done();
      }
    );
    trigger({ eventType: 'SOME_OTHER_EVENT_TYPE', source: '1' });
    trigger({ eventType: 'SOME_OTHER_EVENT_TYPE', targets: ['1'], source: '2' });
    trigger({ eventType: SOME_EVENT_TYPE, source: '3' });
  });

  it('listen to events triggered by specific source', function(done) {
    listen({ source: '1' }).onValue(
      event => {
        expect(event.source).to.be.equal('1');
        done();
      }
    );
    trigger({ eventType: 'SOME_OTHER_EVENT_TYPE', source: '1' });
    trigger({ eventType: 'SOME_OTHER_EVENT_TYPE', targets: ['1'], source: '2' });
  });

  it('listen to events triggered to specific target', function(done) {
    listen({ target: '1' }).onValue(
      event => {
        expect(event.source).to.be.equal('3');
        done();
      }
    );
    trigger({ eventType: 'SOME_OTHER_EVENT_TYPE', source: '2' });
    trigger({ eventType: 'SOME_OTHER_EVENT_TYPE', targets: ['1'], source: '3' });
  });

  it('listen to events specified by complex filter', function(done) {
    listen({ eventType: 'SOME_EVENT_TYPE', target: '1', source: '2' }).onValue(
      event => {
        expect(event.source).to.be.equal('2');
        expect(event.targets).to.be.deep.equal(['1']);
        done();
      }
    );
    trigger({ eventType: 'SOME_EVENT_TYPE', source: '2', targets: ['5'] });
    trigger({ eventType: 'SOME_OTHER_EVENT_TYPE', targets: ['1'], source: '3' });
    trigger({ eventType: 'SOME_EVENT_TYPE', source: '2', targets: ['1'] });
  });

  it('listen to all events', function(done) {
    let i = 0;
    listen({}).onValue(
      event => {
        i = i + 1;
        if (i === 2) { done(); }
      }
    );
    trigger({ eventType: 'SOME_OTHER_EVENT_TYPE', source: '2' });
    trigger({ eventType: 'SOME_OTHER_EVENT_TYPE', targets: ['1'], source: '3' });
  });

  it('multiple listeners', function(done) {
    let i = 0;
    const SOME_EVENT_TYPE = 'SOME_EVENT_TYPE';
    listen({ eventType: SOME_EVENT_TYPE }).onValue(
      event => {
        expect(event.eventType).to.be.equal(SOME_EVENT_TYPE);
        i = i + 1;
        if (i === 2) { done(); }
      }
    );
    listen({ eventType: SOME_EVENT_TYPE }).onValue(
      event => {
        expect(event.eventType).to.be.equal(SOME_EVENT_TYPE);
        i = i + 1;
        if (i === 2) { done(); }
      }
    );
    trigger({ eventType: 'SOME_OTHER_EVENT_TYPE', source: '1' });
    trigger({ eventType: 'SOME_OTHER_EVENT_TYPE', targets: ['1'], source: '2' });
    trigger({ eventType: SOME_EVENT_TYPE, source: '3' });
  });
});
