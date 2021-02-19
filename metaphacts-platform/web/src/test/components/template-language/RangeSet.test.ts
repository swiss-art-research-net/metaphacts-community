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
import { expect, assert } from 'chai';

import { RangeSet } from 'platform/components/3-rd-party/monaco/RangeSet';

describe('Template Language Service', () => {
  describe('RangeSet', () => {
    it('maintains non-overlapping ranges after insert', () => {
      const set = new RangeSet();
      set.insert(2, 5);
      set.insert(10, 17);
      set.insert(1, 3);
      expect(set.rangePoints).to.be.eql([1, 5, 10, 17]);

      set.insert(3, 10);
      expect(set.rangePoints).to.be.eql([1, 17]);

      set.insert(20, 30);
      set.insert(-10, -4);
      expect(set.rangePoints).to.be.eql([-10, -4, 1, 17, 20, 30]);

      set.insert(-8, -6);
      expect(set.rangePoints).to.be.eql([-10, -4, 1, 17, 20, 30]);

      set.insert(-5, 18);
      expect(set.rangePoints).to.be.eql([-10, 18, 20, 30]);

      set.insert(30, 32);
      expect(set.rangePoints).to.be.eql([-10, 18, 20, 32]);

      set.insert(30, 32);
      expect(set.rangePoints).to.be.eql([-10, 18, 20, 32]);

      set.insert(19, 20);
      expect(set.rangePoints).to.be.eql([-10, 18, 19, 32]);
    });

    it('find if target range overlaps with any one from the set', () => {
      const set = new RangeSet();
      set.insert(-10, -4);
      set.insert(1, 2);
      set.insert(10, 17);
      set.insert(20, 30);
      expect(set.rangePoints).to.be.eql([-10, -4, 1, 2, 10, 17, 20, 30]);

      // simple test in the middle or outside ranges
      assert(!set.intersectsRange(5, 5), '5 is not inside set');
      assert(set.intersectsRange(12, 12), '12 is inside set');
      assert(set.intersectsRange(-7, -7), '-7 is inside set');
      assert(!set.intersectsRange(-20, -20), '-20 is not inside set');
      assert(!set.intersectsRange(40, 40), '40 is not inside set');

      // test points on the beginning or the end of ranges
      assert(set.intersectsRange(-10, -10), '-10 is inside set');
      assert(!set.intersectsRange(-4, -4), '-4 is not inside set');
      assert(!set.intersectsRange(-2, -2), '-2 is not inside set');
      assert(set.intersectsRange(10, 10), '10 is inside set');
      assert(!set.intersectsRange(30, 30), '10 is not inside set');

      // test range intersections
      assert(set.intersectsRange(-20, 40), '[-20, 40) does intersect');
      assert(!set.intersectsRange(2, 4), '[2, 4) does not intersect');
      assert(set.intersectsRange(6, 12), '[6, 12) does intersect');
      assert(set.intersectsRange(11, 14), '[11, 14) does intersect');
      assert(!set.intersectsRange(18, 19), '[18, 19) does not intersect');
      assert(set.intersectsRange(5, 19), '[5, 19) does intersect');
    });
  });
});
