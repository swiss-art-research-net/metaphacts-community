var path = require('path');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var baseConfig = require('./webpack.base.config');

var SPARQL_ENDPOINT = process.env.SPARQL_ENDPOINT;
var WIKIDATA_ENDPOINT = process.env.WIKIDATA_ENDPOINT;
var LOD_PROXY = process.env.LOD_PROXY;
var PROP_SUGGEST = process.env.PROP_SUGGEST;

var examplesDir = path.join(__dirname, 'examples');
var htmlTemplatePath = path.join(__dirname, 'examples', 'template.ejs');

module.exports = {
    mode: 'development',
    entry: {
        rdf: path.join(examplesDir, 'rdf.tsx'),
        sparql: path.join(examplesDir, 'sparql.tsx'),
        dbpedia: path.join(examplesDir, 'dbpedia.tsx'),
        sparqlNoStats: path.join(examplesDir, 'sparqlNoStats.tsx'),
        sparqlConstruct: path.join(examplesDir, 'sparqlConstruct.tsx'),
        sparqlRDFGraph: path.join(examplesDir, 'sparqlRDFGraph.tsx'),
        sparqlTurtleGraph: path.join(examplesDir, 'sparqlTurtleGraph.tsx'),
        styleCustomization: path.join(examplesDir, 'styleCustomization.tsx'),
        wikidata: path.join(examplesDir, 'wikidata.tsx'),
        composite: path.join(examplesDir, 'composite.tsx'),
        wikidataGraph: path.join(examplesDir, 'wikidataGraph.tsx'),
        toolbarCustomization: path.join(examplesDir, 'toolbarCustomization.tsx'),
    },
    resolve: baseConfig.resolve,
    module: baseConfig.module,
    devtool: 'source-map',
    optimization: {
        splitChunks: {
            cacheGroups: {
                commons: {
                    name: 'commons',
                    chunks: 'initial',
                    minChunks: 2,
                }
            }
        },
    },
    output: {
        path: path.join(__dirname, 'dist', 'examples'),
        filename: '[name].bundle.js',
        chunkFilename: '[id].chunk.js',
        publicPath: '',
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: 'Ontodia RDF Demo',
            chunks: ['commons', 'rdf'],
            template: htmlTemplatePath,
        }),
        new HtmlWebpackPlugin({
            filename: 'sparql.html',
            title: 'Ontodia SparQL Demo',
            chunks: ['commons', 'sparql'],
            template: htmlTemplatePath,
        }),
        new HtmlWebpackPlugin({
            filename: 'dbpedia.html',
            title: 'Ontodia DBPedia SparQL Demo',
            chunks: ['commons', 'dbpedia'],
            template: htmlTemplatePath,
        }),
        new HtmlWebpackPlugin({
            filename: 'sparqlNoStats.html',
            title: 'Ontodia SparQL Demo',
            chunks: ['commons', 'sparqlNoStats'],
            template: htmlTemplatePath,
        }),
        new HtmlWebpackPlugin({
            filename: 'sparqlConstruct.html',
            title: 'Ontodia SparQL Construct Demo',
            chunks: ['commons', 'sparqlConstruct'],
            template: htmlTemplatePath,
        }),
        new HtmlWebpackPlugin({
            filename: 'sparqlRDFGraph.html',
            title: 'Ontodia SparQL RDF Graph Demo',
            chunks: ['commons', 'sparqlRDFGraph'],
            template: htmlTemplatePath,
        }),
        new HtmlWebpackPlugin({
            filename: 'sparqlTurtleGraph.html',
            title: 'Ontodia SparQL Turtle Graph Demo',
            chunks: ['commons', 'sparqlTurtleGraph'],
            template: htmlTemplatePath,
        }),
        new HtmlWebpackPlugin({
            filename: 'styleCustomization.html',
            title: 'Ontodia Style Customization Demo',
            chunks: ['commons', 'styleCustomization', ],
            template: htmlTemplatePath,
        }),
        new HtmlWebpackPlugin({
            filename: 'wikidata.html',
            title: 'Ontodia Wikidata Demo',
            chunks: ['commons', 'wikidata', ],
            template: htmlTemplatePath,
        }),
        new HtmlWebpackPlugin({
            filename: 'wikidataGraph.html',
            title: 'Ontodia Wikidata with graph Demo',
            chunks: ['commons', 'wikidataGraph', ],
            template: htmlTemplatePath,
        }),
        new HtmlWebpackPlugin({
            filename: 'composite.html',
            title: 'Ontodia composite DP Demo',
            chunks: ['commons', 'composite'],
            template: htmlTemplatePath,
        }),
        new HtmlWebpackPlugin({
            filename: 'toolbarCustomization.html',
            title: 'Ontodia Toolbar Customization Demo',
            chunks: ['commons', 'toolbarCustomization'],
            template: htmlTemplatePath,
        }),
    ],
    devServer: {
        contentBase: './dist',
        proxy: {
            '/sparql**': {
                target: SPARQL_ENDPOINT,
                pathRewrite: {'/sparql' : ''},
                changeOrigin: true,
                secure: false,
            },
            '/wikidata**': {
                target: WIKIDATA_ENDPOINT || SPARQL_ENDPOINT,
                pathRewrite: {'/wikidata' : ''},
                changeOrigin: true,
                secure: false,
            },
            '/lod-proxy/**': {
                target: LOD_PROXY,
                changeOrigin: true,
                secure: false,
            },
            '/wikidata-prop-suggest**': {
                target: PROP_SUGGEST,
                pathRewrite: {'/wikidata-prop-suggest' : ''},
                changeOrigin: true,
                secure: false,
            },
        },
    }
};
