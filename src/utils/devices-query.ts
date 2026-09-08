import { clampPageSize } from "./pagination.js";

export const DEVICE_ORDER_API = {
  last_active: "seen",
  name_asc: "nameaz",
  name_desc: "nameza",
} as const;

export type DeviceOrder = keyof typeof DEVICE_ORDER_API;

export const DEVICE_PAGE_SIZE_MAX = 100;

export const INVALID_ORDER_HINT =
  "Valid MCP order values: last_active, name_asc, name_desc. Bugfender API tokens: seen, nameaz, nameza.";

export function enrichApiErrorMessage(message: string): string {
  if (!/invalid order/i.test(message)) {
    return message;
  }
  if (message.includes("seen") && message.includes("nameaz")) {
    return message;
  }
  return `${message}. ${INVALID_ORDER_HINT}`;
}

export type DeviceFilterInput = {
  device_id?: string;
  name?: string;
  model?: string;
  os_name?: string;
  os_version?: string;
  current_app_version?: number;
  enabled?: boolean;
  order?: DeviceOrder;
  next_cursor?: string;
};

function applySharedDeviceFilters(
  query: Record<string, string | number | boolean>,
  filters: DeviceFilterInput,
): void {
  if (filters.device_id) {
    query.device_id = filters.device_id;
  }
  if (filters.name) {
    query.device_name = filters.name;
  }
  if (filters.model) {
    query.device_model = filters.model;
  }
  if (filters.os_name) {
    query.os_name = filters.os_name;
  }
  if (filters.os_version) {
    query.os_version = filters.os_version;
  }
  if (filters.enabled !== undefined) {
    query.device_status = filters.enabled ? 1 : 0;
  }
}

export function toDeviceSearchQuery(
  filters: DeviceFilterInput,
  pageSize?: number,
): Record<string, string | number | boolean> {
  const query: Record<string, string | number | boolean> = {
    format: "json",
    page_size: Math.min(clampPageSize(pageSize), DEVICE_PAGE_SIZE_MAX),
    order: DEVICE_ORDER_API[filters.order ?? "last_active"],
  };
  applySharedDeviceFilters(query, filters);
  if (filters.next_cursor) {
    query.nextCursor = filters.next_cursor;
  }
  if (filters.current_app_version !== undefined) {
    query.version = filters.current_app_version;
  }
  return query;
}

export function toDeviceCountQuery(
  filters: DeviceFilterInput,
): Record<string, string | number | boolean> {
  const query: Record<string, string | number | boolean> = {};
  applySharedDeviceFilters(query, filters);
  return query;
}
