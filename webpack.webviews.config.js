const path = require('path');

module.exports = {
  entry: {
    TaskDetailPanel: './src/webviews/TaskDetailPanel.tsx',
    StatusSelector: './src/webviews/StatusSelector.tsx',
    QuickActions: './src/webviews/QuickActions.tsx'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'out/webviews'),
    library: {
      type: 'var',
      name: '[name]'
    }
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx']
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  target: 'web',
  optimization: {
    minimize: false // Keep readable for debugging
  },
  externals: {
    // VSCode API is provided by the webview environment
    vscode: 'commonjs vscode'
  },
  plugins: []
};
