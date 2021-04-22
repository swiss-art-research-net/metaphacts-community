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
const WebpackNotifierPlugin = require('webpack-notifier');
const ProgressBarPlugin = require('progress-bar-webpack-plugin');
const defaultsFn = require('./defaults');

/**
 * @param {{ [key: string]: string }} env
 */
module.exports = function (env) {
  const defaults = defaultsFn();
  const config = require('./webpack.config.js')(defaults, {buildMode: 'dev'});

  config.plugins.push(
    new webpack.DefinePlugin({
      BUNDLE_HIGHCHARTS: process.env.BUNDLE_HIGHCHARTS
    }),
    new webpack.SourceMapDevToolPlugin({
      columns: false
    }),
    // @ts-ignore
    new ProgressBarPlugin(),
    new WebpackNotifierPlugin({title: 'Platform', excludeWarnings: true})
  );

  config.output.publicPath = 'http://localhost:3000/assets/';
  return config;
};
