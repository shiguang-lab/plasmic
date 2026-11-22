// @vitest-environment jsdom
import React from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlasmicQueryDataProvider } from "@plasmicapp/query";
import { PlasmicAuthError, getPlasmicAppUserFromToken } from "@plasmicapp/auth-api";
import { usePlasmicAuth } from "./hooks";

vi.mock("@plasmicapp/auth-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@plasmicapp/auth-api")>();
  return {
    ...actual,
    getPlasmicAppUserFromToken: vi.fn(),
  };
});

const mockGetUser = vi.mocked(getPlasmicAppUserFromToken);

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

function Probe({ appId }: { appId: string }) {
  const { user, isUserLoading } = usePlasmicAuth({
    host: "https://auth.test",
    appId,
  });
  return (
    <span data-loading={String(isUserLoading)}>
      {user ? user.email : "anonymous"}
    </span>
  );
}

function renderProbe(appId: string) {
  const cache = new Map();
  return render(
    <PlasmicQueryDataProvider provider={() => cache}>
      <Probe appId={appId} />
    </PlasmicQueryDataProvider>
  );
}

describe("usePlasmicAuth", () => {
  it("preserves token on 429 and 503 so retries recover, and clears only on invalidToken", async () => {
    const appId = "app-1";
    const storageKey = `$user.${appId}`;
    localStorage.setItem(storageKey, "saved-token");

    for (const status of [503, 429]) {
      mockGetUser.mockResolvedValueOnce({
        user: null,
        token: null,
        error: new PlasmicAuthError(`HTTP ${status}`, status, false),
      });
      const view = renderProbe(appId);
      await waitFor(() =>
        expect(
          view.container.querySelector("[data-loading='false']")
        ).toBeTruthy()
      );
      expect(view.container.textContent).toBe("anonymous");
      expect(localStorage.getItem(storageKey)).toBe("saved-token");
      view.unmount();
    }

    mockGetUser.mockResolvedValueOnce({
      token: "saved-token",
      user: {
        email: "user@example.com",
        properties: null,
        roleId: "r1",
        roleName: "User",
        roleIds: ["r1"],
        roleNames: ["User"],
      },
    });
    const recovered = renderProbe(appId);
    await waitFor(() =>
      expect(recovered.container.textContent).toBe("user@example.com")
    );
    expect(localStorage.getItem(storageKey)).toBe("saved-token");
    recovered.unmount();

    mockGetUser.mockResolvedValueOnce({
      user: null,
      token: null,
      error: new PlasmicAuthError("Invalid token", 401, true),
    });
    const rejected = renderProbe(appId);
    await waitFor(() =>
      expect(
        rejected.container.querySelector("[data-loading='false']")
      ).toBeTruthy()
    );
    expect(rejected.container.textContent).toBe("anonymous");
    expect(localStorage.getItem(storageKey)).toBeNull();
    expect(mockGetUser).toHaveBeenCalledTimes(4);
  });
});
