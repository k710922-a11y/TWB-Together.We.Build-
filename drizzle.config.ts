import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://twb:twb@localhost:5432/twb" },
});
