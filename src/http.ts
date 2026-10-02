#!/usr/bin/env node

import { createHostedHttpServer, loadHostedHttpOptions } from "./http-server.js";

const options = loadHostedHttpOptions();
const hosted = createHostedHttpServer(options);

hosted.server.listen(options.port, options.host, () => {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "info",
    event: "server_started",
    host: options.host,
    port: options.port,
  }));
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "info",
    event: "server_stopping",
    signal,
  }));
  await hosted.shutdown();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void shutdown(signal).then(
      () => process.exit(0),
      (error) => {
        console.error(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          event: "server_shutdown_failed",
          error: error instanceof Error ? error.message : "unknown error",
        }));
        process.exit(1);
      },
    );
  });
}
