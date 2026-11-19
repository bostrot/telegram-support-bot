const google = require('eslint-config-google');
const globals = require('globals');
const { builtinRules } = require('eslint/use-at-your-own-risk');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const prettier = require('eslint-plugin-prettier');

// valid-jsdoc and require-jsdoc were removed from ESLint core in v9.
// Pure formatting (layout) rules are left to the formatter.
const googleRules = Object.fromEntries(
  Object.entries(google.rules).filter(([name]) =>
    builtinRules.has(name) && builtinRules.get(name).meta.type !== 'layout'),
);

module.exports = [
  { ignores: ['build/'] },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      prettier,
    },
    rules: {
      ...googleRules,
      // Core no-unused-vars misreports TS enum members and type-only usages
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      // Config keys and DB fields are snake_case (staffchat_id, parse_mode, agent_id, ...)
      'camelcase': ['error', { properties: 'never', ignoreDestructuring: true }],
    },
  },
];
