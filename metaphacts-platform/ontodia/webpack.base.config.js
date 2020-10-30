const path = require('path');

// if BUNDLE_PEERS is set, we'll produce bundle with all dependencies
const BUNDLE_PEERS = Boolean(process.env.BUNDLE_PEERS);
// always include IE support in full bundle
const SUPPORT_IE = BUNDLE_PEERS || Boolean(process.env.SUPPORT_IE);

const aliases = {};
if (!SUPPORT_IE) {
    const emptyModule = path.resolve(__dirname, 'src', 'ontodia', 'emptyModule.ts');
    aliases['canvg-fixed'] = emptyModule;
    aliases['es6-promise/auto'] = emptyModule;
}

var cssModulesDir = path.join(__dirname, 'src');

module.exports = {
    resolve: {
        alias: aliases,
        extensions: ['.ts', '.tsx', '.js'],
    },
    module: {
        rules: [
            {test: /\.ts$|\.tsx$/, use: ['ts-loader']},
            {
                // loader for global SCSS styles
                test: /\.scss$/,
                exclude: cssModulesDir,
                use: ['style-loader', 'css-loader', 'sass-loader'],
            },
            {
                // loader for global CSS styles
                test: /\.css$/,
                exclude: cssModulesDir,
                use: ['style-loader', 'css-loader'],
            },
            {
                // loader for per-component SCSS modules
                test: /\.scss$/,
                include: cssModulesDir,
                use: [
                    {loader: 'style-loader'},
                    {
                        loader: 'css-loader',
                        options: {
                            modules: {
                                mode: 'local',
                                localIdentName: 'ontodia-[name]__[local]',
                            }
                        }
                    },
                    {loader: 'sass-loader'},
                ],
            },
            {
                // loader to generate .d.ts files for SCSS modules
                enforce: 'pre',
                test: /\.scss$/,
                include: cssModulesDir,
                use: [
                    {
                        loader: 'typed-css-modules-loader',
                        options: {
                            noEmit: true,
                        }
                    },
                    {loader: 'sass-loader'},
                ],
            },
            {
                test: /\.(jpe?g|gif|png|svg)$/,
                use: [{loader: 'url-loader'}],
            },
            {test: /\.ttl$/, use: ['raw-loader']},
        ]
    },
};
