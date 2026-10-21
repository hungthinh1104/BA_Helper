// Patched sanitizer parser and Scalar's HTML serializer are ESM on Node 22.
// Keep unrelated dependencies untransformed.
const parserPackages = 'htmlparser2|domhandler|domelementtype|domutils|dom-serializer|entities|@scalar[/\\\\](?:client-side-rendering|helpers)';
exports.backendTransformIgnorePatterns = [
  String.raw`[/\\]node_modules[/\\](?!(?:\.pnpm[/\\]|(?:${parserPackages})(?:[/\\]|$)))`,
];

/** @type {import('jest').Config['transform']} */
exports.backendTransform = {
  '^.+\\.[tj]sx?$': ['@swc/jest', {
    jsc: {
      parser: { syntax: 'typescript', tsx: true, decorators: true },
      transform: { legacyDecorator: true, decoratorMetadata: true },
    },
    module: { type: 'commonjs' },
  }],
};
