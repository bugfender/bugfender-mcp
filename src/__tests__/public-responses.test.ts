import { describe, expect, it } from "vitest";
import { normalizeApps, normalizeCurrentUser } from "../domain/public-responses.js";

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
      operating_system: 3,
      debug_mode: true,
      data_collection_enabled: false,
      date_format: "YYYY-MM-DD",
      time_zone: "UTC",
      team_name: "Review Team",
      stats: { has_devices: true, total_devices: 5, logs_today: 20 },
    }]);
    expect(JSON.stringify(normalized)).not.toMatch(/secret|stripe|price|internal_counter|"id"/i);
  });
});
