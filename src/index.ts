#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createBugfenderServer } from "./server.js";

const config = loadConfig();
const { server } = createBugfenderServer(config);
const transport = new StdioServerTransport();
await server.connect(transport);
