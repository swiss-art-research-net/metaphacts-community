/*
 * Copyright (C) 2015-2019, © Trustees of the British Museum
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

import { WebDriver } from 'selenium-webdriver';
import { Test } from 'tap';
import { Options } from '../../options';
import { testSearch } from '../util';
import { sameSets } from '../../util';

/**
 * @author Artem Kozlov <ak@metaphacts.com>
 */
export async function test_15(driver: WebDriver, test: Test, options: Options) {
  await test.test(
    '15) Find: Actors refers to USSR or Russia Europe and performed action at Year 1700 AD - Year 2000 AD',
    async (t: Test) => await testSearch(driver, t, options, async (s, d) => {
      await s.setDomain('Actor');
      await s.setRange('Place');
      await s.setRelation('refers to');
      await s.typeRange('ussr');
      await s.toggleRangeNode('USSR');
      await s.submitRangeTree();

      const c1 = await s.getLastClause();
      await s.addOrClause(c1);
      await s.typeRange('russia');
      await s.toggleRangeNode('Russia Europe');
      await s.submitRangeTree();

      await s.addAndClause(c1);
      await s.setRange('Time');
      await s.setRelation('performed action at');
      await s.setDateFormat('YearRange');
      await s.setYearRange('1700/AD', '2000/AD');

      const results = await s.getSearchResults();
      await sameSets(t, results, await d.readData('15'));
    }));
}
