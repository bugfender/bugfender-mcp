import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../constants.js";

export function clampPageSize(value?: number): number {
  if (!value || value <= 0) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(value, MAX_PAGE_SIZE);
}
