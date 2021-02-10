const HtmlMinimizerPlugin = require('html-minimizer-webpack-plugin');
const webpack = require('webpack');
const slsw = require('serverless-webpack');
const nodeExternals = require('webpack-node-externals');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: slsw.lib.entries,
  externals: [nodeExternals()],
  target: 'node',
  plugins: [new CopyPlugin({ patterns: ['src/**/*.html'] })],
  optimization: {
    minimize: true,
    minimizer: [new HtmlMinimizerPlugin()],
  },
};
