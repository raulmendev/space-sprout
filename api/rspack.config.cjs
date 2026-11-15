// Bundles the API with the @garden/shared rules (../shared) compiled in from source:
// that package ships TypeScript, not JavaScript. Every other package stays external
// and is loaded from node_modules at runtime; Nest's ESM-only packages load through
// Node's require(esm).
const nodeExternals = require('webpack-node-externals');

module.exports = (options) => ({
  ...options,
  externals: [nodeExternals({ allowlist: [/^@garden\//] })],
});
