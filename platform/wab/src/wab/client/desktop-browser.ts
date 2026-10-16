import { ensure } from "@/wab/shared/common";

// Called in the Desktop main frame, including through Studio's frame API.
export async function openDesktopBrowser(): Promise<void> {
  const desktop = (
    window as Window & {
      desktopBrowser?: { open(): Promise<unknown> };
    }
  ).desktopBrowser;
  await ensure(desktop, "The Desktop browser is not available").open();
}
