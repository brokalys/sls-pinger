const webpack = require('webpack');
const slsw = require('serverless-webpack');
const nodeExternals = require('webpack-node-externals');
require('dotenv').config();

const env = Object.entries(process.env).reduce(
  (common, [key, value]) => ({
    ...common,
    [`process.env.${key}`]: JSON.stringify(value),
  }),
  {},
);

module.exports = {
  mode: 'development',
  entry: slsw.lib.entries,
  externals: [nodeExternals()],
  target: 'node',
  plugins: [new webpack.DefinePlugin(env)],
};
