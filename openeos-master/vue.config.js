const webpack = require('webpack')
const path = require('path')

module.exports = {
  publicPath: './',
  filenameHashing: false,
  transpileDependencies: ['vuetify'],
  configureWebpack: {
    optimization: {
      splitChunks: false,
    },
    plugins: [
      new webpack.ProvidePlugin({
        acorn: path.resolve(path.join(__dirname, 'src/interpreter/acorn.js')),
      }),
    ],
    module: {
      rules: [
        {
          test: /interpreter\/polyfills\/.*\.js$/,
          use: 'raw-loader',
        },
        {
          test: /\.worker\.js$/,
          loader: 'worker-loader',
          options: {
            /* ... */
          },
        },
      ],
    },
  },
  css: {
    extract: false,
  },
}
