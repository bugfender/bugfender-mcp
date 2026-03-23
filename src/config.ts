import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { DEFAULT_API_URL } from "./constants.js";
import type { ConfigFile, RuntimeConfig } from "./types.js";

function getConfigPath(): string {
  return join(homedir(), ".bugfender", "mcp.json");
}

function readConfigFile(configPath: string): ConfigFile {
  if (!existsSync(configPath)) {
    return {};
  }

  try {
    return JSON.parse(readFileSync(configPath, "utf8")) as ConfigFile;
  } catch {
    return {};
  }
}

function writeConfigFile(configPath: string, config: ConfigFile): void {
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function saveConfig(config: RuntimeConfig): void {
  if (!config.persistRuntimeTokens) {
    return;
  }

  writeConfigFile(config.configPath, {
    default: {
      apiToken: config.apiToken,
      refreshToken: config.refreshToken,
      apiUrl: config.apiUrl,
      seedRefreshToken: config.seedRefreshToken,
    },
  });
}

export function loadConfig(): RuntimeConfig {
  const configPath = getConfigPath();
  const fileConfig = readConfigFile(configPath);
  const fileDefault = fileConfig.default;

  const envApiToken = process.env.BUGFENDER_API_TOKEN;
  const envRefreshToken = process.env.BUGFENDER_REFRESH_TOKEN;
  const envApiURL = process.env.BUGFENDER_API_URL;

  // Seed the local runtime store the first time the MCP starts, and reset it
  // when the IDE config provides a newly generated refresh token.
  if (envRefreshToken && fileDefault?.seedRefreshToken !== envRefreshToken) {
    const seededConfig: RuntimeConfig = {
      apiToken: envApiToken,
      refreshToken: envRefreshToken,
      apiUrl: envApiURL || fileDefault?.apiUrl || DEFAULT_API_URL,
      configPath,
      seedRefreshToken: envRefreshToken,
      persistRuntimeTokens: true,
    };
    saveConfig(seededConfig);
    return seededConfig;
  }

  return {
    apiToken: fileDefault?.apiToken || envApiToken,
    refreshToken: fileDefault?.refreshToken || envRefreshToken,
    apiUrl: fileDefault?.apiUrl || envApiURL || DEFAULT_API_URL,
    configPath,
    seedRefreshToken: fileDefault?.seedRefreshToken || envRefreshToken,
    persistRuntimeTokens: true,
  };
}
