import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["node_modules/", "coverage/", "dist/"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended
];
