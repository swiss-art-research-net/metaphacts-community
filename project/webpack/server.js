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

// @ts-nocheck

process.env.BUNDLE_HIGHCHARTS = true;

var path = require("path");
var _ = require('lodash');
const compress = require('koa-compress');
var devConfig = require('./webpack.dev.config');
const serve = require('webpack-serve');
const defaults = require('./defaults.js');
const utils = require('./utils');

const config = devConfig(defaults());

const devServer = serve({
  config: config,
  hot: false,
  port: 3000,
  content: [__dirname, path.join(__dirname, "assets", "no_auth"), path.join(__dirname, "assets")],
  dev: {
    publicPath: 'http://localhost:3000/assets/',
    filename: config.output.filename,

    // It suppress error shown in console, so it has to be set to false.
    quiet: false,
    // It suppress everything except error, so it has to be set to false as well
    // to see success build.
    noInfo: false,
    //lazy: true,
    stats: {
      // Config for minimal console.log mess.
      assets: false,
      colors: true,
      version: false,
      hash: false,
      timings: false,
      chunks: false,
      chunkModules: false,
      // Displays log on module resolution errors
      errorDetails: true
    }
  },
  add: (app, middleware) => {
    app.use(compress());
    app.use(async (ctx, next) => {
      await next();
      ctx.set('Access-Control-Allow-Origin', '*');
    });
  }
});

devServer.then((server) => {
  server.on('listening', ({ server, options }) => {
    console.log('Listening at localhost:3000');
  });

  process.stdin.on('data', function(chunk) {
    if(chunk === 'stop') {
      server.close();
      process.exit(0);
    }
  });

});

process.stdin.resume();
process.stdin.setEncoding('utf8');
