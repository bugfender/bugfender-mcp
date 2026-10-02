import { describe, expect, it } from "vitest";
import { omitCredentials } from "../tool-metadata.js";

describe("tool response metadata", () => {
  it("removes nested credentials without changing useful identifiers", () => {
    expect(omitCredentials({
      id: 42,
      key: "app-secret",
      profile: {
        name: "Example",
        access_token: "access-secret",
      },
      apps: [{ public_id: "abc", refresh_token: "refresh-secret" }],
    })).toEqual({
      id: 42,
      profile: { name: "Example" },
      apps: [{ public_id: "abc" }],
    });
  });
});
