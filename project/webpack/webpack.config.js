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

const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const ThreadLoader = require('thread-loader');
const AssetsPlugin = require('assets-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const autoprefixer = require('autoprefixer');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const CircularDependencyPlugin = require('circular-dependency-plugin');

const resolveTheme = require('./theme');

const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

/* Enable this flag to see stack traces for DeprecationWarning log messages: */
/* process.traceDeprecation = true; */

/**
 * @typedef {Object} PlatformWebpackOptions
 * @property {'test' | 'dev' | 'prod'} buildMode
 */

/**
 * @param {ReturnType<import('./defaults')>} defaults
 * @param {PlatformWebpackOptions} platformOptions
 * @returns {import('webpack').Configuration}
 */
module.exports = function (defaults, platformOptions) {
    const {
      WEB_PROJECTS,
      ROOT_DIR,
      METAPHACTORY_ROOT_DIR,
      METAPHACTORY_DIRS,
      DIST,
      TEST_DIRS,
      SRC_DIRS,
      resolveModulePath
    } = defaults;
    const {buildMode} = platformOptions;

    console.log('Building the following web projects: ' + WEB_PROJECTS.map(p => p.name).join(', '));

    /** @type {{ [entryKey: string]: Array<string> }} */
    const entries = {};
    /** @type {Array<string>} */
    let extensions = [];
    /** @type {Array<string>} */
    const cssModulesBasedComponents = [];
    /**
     * Mapping from schemaName -> import path for JSON file
     * @type {{ [schemaName: string]: string }}
     */
    const jsonSchemas = {};
    /** @type {{ [componentTag: string]: string | import('./defaults').ComponentMetadata }} */
    const components = {};

    /**
     * @param {import('./defaults').WebProject} project
     * @param {string} schemaName
     */
    const addJsonSchema = (project, schemaName) => {
      const schemaPath = `${project.schemasAlias}/${schemaName}.json`;
      jsonSchemas[schemaName] = schemaPath;
    };

    for (const project of WEB_PROJECTS) {
      if (project.entries) {
        Object.keys(project.entries).forEach(key => {
          const entryPath = project.entries[key];
          entries[key] = [resolveModulePath(project, entryPath)];
        });
      }

      if (project.cssModulesBasedComponents) {
        for (const componentDir of project.cssModulesBasedComponents) {
          cssModulesBasedComponents.push(
            path.resolve(project.webDir, componentDir)
          );
        }
      }

      if (project.extensions) {
        extensions = [...extensions, ...project.extensions];
      }

      if (project.generatedJsonSchemas) {
        for (const entry of project.generatedJsonSchemas) {
          addJsonSchema(project, typeof entry === 'object' ? entry.schemaName : entry);
        }
      }

      const componentsJsonPath = path.join(project.webDir, 'component.json');
      if (fs.existsSync(componentsJsonPath)) {
        /** @type {typeof components} */
        const componentsJson = JSON.parse(fs.readFileSync(componentsJsonPath, 'utf8'));
        Object.assign(components, componentsJson);

        for (const componentName of Object.keys(componentsJson)) {
          const metadata = componentsJson[componentName];
          if (typeof metadata === 'object') {
            if (metadata.propsSchema) {
              addJsonSchema(project, metadata.propsSchema);
            }
            if (metadata.additionalSchemas) {
              for (const schemaName of metadata.additionalSchemas) {
                addJsonSchema(project, schemaName);
              }
            }
          }
        }
      }
    }

    // generate combined .mp-extensions JSON
    fs.writeFileSync(path.join(__dirname, '.mp-extensions'), JSON.stringify(extensions), 'utf8');
    // generate combined .mp-components JSON
    fs.writeFileSync(path.join(__dirname, '.mp-components'), JSON.stringify(components), 'utf8');
    // generate combined .mp-schemas JSON
    fs.writeFileSync(path.join(__dirname, '.mp-schemas'), JSON.stringify(jsonSchemas), 'utf8');

    const {themeDir} = resolveTheme(defaults);
    console.log('Using theme directory: ' + themeDir);

    const threadLoaderOptions = {
      name: 'mp-thread-loader-pool',
    };
    const threadLoader = {
      loader: 'thread-loader',
      options: threadLoaderOptions,
    };

    ThreadLoader.warmup(threadLoaderOptions, [
      'ts-loader',
      'style-loader',
      'typings-for-css-modules-loader',
      'postcss-loader',
      'sass-loader',
      'css-loader',
    ]);

    /** @type {import('webpack').Configuration} */
    const config = {
        bail: buildMode === 'prod',
        mode: buildMode === 'prod' ? 'production' : 'development',
        resolveLoader: {
            modules: [path.resolve(__dirname, 'node_modules'), __dirname]
        },
        cache: true,
        entry: entries,
        output: {
            path: DIST,
            filename: '[name]-bundle.js',
            chunkFilename: '[name]-bundle.js',
            publicPath: '/assets/',
            crossOriginLoading: 'anonymous'
        },
        module: {
            /** @type {any[]} */
            rules: [
                {
                  test: /(\.ts$)|(\.tsx$)/,
                  use: [
                    threadLoader,
                    {
                      loader: 'ts-loader',
                      options: {
                        happyPackMode: true,
                        transpileOnly: true,
                        compilerOptions: buildMode === 'dev' ? {
                          sourceMap: true,
                        } : undefined,
                      }
                    }
                  ]
                },
                {
                  test: /\.scss$/,
                  include: cssModulesBasedComponents,
                  use: [
                    threadLoader,
                    'style-loader',
                    {
                      loader: 'typings-for-css-modules-loader',
                      options: {
                        modules: true,
                        importLoaders: 2,
                        localIdentName: '[name]--[local]',
                        namedExport: true,
                        camelCase: true,
                      }
                    },
                    'postcss-loader',
                    {
                      loader: 'sass-loader',
                      options: {
                        outputStyle: 'expanded'
                      }
                    },
                  ],
                },
                {
                  test: /\.scss$/,
                  exclude: [cssModulesBasedComponents],
                  use: [
                    threadLoader,
                    'style-loader',
                    {
                      loader: 'css-loader',
                      options: {
                        importLoaders: 2,
                      }
                    },
                    'postcss-loader',
                    {
                      loader: 'sass-loader',
                      options: {
                        outputStyle: 'expanded'
                      }
                    },
                  ]
                },
                {
                  test: /\.css$/,
                  use: [
                    threadLoader,
                    'style-loader',
                    'css-loader'
                  ]
                },
                {
                    test: /\.mp-components$/,
                    use: [{loader: 'loaders/components-loader'}],
                    exclude: [/node_modules/]
                },
                {
                    test: /\.mp-extensions$/,
                    use: [{loader: 'loaders/extensions-loader'}],
                    exclude: [/node_modules/]
                },
                {
                    test: /\.mp-schemas$/,
                    use: [{loader: 'loaders/schemas-loader'}],
                    exclude: [/node_modules/]
                },

                {
                    test: /\.png$/,
                    use: [{
                        loader: 'url-loader',
                        options: {
                            limit: 100000,
                            mimetype: 'image/png'
                        }
                    }]
                },
                {
                    test: /\.gif$/,
                    loader: "file-loader"
                },

                // exclude highcharts
                {
                    test: /react\-highcharts\/dist\/ReactHighcharts\.js/,
                    use: process.env.BUNDLE_HIGHCHARTS ? [] : [{
                        loader: 'noop-loader'
                    }],
                    exclude: [/node_modules/]
                },
                {
                    test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                    use: [{
                        loader: 'url-loader',
                        options: {
                            limit: 10000,
                            mimetype: 'application/font-woff'
                        }
                    }]
                },
                {
                    test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                    loader: "file-loader",
                },
                {
                    test: path.join(METAPHACTORY_ROOT_DIR, 'node_modules/codemirror/lib/codemirror.js'),
                    loader: "expose-loader?CodeMirror"
                },
              ]
        },
        resolve: {
            modules: ['node_modules'].concat(
              WEB_PROJECTS.map(project => path.resolve(project.webDir, 'node_modules'))
            ),
            unsafeCache: true,
            alias: Object.assign(
              defaults.ALIASES,
              {
                'platform-components': path.join(__dirname, '.mp-components'),
                'platform-extensions': path.join(__dirname, '.mp-extensions'),
                'platform-schemas': path.join(__dirname, '.mp-schemas'),
                'platform-theme': themeDir,
                'platform-tests': METAPHACTORY_DIRS.test,
                'basil.js': 'basil.js/src/basil.js',
                'handlebars': 'handlebars/dist/handlebars.js',
                'jsonld': path.join(METAPHACTORY_ROOT_DIR, 'node_modules/jsonld/dist/jsonld.js'),
                'tslib': path.join(METAPHACTORY_ROOT_DIR, 'node_modules/tslib/tslib.es6.js'),
                // workaround: properly resolve React and React-DOM for Ontodia
                'react': path.join(METAPHACTORY_ROOT_DIR, 'node_modules/react'),
                'react-dom': path.join(METAPHACTORY_ROOT_DIR, 'node_modules/react-dom'),
              },
            ),
            extensions: ['.ts', '.tsx', '.js']
        },
        externals: {
            'google': 'false',
        },
        optimization: {
          minimize: buildMode === 'prod',
          minimizer: buildMode === 'prod' ? [
            new TerserPlugin({
              extractComments: false,
              terserOptions: {
                output: {
                  comments: false,
                }
              }
            })
          ] : [],
        },
        plugins: [
          // order matters see karma.config.js
          new webpack.DllReferencePlugin({
              /** @type {any} */
              manifest: require("./assets/dll-manifest/vendor-manifest.json"),
              context: path.resolve(METAPHACTORY_DIRS.src)
          }),
          new webpack.DllReferencePlugin({
              /** @type {any} */
              manifest: require("./assets/dll-manifest/basic_styling-manifest.json"),
              context: path.resolve(METAPHACTORY_DIRS.src)
          }),

          new webpack.LoaderOptionsPlugin({
              options: {
                  postcss: [
                      autoprefixer({
                          browsers: [
                              'last 3 version',
                              'ie >= 10',
                          ]
                      }),
                  ],
                  context: METAPHACTORY_DIRS.src
              }
          }),

          //cytoscape.js expects jquery in scope
          new webpack.ProvidePlugin({
              'cytoscape': 'cytoscape',
              '$': 'jquery',
              'jQuery': "jquery"
          }),

            //do not bundle mirador images
          new webpack.NormalModuleReplacementPlugin(/\.\/images\/ui-.*/, 'node-noop'),

          new webpack.WatchIgnorePlugin([
              /scss\.d\.ts$/
          ]),

          // new BundleAnalyzerPlugin(),

          /*
            * Generate json files with bundle - hashed bundle file names,
            * so we can properly refer to bundles in main.hbs and login.hbs files
            */
          new AssetsPlugin({
            // TODO: use this generated file even in local dev builds
            filename: 'bundles-manifest.json',
            path: defaults.DIST
          }),

          // @ts-ignore
          new CircularDependencyPlugin({
            // exclude detection of files based on a RegExp
            exclude: /node_modules/,
            // add errors to webpack instead of warnings
            failOnError: true,
            // allow import cycles that include an asyncronous import,
            // e.g. via import(/* webpackMode: "weak" */ './file.js')
            allowAsyncCycles: true,
            // set the current working directory for displaying module paths
            cwd: process.cwd(),
          }),
        ],
        watchOptions: {
          ignored: '**/node_modules',
        },
    };

    if (!(buildMode === 'dev' && defaults.ROOT_BUILD_CONFIG.noTsCheck)) {
      config.plugins.push(new ForkTsCheckerWebpackPlugin({
        async: buildMode === 'dev',
        typescript: {
          configFile: path.resolve(__dirname, '../../tsconfig.json'),
          diagnosticOptions: {
            syntactic: true,
            semantic: true,
          }
        },
      }));
    }

    return config;
};
