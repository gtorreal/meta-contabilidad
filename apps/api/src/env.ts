import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(here, "..");
const repoRoot = path.resolve(here, "..", "..", "..");

const opts = { quiet: true as const };
config({ path: path.join(repoRoot, ".env"), ...opts });
config({ path: path.join(apiDir, ".env"), override: true, ...opts });
