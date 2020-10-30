const path = require('path');
var baseConfig = require('./webpack.base.config');

// if BUNDLE_PEERS is set, we'll produce bundle with all dependencies
const BUNDLE_PEERS = Boolean(process.env.BUNDLE_PEERS);
// always include IE support in full bundle
const SUPPORT_IE = BUNDLE_PEERS || Boolean(process.env.SUPPORT_IE);

module.exports = {
    mode: BUNDLE_PEERS ? 'production' : 'none',
    entry: './src/ontodia/index.ts',
    resolve: baseConfig.resolve,
    module: baseConfig.module,
    output: {
        path: path.join(__dirname, 'dist'),
        filename: (
            BUNDLE_PEERS ? 'ontodia-full.min.js' :
            SUPPORT_IE ? 'ontodia-ie.js' :
            'ontodia.js'
        ),
        library: 'Ontodia',
        libraryTarget: 'umd',
    },
    devtool: 'source-map',
    externals: BUNDLE_PEERS ? [] : [
        'd3-color',
        'file-saverjs',
        'lodash',
        'n3',
        'react',
        'react-dom',
        'webcola',
        'whatwg-fetch',
    ],
    performance: {
        maxEntrypointSize: 2048000,
        maxAssetSize: 2048000,
    },
};
