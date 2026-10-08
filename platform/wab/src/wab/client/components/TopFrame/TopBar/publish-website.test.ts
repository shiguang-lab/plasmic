import { publishCurrentWebsite } from "@/wab/client/components/TopFrame/TopBar/publish-website";
import { describe, expect, it, vi } from "vitest";

describe("publishing current website contents", () => {
  it("waits for current changes to be saved and versioned before building", async () => {
    let finishSave: (result: "PreFilling") => void = () => {
      throw new Error("Saving has not started");
    };
    const save = vi.fn(
      () =>
        new Promise<"PreFilling">((resolve) => {
          finishSave = resolve;
        }),
    );
    const build = vi.fn().mockResolvedValue({ version: "0.0.2" });
    const publication = publishCurrentWebsite(save, build);
    expect(save).toHaveBeenCalledOnce();
    expect(build).not.toHaveBeenCalled();
    finishSave("PreFilling");
    await expect(publication).resolves.toEqual({ version: "0.0.2" });
    expect(build).toHaveBeenCalledOnce();
  });

  it("can rebuild an unchanged version", async () => {
    const build = vi.fn().mockResolvedValue({ version: "0.0.1" });
    await expect(
      publishCurrentWebsite(async () => "SkipAlreadyPublished", build),
    ).resolves.toEqual({ version: "0.0.1" });
    expect(build).toHaveBeenCalledOnce();
  });

  it.each(["SaveFailed", "OutOfDate", "PaywallError", "UnknownError"] as const)(
    "never publishes the previous version when saving returns %s",
    async (result) => {
      const build = vi.fn();
      await expect(
        publishCurrentWebsite(async () => result, build),
      ).rejects.toThrow();
      expect(build).not.toHaveBeenCalled();
    },
  );

  it("stops when saving throws and surfaces build errors for retry", async () => {
    const build = vi
      .fn()
      .mockRejectedValue(new Error("Code generation failed"));
    await expect(
      publishCurrentWebsite(async () => {
        throw new Error("Connection lost");
      }, build),
    ).rejects.toThrow("Connection lost");
    expect(build).not.toHaveBeenCalled();
    await expect(
      publishCurrentWebsite(async () => "Success", build),
    ).rejects.toThrow("Code generation failed");
    expect(build).toHaveBeenCalledOnce();
  });
});
