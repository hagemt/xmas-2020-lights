module.exports = {
  env: {
    es2020: true,
    mocha: true,
    node: true,
  },

  extends: [
    'eslint:recommended',
    'plugin:import/recommended',
    'plugin:mocha/recommended',
    'plugin:node/recommended',
    'plugin:prettier/recommended',
    'prettier',
  ],

  parserOptions: {
    ecmaVersion: 2020,
  },

  plugins: ['import', 'mocha', 'node', 'prettier'],

  root: true,

  rules: {
    'sort-keys': 'warn',
  },
}
