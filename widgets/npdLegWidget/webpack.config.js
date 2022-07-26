const path = require('path');
const glob = require("glob");

module.exports = [{
  mode: 'production',
  entry: {
    'NpdLegWidget': glob.sync('build/static/+(js|css)/*.+(js|css)').map(f => path.resolve(__dirname, f)),
  },
  output: {
    path: path.join(__dirname, '..', '..', 'dist/widgets/'),
    filename: `[name].bundle.min.js`,
    compareBeforeEmit: false
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  optimization: {
    minimize: true,
    minimizer: [compiler => {
      const TerserPlugin = require('terser-webpack-plugin');
      new TerserPlugin({
        terserOptions: {
          compress: {}
        }
      }).apply(compiler);
    }],
  },
}];