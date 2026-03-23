export function paramsToSearch(params: Record<string, unknown>): URLSearchParams {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null) {
          search.append(key, String(item));
        }
      }
      continue;
    }

    search.set(key, String(value));
  }

  return search;
}

export function withJitter(base: number): number {
  const delta = base * 0.2;
  return Math.round(base - delta + Math.random() * delta * 2);
}
