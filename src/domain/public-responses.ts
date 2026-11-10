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

export function normalizeCurrentUser(value: unknown): JsonRecord {
  const user = record(value) ?? {};
  const userID = user.id;
  const teams = records(user.teams).map((team) => {
    const membership = records(team.users).find((candidate) => candidate.id === userID);
    return {
      ...copyDefined(team, ["name"]),
      ...(membership ? copyDefined(membership, ["role"]) : {}),
    };
  });

  return {
    ...copyDefined(user, ["public_id", "name", "email"]),
    teams,
  };
}

const appStatsFields = [
  "has_devices",
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

export function normalizeApp(value: unknown): JsonRecord {
  const app = record(value) ?? {};
  const team = record(app.team);
  const stats = record(app.stats);

  return {
    ...copyDefined(app, [
      "public_app_id",
      "name",
      "operating_system",
      "debug_mode",
      "data_collection_enabled",
      "date_format",
      "time_zone",
    ]),
    ...(team?.name === undefined ? {} : { team_name: team.name }),
    ...(stats ? { stats: copyDefined(stats, appStatsFields) } : {}),
  };
}

export function normalizeApps(value: unknown): JsonRecord[] {
  return records(value).map(normalizeApp);
}
