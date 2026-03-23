export type Warning = {
  code: string;
  message: string;
};

export type SuccessEnvelope = {
  ok: true;
  data: unknown;
  pagination?: Record<string, unknown>;
  warnings?: Warning[];
};

export type ErrorEnvelope = {
  ok: false;
  error: {
    code: string;
    message: string;
    hint?: string;
  };
};

export type Envelope = SuccessEnvelope | ErrorEnvelope;

export type ConfigFile = {
  default?: {
    apiToken?: string;
    refreshToken?: string;
    apiUrl?: string;
    seedRefreshToken?: string;
  };
};

export type RuntimeConfig = {
  apiToken?: string;
  refreshToken?: string;
  apiUrl: string;
  configPath: string;
  seedRefreshToken?: string;
  persistRuntimeTokens: boolean;
};
