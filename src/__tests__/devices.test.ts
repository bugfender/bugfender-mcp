import { describe, expect, it } from "vitest";
import { deviceQuery } from "../tools/devices.js";

describe("device query mapping", () => {
  it.each([
    ["last_active", "seen"],
    ["name_asc", "nameaz"],
    ["name_desc", "nameza"],
  ] as const)("maps %s ordering to %s", (order, expected) => {
    expect(deviceQuery({ order }).order).toBe(expected);
  });

  it("uses the API default ordering and parameter names", () => {
    expect(deviceQuery({
      device_id: "device-123*",
      name: "iPhone*",
      model: "iPhone 16",
      os_name: "iOS",
      os_version: "26.0",
      current_app_version: "42",
      device_key_values: "tier=pro",
      enabled: false,
      page_size: 10,
      next_cursor: "cursor",
    })).toEqual({
      device_id: "device-123*",
      device_name: "iPhone*",
      device_model: "iPhone 16",
      os_name: "iOS",
      os_version: "26.0",
      version: "42",
      device_key_values: "tier=pro",
      device_status: 0,
      order: "seen",
      format: "json",
      page_size: 10,
      next_cursor: "cursor",
    });
  });

  it("maps enabled devices to device_status=1", () => {
    expect(deviceQuery({ enabled: true }).device_status).toBe(1);
  });

  it("accepts a numeric app version ID", () => {
    expect(deviceQuery({ current_app_version: 42 }).version).toBe(42);
  });

  it("caps page size at the devices API limit", () => {
    expect(deviceQuery({ page_size: 200 }).page_size).toBe(100);
  });
});
