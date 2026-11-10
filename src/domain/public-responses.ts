type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : undefined;
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.map(record).filter((item): item is JsonRecord => item !== undefined)
    : [];
}

function copyDefined(source: JsonRecord, keys: readonly string[]): JsonRecord {
  return Object.fromEntries(keys.flatMap((key) => source[key] === undefined ? [] : [[key, source[key]]]));
}

function membershipRole(team: JsonRecord, userID: unknown): unknown {
  const role = records(team.users).find((candidate) => candidate.id === userID)?.role;
  return role === "none" ? undefined : role;
}

export function normalizeCurrentUser(value: unknown): JsonRecord {
  const user = record(value) ?? {};
  const userID = user.id;
  const teams = records(user.teams).map((team) => {
    const role = membershipRole(team, userID);
    return {
      ...copyDefined(team, ["name"]),
      ...(role === undefined ? {} : { role }),
    };
  });

  return {
    ...copyDefined(user, ["public_id", "name", "email"]),
    teams,
  };
}

export function normalizeTeams(value: unknown, userID: unknown): JsonRecord[] {
  return records(value).map((team) => {
    const role = membershipRole(team, userID);
    return {
      ...copyDefined(team, ["name"]),
      ...(role === undefined ? {} : { role }),
      ...(typeof team.is_team_active === "boolean" ? { active: team.is_team_active } : {}),
      app_count: records(team.apps).length,
    };
  });
}

const appStatsFields = [
  "total_devices",
  "active_devices_yesterday",
  "active_devices_today",
  "logs_yesterday",
  "logs_today",
  "errors_yesterday",
  "errors_today",
  "open_crashes_yesterday",
  "open_crashes_today",
  "open_issues_yesterday",
  "open_issues_today",
  "open_feedback_yesterday",
  "open_feedback_today",
] as const;

const platforms: Record<number, string> = {
  [-1]: "unknown",
  0: "ios",
  1: "android",
  3: "web",
  5: "flutter",
};

export function normalizeApp(value: unknown): JsonRecord {
  const app = record(value) ?? {};
  const team = record(app.team);
  const stats = record(app.stats);

  return {
    ...copyDefined(app, ["public_app_id", "name"]),
    ...(typeof app.operating_system === "number"
      ? { platform: platforms[app.operating_system] ?? "unknown" }
      : {}),
    ...(team?.name === undefined ? {} : { team_name: team.name }),
    ...(stats ? { stats: copyDefined(stats, appStatsFields) } : {}),
  };
}

export function normalizeApps(value: unknown): JsonRecord[] {
  return records(value).map(normalizeApp);
}

const diagnosticTextLimit = 240;

export function sanitizeDiagnosticText(value: unknown): string {
  const text = typeof value === "string" ? value : String(value ?? "");
  const sanitized = text
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_JWT]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/(["'](?:access_token|refresh_token|api_key|apikey|password|secret|token)["']\s*:\s*["'])[^"']+/gi, "$1[REDACTED]")
    .replace(/([?&\s](?:access_token|refresh_token|api_key|apikey|password|secret|token)\s*[=:]\s*)[^\s&"']+/gi, "$1[REDACTED]")
    .replace(/\s+/g, " ")
    .trim();

  return sanitized.length <= diagnosticTextLimit
    ? sanitized
    : `${sanitized.slice(0, diagnosticTextLimit - 1)}…`;
}

export function normalizeAppSummary(value: unknown): JsonRecord {
  const summary = record(value) ?? {};
  const normalizeItems = (items: unknown): JsonRecord[] => records(items).map((item) => ({
    ...copyDefined(item, ["Count"]),
    ...(item.Title === undefined ? {} : { Title: sanitizeDiagnosticText(item.Title) }),
  }));

  return {
    ...copyDefined(summary, ["App", "ActiveDevices", "Crashes", "Feedback", "Issues", "Logs", "Sessions"]),
    TopCrashes: normalizeItems(summary.TopCrashes),
    TopFeedback: normalizeItems(summary.TopFeedback),
    TopIssues: normalizeItems(summary.TopIssues),
  };
}
