import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'build/**',
      'node_modules/**',
      'coverage/**',
      '.coverage/**',
      'src-tauri/**',
      'server_py/**',
      'electron/**',
      'scripts/**',
      'docs/**',
      'data/**',
      '.github/**',
      '.devcontainer/**',
      '.roo/**',
      'htmlcov/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      // Allow unused variables that start with underscore
      '@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
      // Allow any type in some cases
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow require() in config files
      '@typescript-eslint/no-require-imports': 'off',
    }
  },
  {
    files: ['**/*.config.{js,ts}', '**/vite.config.{js,ts}', '**/tailwind.config.{js,ts}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    }
  }
);