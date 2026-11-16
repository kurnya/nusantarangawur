import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'reference', 'node_modules', 'public', 'coverage', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ['src/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['*.js', '*.config.ts', 'scripts/**/*.{js,mjs}'],
    languageOptions: { globals: globals.node },
  },
);
