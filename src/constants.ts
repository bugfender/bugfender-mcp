import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_API_URL = "https://dashboard.bugfender.com/api";
export const DEFAULT_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 200;
export const MAX_RESPONSE_BYTES = 512 * 1024;

export const SERVER_NAME = "bugfender";

const packageJsonPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "package.json",
);
export const SERVER_VERSION = (
  JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version: string }
).version;
export const REQUEST_TIMEOUT_MS = 30_000;
