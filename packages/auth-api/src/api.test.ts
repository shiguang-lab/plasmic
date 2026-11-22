import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@plasmicapp/isomorphic-unfetch", () => ({
  default: vi.fn(),
}));

import fetch from "@plasmicapp/isomorphic-unfetch";
import { getPlasmicAppUserFromToken, PlasmicAuthError } from "./api";

const mockFetch = vi.mocked(fetch);

describe("getPlasmicAppUserFromToken", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("distinguishes invalid credentials (401/403) from rate limits and server errors", async () => {
    for (const status of [401, 403]) {
      mockFetch.mockResolvedValueOnce({ status } as any);
      const res = await getPlasmicAppUserFromToken({
        host: "https://auth.test",
        token: "tok-1",
      });
      expect(res.user).toBeNull();
      expect(res.error).toBeInstanceOf(PlasmicAuthError);
      expect((res.error as PlasmicAuthError).status).toBe(status);
      expect((res.error as PlasmicAuthError).invalidToken).toBe(true);
    }

    for (const status of [429, 503]) {
      mockFetch.mockResolvedValueOnce({ status } as any);
      const res = await getPlasmicAppUserFromToken({
        host: "https://auth.test",
        token: "tok-1",
      });
      expect(res.user).toBeNull();
      expect(res.error).toBeInstanceOf(PlasmicAuthError);
      expect((res.error as PlasmicAuthError).status).toBe(status);
      expect((res.error as PlasmicAuthError).invalidToken).toBe(false);
    }
  });
});
