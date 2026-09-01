#!/usr/bin/env node

import { createHostedHttpServer, loadHostedHttpOptions } from "./http-server.js";

const options = loadHostedHttpOptions();
const hosted = createHostedHttpServer(options);

hosted.server.listen(options.port, options.host, () => {
  console.error(`Bugfender MCP HTTP server listening on ${options.host}:${options.port}`);
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.error(`Received ${signal}; shutting down Bugfender MCP HTTP server`);
  await hosted.shutdown();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void shutdown(signal).then(
      () => process.exit(0),
      (error) => {
        console.error("Bugfender MCP HTTP shutdown failed", error);
        process.exit(1);
      },
    );
  });
}
