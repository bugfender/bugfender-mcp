import { describe, expect, it } from "vitest";
import {
  DEVICE_ORDER_API,
  enrichApiErrorMessage,
  toDeviceCountQuery,
  toDeviceSearchQuery,
} from "../../utils/devices-query.js";

describe("toDeviceSearchQuery", () => {
  it("maps friendly order tokens to Bugfender API values", () => {
    expect(toDeviceSearchQuery({ order: "last_active" }).order).toBe("seen");
    expect(toDeviceSearchQuery({ order: "name_asc" }).order).toBe("nameaz");
    expect(toDeviceSearchQuery({ order: "name_desc" }).order).toBe("nameza");
  });

  it("defaults order to seen", () => {
    expect(toDeviceSearchQuery({}).order).toBe(DEVICE_ORDER_API.last_active);
  });

  it("maps documented filters to API parameter names", () => {
    const query = toDeviceSearchQuery({
      device_id: "device-123",
      name: "iPhone*",
      model: "iPhone17,2",
      enabled: true,
      current_app_version: 7894406,
      next_cursor: "abc",
    });
    expect(query.device_id).toBe("device-123");
    expect(query.device_name).toBe("iPhone*");
    expect(query.device_model).toBe("iPhone17,2");
    expect(query.device_status).toBe(1);
    expect(query.version).toBe(7894406);
    expect(query.nextCursor).toBe("abc");
    expect(query.name).toBeUndefined();
    expect(query.model).toBeUndefined();
    expect(query.enabled).toBeUndefined();
    expect(query.next_cursor).toBeUndefined();
  });

  it("maps enabled false to device_status 0", () => {
    expect(toDeviceSearchQuery({ enabled: false }).device_status).toBe(0);
  });

  it("clamps page_size to the devices API max of 100", () => {
    expect(toDeviceSearchQuery({}, 250).page_size).toBe(100);
  });
});

describe("toDeviceCountQuery", () => {
  it("maps name to device_name", () => {
    expect(toDeviceCountQuery({ name: "Pixel*" }).device_name).toBe("Pixel*");
  });
});

describe("enrichApiErrorMessage", () => {
  it("lists accepted order values when the API rejects order", () => {
    expect(enrichApiErrorMessage("Invalid order")).toContain("last_active");
    expect(enrichApiErrorMessage("Invalid order")).toContain("seen");
  });

  it("leaves unrelated messages unchanged", () => {
    expect(enrichApiErrorMessage("Not found")).toBe("Not found");
  });
});
