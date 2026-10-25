import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const production = process.argv.includes("--production");
const productionUrl = "https://igcadyukzwezrvgtbqxb.supabase.co";
if (production && (process.env.EXPO_PUBLIC_APP_ENV !== "production" || process.env.EXPO_PUBLIC_SUPABASE_URL !== productionUrl || !process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) {
  throw new Error("Production export requires EAS production environment variables. Run: eas env:exec production 'npm run build:web:production'");
}
const result = spawnSync(process.execPath, [require.resolve("expo/bin/cli"), "export", "--platform", "web", ...(production ? ["--clear"] : [])], {
  cwd: root, stdio: "inherit", env: { ...process.env, ...(production ? { EXPO_NO_DOTENV: "1" } : {}) },
});
if (result.status !== 0) process.exit(result.status ?? 1);
if (production) {
  const bundleDir = new URL("../dist/_expo/static/js/web/", import.meta.url);
  const source = readdirSync(bundleDir).filter((file) => file.endsWith(".js")).map((file) => readFileSync(new URL(file, bundleDir), "utf8")).join("\n");
  if (!source.includes(productionUrl) || source.includes("kcipfxvkjqrcqcuxneei.supabase.co")) throw new Error("Refusing a production bundle with an incorrect Supabase project.");
  console.log("Verified production Supabase target in exported web bundle.");
}
