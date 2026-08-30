import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const andromedaRelaxedRules = Object.fromEntries(
  Object.keys(reactHooks.configs.flat.recommended.rules).map((rule) => [rule, 'off']),
)

export default defineConfig([
globalIgnores(['dist', 'community/**', 'worker/**/*.test.ts']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    rules: {
      // These React Compiler diagnostics are advisory for this application:
      // several UI primitives intentionally synchronize state or refs in
      // effects and export helpers alongside components.
      'react-refresh/only-export-components': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
    },
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // Andromeda is a shared component library: exporting variants and helper
    // constants alongside components is intentional in this directory.
    files: ['src/components/aicanvas/andromeda/**/*.{ts,tsx}'],
    rules: {
      ...andromedaRelaxedRules,
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
])
