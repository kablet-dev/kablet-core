import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import { FlatCompat } from '@eslint/eslintrc';
import tseslint from 'typescript-eslint';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
export default defineConfig(
  { ignores: ['**/.next/**', '**/node_modules/**', '**/playwright-report/**', '**/test-results/**', '**/coverage/**', '**/next-env.d.ts', 'pnpm-lock.yaml'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...compat.extends('next/core-web-vitals'),
  { rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }], '@next/next/no-html-link-for-pages': 'off' } },
);
