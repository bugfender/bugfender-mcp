import { describe, expect, it } from "vitest";
import {
  normalizeApps,
  normalizeAppSummary,
  normalizeCurrentUser,
  normalizeTeams,
  sanitizeDiagnosticText,
} from "../domain/public-responses.js";

describe("public MCP response normalization", () => {
  it("limits who_am_i to the connected identity and memberships", () => {
    const normalized = normalizeCurrentUser({
      id: 42,
      public_id: "public-user",
      name: "Review User",
      email: "review@example.com",
      email_verified: true,
      admin: false,
      LastIPAddress: "192.0.2.1",
      password_last_changed_at: "2026-01-01T00:00:00Z",
      active_plan: "SECRET_PLAN",
      teams: [{
        id: 7,
        name: "Review Team",
        stripe_customer_id: "cus_private",
        plan: { price: 100 },
        apps: [{ key: "app-secret" }],
        users: [
          { id: 42, email: "review@example.com", role: "owner" },
          { id: 43, email: "other@example.com", role: "viewer" },
        ],
      }],
    });

    expect(normalized).toEqual({
      public_id: "public-user",
      name: "Review User",
      email: "review@example.com",
      teams: [{ name: "Review Team", role: "owner" }],
    });
    expect(JSON.stringify(normalized)).not.toMatch(/IPAddress|password|plan|stripe|other@example|app-secret/i);
  });

  it("limits list_apps to public app details and investigation metrics", () => {
    const normalized = normalizeApps([{
      id: 99,
      public_app_id: "public-app",
      name: "Sample App",
      operating_system: 3,
      debug_mode: true,
      data_collection_enabled: false,
      date_format: "YYYY-MM-DD",
      time_zone: "UTC",
      key: "app-secret",
      upload_symbols_token: "symbol-secret",
      s3: { accessKeyId: "storage-secret" },
      team: {
        id: 7,
        name: "Review Team",
        stripe_customer_id: "cus_private",
        plan: { price: 100 },
      },
      stats: {
        has_devices: true,
        total_devices: 5,
        logs_today: 20,
        internal_counter: 999,
      },
    }]);

    expect(normalized).toEqual([{
      public_app_id: "public-app",
      name: "Sample App",
      platform: "web",
      team_name: "Review Team",
      stats: { total_devices: 5, logs_today: 20 },
    }]);
    expect(JSON.stringify(normalized)).not.toMatch(/secret|stripe|price|internal_counter|"id"/i);
  });

  it("limits list_teams to membership and visible-app summary fields", () => {
    const normalized = normalizeTeams([{
      id: 7,
      name: "Review Team",
      is_team_active: true,
      stripe_customer_id: "cus_private",
      plan: { price: 100 },
      apps: [{ id: 1, key: "secret" }, { id: 2, key: "secret" }],
      users: [
        { id: 42, email: "review@example.com", role: "owner" },
        { id: 43, email: "other@example.com", role: "viewer" },
      ],
    }], 42);

    expect(normalized).toEqual([{
      name: "Review Team",
      role: "owner",
      active: true,
      app_count: 2,
    }]);
    expect(JSON.stringify(normalized)).not.toMatch(/stripe|price|secret|example\.com|"id"/i);
  });

  it("omits the ambiguous none role used for app-specific access", () => {
    expect(normalizeTeams([{
      name: "Shared Team",
      apps: [{}],
      users: [{ id: 42, role: "none" }],
    }], 42)).toEqual([{ name: "Shared Team", app_count: 1 }]);
  });

  it("sanitizes and truncates diagnostic text", () => {
    const longSecret = `Failure for user@example.com with Bearer abc.def.ghi token=very-secret {"access_token":"json-secret"} ${"x".repeat(300)}`;
    const sanitized = sanitizeDiagnosticText(longSecret);

    expect(sanitized).not.toContain("user@example.com");
    expect(sanitized).not.toContain("very-secret");
    expect(sanitized).not.toContain("json-secret");
    expect(sanitized).not.toContain("abc.def.ghi");
    expect(sanitized).toContain("[REDACTED_EMAIL]");
    expect(sanitized.length).toBeLessThanOrEqual(240);
    expect(sanitized.endsWith("…")).toBe(true);
  });

  it("normalizes daily summaries and sanitizes crash titles", () => {
    expect(normalizeAppSummary({
      App: "Sample App",
      ActiveDevices: 3,
      Crashes: 1,
      Feedback: 0,
      Issues: 0,
      Logs: 10,
      Sessions: 2,
      Internal: "private",
      TopCrashes: [{ Title: "Failure for user@example.com", Count: 1, Debug: "private" }],
      TopFeedback: [],
      TopIssues: [],
    })).toEqual({
      App: "Sample App",
      ActiveDevices: 3,
      Crashes: 1,
      Feedback: 0,
      Issues: 0,
      Logs: 10,
      Sessions: 2,
      TopCrashes: [{ Title: "Failure for [REDACTED_EMAIL]", Count: 1 }],
      TopFeedback: [],
      TopIssues: [],
    });
  });
});
