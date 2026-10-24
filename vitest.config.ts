import {defineConfig} from "vitest/config";

export default defineConfig({
    test: {include: ["packages/*/test/**/*.test.{ts,mts}", "scripts/test/**/*.test.mjs"]},
});
