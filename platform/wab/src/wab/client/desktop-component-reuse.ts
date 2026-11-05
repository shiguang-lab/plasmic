import type { ComponentReuseCommand } from "@/wab/shared/copilot/component-review";

/** Called only in TopFrame; HostFrame reaches it through the existing Comlink API. */
export async function desktopComponentReuse(request: ComponentReuseCommand): Promise<unknown> {
  const native = (window as unknown as { desktopComponentReuse?: {
    sync(input: unknown): Promise<unknown>; review(input: unknown): Promise<unknown>;
    cancel(id: string): void; activity(): void; release(projectId: string): Promise<unknown>;
  } }).desktopComponentReuse;
  if (request.command === "status") return { available: !!native };
  if (!native) return null;
  switch (request.command) {
    case "sync": { const { command: _command, ...input } = request; return native.sync(input); }
    case "review": { const { command: _command, ...input } = request; return native.review(input); }
    case "cancel": return native.cancel(request.id);
    case "activity": return native.activity();
    case "release": return native.release(request.projectId);
  }
}
