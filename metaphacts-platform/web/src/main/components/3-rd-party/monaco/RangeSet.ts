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
/**
 * Set of non-overlapping integer ranges.
 */
export class RangeSet {
  // [p0, p1, p2, p3, etc] where [p0..p1), [p2..p3), etc are ranges
  private readonly points: number[] = [];

  get rangePoints(): ReadonlyArray<number> {
    return this.points;
  }

  insert(start: number, end: number): void {
    if (start >= end) {
      throw new Error('Range start must be strictly less than end');
    }
    const {points} = this;
    if (points.length === 0 || start > points[points.length - 1]) {
      points.push(start, end);
      return;
    } else if (end < points[0]) {
      points.unshift(start, end);
      return;
    }

    // find range at "start" or next one
    // where "startIndex" is start point index for range at "start"
    let startIndex = Math.max(this.findIndexForOffset(start), 0);
    if (!RangeSet.isRangeStart(startIndex)) {
      if (points[startIndex] === start) {
        startIndex--;
      } else {
        startIndex++;
      }
    }
    // find range at "end" or previous one
    // where "endIndex" is start (!) point index for range at "end"
    let endIndex = Math.max(this.findIndexForOffset(end), 0);
    if (!RangeSet.isRangeStart(endIndex)) {
      endIndex--;
    }

    // define new range which includes leftovers from start/end intersections
    const newStart = Math.min(start, points[startIndex]);
    const newEnd = Math.max(end, points[endIndex + 1]);
    // replace all intersecting ranges by the new one
    const deleteCount = endIndex - startIndex + 2;
    points.splice(startIndex, deleteCount, newStart, newEnd);
  }

  intersectsRange(start: number, end: number): boolean {
    const {points} = this;
    if (points.length === 0 || end < points[0] || start >= points[points.length - 1]) {
      return false;
    }
    const startIndex = this.findIndexForOffset(start);
    const endIndex = this.findIndexForOffset(end);
    // either crosses range border or fully inside range
    return startIndex !== endIndex || RangeSet.isRangeStart(startIndex);
  }

  private static isRangeStart(index: number): boolean {
    return index % 2 === 0;
  }

  /**
   * Returns first index `i` such that the invariant holds:
   * ```
   *   -1 <= i < starts.length &&
   *   points[i] <= offset && offset < points[i + 1]
   * ```
   */
  private findIndexForOffset(offset: number): number {
    const {points} = this;
    let low = -1;
    let high = points.length - 1;
    while (low + 1 < high) {
      // tslint:disable-next-line: no-bitwise
      const mid = low + ((high - low) >> 1);
      if (points[mid] > offset) {
        high = mid;
      } else {
        low = mid;
      }
    }
    return points[high] > offset ? low : high;
  }
}
