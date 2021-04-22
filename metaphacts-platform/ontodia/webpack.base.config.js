const path = require('path');

var cssModulesDir = path.join(__dirname, 'src');

module.exports = {
    resolve: {
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
