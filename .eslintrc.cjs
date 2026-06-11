module.exports = {
  root: true,
  env: { node: true, es2020: true },
  parserOptions: { ecmaVersion: 2020, sourceType: "module" },
  ignorePatterns: ["**/dist/**", "**/build/**", "node_modules"],
  extends: ["eslint:recommended"],
};
