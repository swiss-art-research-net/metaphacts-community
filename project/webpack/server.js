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

// @ts-ignore
process.env.BUNDLE_HIGHCHARTS = true;

const path = require('path');
const compress = require('koa-compress');
/** @type {any} - wrong type due to old webpack-serve version */
const serve = require('webpack-serve');
const WebSocket = require('ws');
const devConfig = require('./webpack.dev.config');
const defaults = require('./defaults.js');

const config = devConfig(defaults());

const devServer = serve({
  config: config,
  hot: false,
  port: 3000,
  content: [__dirname, path.join(__dirname, "assets", "no_auth"), path.join(__dirname, "assets")],
  clipboard: false,
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
      errorDetails: true,
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

devServer.then(server => {
  /** @type {WebSocket.Server} */
  let socketServer;
  const stopServer = () => {
    console.log('Received stop request. Attempting to terminate webpack process.');
    socketServer.close();
    server.close();
    process.exit(0);
  };

  server.on('listening', ({ server, options }) => {
    console.log('Webpack server listening at localhost:3000');

    socketServer = new WebSocket.Server({port: 3001});
    console.log('Socket server listening on localhost:3001');
    socketServer.on('connection', ws => {
      ws.on('message', message => {
        if (message === 'stop') {
          stopServer();
        }
      });
    });
  });

  process.stdin.on('data', chunk => {
    if (chunk === 'stop') {
      stopServer();
    }
  });
});

process.stdin.resume();
process.stdin.setEncoding('utf8');
