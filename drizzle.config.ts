import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./lib/data/schema.ts",
  out: "./drizzle",
});
