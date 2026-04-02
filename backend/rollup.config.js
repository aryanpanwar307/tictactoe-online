const resolve = require('@rollup/plugin-node-resolve');
const commonJS = require('@rollup/plugin-commonjs');
const typescript = require('@rollup/plugin-typescript');

module.exports = {
  input: 'main.ts',
  output: {
    file: 'build/index.js'
  },
  plugins: [
    resolve(),
    commonJS(),
    typescript()
  ]
};
