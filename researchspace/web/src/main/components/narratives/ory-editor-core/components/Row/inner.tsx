/*
 * Copyright (C) 2015-2020, © Trustees of the British Museum
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
import * as React from 'react';
import * as classNames from 'classnames';

import Cell from 'ory-editor-core/lib/components/Cell';

const Inner = ({
  editable,
  ancestors,
  node: { id, hover, cells = [], hasInlineChildren },
  containerHeight,
  blurAllCells,
  editMode,
  containerWidth
}: any) => (
  <div
    className={classNames('ory-row', {
      'ory-row-is-hovering-this': Boolean(hover),
      [`ory-row-is-hovering-${hover || ''}`]: Boolean(hover),
      'ory-row-has-floating-children': hasInlineChildren
    })}
    onClick={() => {blurAllCells(); editMode()}}
  >
    {cells.map((c: string) => (
      <Cell
        rowWidth={containerWidth}
        rowHeight={containerHeight}
        ancestors={[...ancestors, id]}
        editable={editable}
        key={c}
        id={c}
      />
    ))}
  </div>
);

export default Inner;
