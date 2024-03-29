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

const webpack = require('webpack');
const defaultsFn = require('./defaults');

/**
 * @param {{ [key: string]: string }} env
 */
module.exports = function (env) {
  const defaults = defaultsFn();
  const config = require('./webpack.config.js')(defaults, {buildMode: 'prod'});

  // Reset source-maps
  delete config.devtool;

  /** @type {Set<string>} */
  const stableBundleNames = new Set();
  for (const project of defaults.WEB_PROJECTS) {
    if (project.stableEntryNames) {
      for (const entryName of project.stableEntryNames) {
        stableBundleNames.add(entryName);
      }
    }
  }

  // Add chunk hash to filename to make sure that we bust
  // browser cache on redeployment
  config.output.filename = function (chunkData) {
    return stableBundleNames.has(chunkData.chunk.name)
      ? '[name]-bundle.js'
      : "[name]-[chunkhash]-bundle.js";
  };
  config.output.chunkFilename = "[name]-[chunkhash]-bundle.js";

    //enable assets optimizations
    config.plugins.push(
        new webpack.LoaderOptionsPlugin({
            // for 'css-loader' v0.28.x, should be unnecessary when we'll upgrade to >= v1.0.0:
            // https://github.com/webpack-contrib/css-loader/blob/master/CHANGELOG.md#100-2018-07-06
            minimize: true
        }),
    );

  // Enable react production mode
  config.plugins.push(
    new webpack.DefinePlugin({
      BUNDLE_HIGHCHARTS: process.env.BUNDLE_HIGHCHARTS,
      'process.env': {
        NODE_ENV: '"production"'
      }
    })
  );
  return config;
};
