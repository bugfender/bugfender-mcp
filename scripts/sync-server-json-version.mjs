import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const serverPath = join(root, "server.json");

if (!existsSync(serverPath)) {
  console.error(
    "sync-server-json-version: server.json not found.\n" +
      "Add server.json at the repo root (see RELEASING.md), or run: mcp-publisher init",
  );
  process.exit(1);
}

const server = JSON.parse(readFileSync(serverPath, "utf8"));

server.version = pkg.version;
if (server.packages?.[0]) {
  server.packages[0].version = pkg.version;
}

writeFileSync(serverPath, `${JSON.stringify(server, null, 2)}\n`, "utf8");
