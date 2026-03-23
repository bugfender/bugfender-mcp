import type { BugfenderClient } from "./client.js";
import type { RuntimeConfig } from "./types.js";

export type ServerContext = {
  client: BugfenderClient;
  config: RuntimeConfig;
};
