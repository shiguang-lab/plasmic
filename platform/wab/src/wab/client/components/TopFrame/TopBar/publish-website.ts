import type { PublishResult } from "@/wab/client/studio-ctx/StudioCtx";
import { assertNever } from "@/wab/shared/common";

export function ensureWebsiteVersionSaved(result: keyof typeof PublishResult) {
  switch (result) {
    case "Success":
    case "PreFilling":
    case "SkipAlreadyPublished":
      return;
    case "SaveFailed":
      throw new Error(
        "Current changes could not be saved. The website was not updated.",
      );
    case "OutOfDate":
      throw new Error(
        "This editor is out of date. Reload before publishing the website.",
      );
    case "PaywallError":
      throw new Error("Your plan does not allow publishing a project version.");
    case "UnknownError":
      throw new Error(
        "The project version could not be published. The website was not updated.",
      );
    default:
      assertNever(result);
  }
}

export async function publishCurrentWebsite<T>(
  saveVersion: () => Promise<keyof typeof PublishResult>,
  publishWebsite: () => Promise<T>,
): Promise<T> {
  ensureWebsiteVersionSaved(await saveVersion());
  return publishWebsite();
}
