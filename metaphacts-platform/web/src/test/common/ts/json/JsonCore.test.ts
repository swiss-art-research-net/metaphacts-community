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
import { expect } from 'chai';

import { serialize, deserialize } from 'platform/api/json';

describe('instance to json serialization', () => {
  describe('plain javascirpt objects serialization', () => {
    it('keeps number unchanged', () => {
      const num = 1;
      expect(
        deserialize(serialize(num))
      ).to.be.equals(num);
    });

    it('keeps string unchanged', () => {
      const str = 'test';
      expect(
        deserialize(serialize(str))
      ).to.be.equals(str);
    });

    it('keeps plain object unchanged', () => {
      const obj = {x: 1};
      expect(
        deserialize(serialize(obj))
      ).to.be.deep.equal(obj);
    });

    it('keeps null unchanged', () => {
      expect(
        deserialize(serialize(null))
      ).to.be.equals(null);
    });

    it('keeps array unchanged', () => {
      const array = [{x: 1}];
      expect(
        deserialize(serialize(array))
      ).to.be.deep.equal(array);
    });
  });
});
