// ESLint v9 flat config for TypeScript (typescript-eslint v8)
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/**'] },
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        // Uses TS project service; no need to point at tsconfig files
        projectService: true
      }
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  },
  // turn off formatting-related rules so Prettier can format freely if we add it later
  eslintConfigPrettier
);
