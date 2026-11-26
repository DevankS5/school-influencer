import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// DATABASE_URL from the environment (hosted DB), falling back to the docker-compose default.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/app_db" },
});
