import globals from "globals";
import pluginVue from "eslint-plugin-vue";
import {
  defineConfigWithVueTs,
  vueTsConfigs,
} from "@vue/eslint-config-typescript";

/** Globals injected into AudioWorklet scope, which no `globals` preset covers. */
const audioWorkletGlobals = {
  AudioWorkletProcessor: "readonly",
  registerProcessor: "readonly",
  sampleRate: "readonly",
  currentTime: "readonly",
  currentFrame: "readonly",
};

export default defineConfigWithVueTs(
  {
    ignores: ["build/**", "dist/**", "node_modules/**", "package-lock.json"],
  },

  pluginVue.configs["flat/recommended"],
  vueTsConfigs.recommended,

  // Main process: Node environment.
  {
    files: ["src/main/**/*.ts"],
    languageOptions: { globals: globals.node },
  },

  // Renderer: browser environment.
  {
    files: ["src/renderer/**/*.{ts,vue}"],
    languageOptions: { globals: globals.browser },
  },

  {
    files: ["src/renderer/public/*.js"],
    languageOptions: {
      globals: { ...globals.browser, ...audioWorkletGlobals },
    },
  },

  // Build scripts and config files.
  {
    files: ["scripts/**/*.mjs", "*.mjs"],
    languageOptions: { globals: globals.node },
  },

  // Formatting belongs to Prettier. eslint-plugin-vue's stylistic rules
  // disagree with it on attribute wrapping and would fight `npm run format`
  // forever.
  {
    rules: {
      "vue/max-attributes-per-line": "off",
      "vue/singleline-html-element-content-newline": "off",
      "vue/html-self-closing": "off",
      "vue/html-indent": "off",
      "vue/html-closing-bracket-newline": "off",
      "vue/attributes-order": "off",
    },
  },

  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // The overlay renders model output, so every v-html needs to be a
      // deliberate, reviewed decision. MarkdownView.vue is the only allowance.
      "vue/no-v-html": "error",
      "vue/multi-word-component-names": "off",
      "no-console": ["warn", { allow: ["error"] }],
      eqeqeq: ["error", "always"],
      "prefer-const": "error",
      "no-var": "error",
    },
  },

  // The logger is the one place console access is the entire point.
  {
    files: ["src/main/logger.ts", "scripts/**/*.mjs"],
    rules: { "no-console": "off" },
  },
);
