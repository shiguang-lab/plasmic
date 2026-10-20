import { ensure } from "@/wab/shared/common";

function desktopBrowser() {
  return ensure(
    (
      window as Window & {
        desktopBrowser?: {
          open(): Promise<unknown>;
          openPreview(url: string): Promise<void>;
        };
      }
    ).desktopBrowser,
    "The Desktop browser is not available",
  );
}

// Called in the Desktop main frame, including through Studio's frame API.
export async function openDesktopBrowser(): Promise<void> {
  await desktopBrowser().open();
}

export async function openDesktopPreview(url: string): Promise<void> {
  await desktopBrowser().openPreview(url);
}
