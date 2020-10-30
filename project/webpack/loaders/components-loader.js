/*
 * Copyright (C) 2015-2018, metaphacts GmbH
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

const _ = require('lodash');

module.exports.default = function(input) {
  const cases = _.reduce(JSON.parse(input), (acc, entry, component) => {
    let path, metadata;
    if (typeof entry === 'string') {
      path = entry;
      metadata = null;
    } else {
      path = entry.path;
      metadata = {...entry};
      delete metadata.path;
    }

    const snippet = `
      case '${component}': return {
        loader: function() {
          return import(/* webpackChunkName: "${component}"*/'${path}')
            .then(function(comp) {
              onLoaded(comp);
              return comp;
            });
        },
        metadata: ${JSON.stringify(metadata)}
      };
    `;
    return acc + snippet;
  }, '');

  return `module.exports = function(tagName) {
    function onLoaded(comp) {
      if (!comp.default) {
        throw new Error('Failed to load component <' + tagName + '>');
      }
      comp.default.__htmlTag = tagName;
    }
    switch (tagName) {
      ${cases}
    }
    return null;
  };`;
};
