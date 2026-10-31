import { ENV } from "@/wab/client/env";
import { CacheStorageStore, ResourceCache, resourceSpec, type Identity } from "@plasmic-shared/resource-cache";

const identity: Identity = {
  epoch: 0,
  value: undefined,
  async read() { return this.value; },
  invalidate() { this.epoch++; this.value = undefined; },
};
let cache: ResourceCache | undefined;
let channel: BroadcastChannel | undefined;
const isDesktop = () => navigator.userAgent.includes("PlasmicDesktop/");

function authChannel() {
  if (!channel && !isDesktop() && typeof BroadcastChannel !== "undefined") {
    try { channel = new BroadcastChannel("plasmic-library-resources-auth"); }
    catch { return undefined; }
    channel.onmessage = event => {
      if (event.data?.action === "logout") {
        identity.invalidate();
        void cache?.store.clear().catch(() => undefined);
      } else if (event.data?.action === "account" && event.data.userId !== identity.value?.user.id) {
        // A message can revoke local authority; only a server response may grant it.
        identity.invalidate();
      }
    };
  }
  return channel;
}

/** Called only with the user returned by the authenticated Studio API. */
export function setResourceCacheUser(userId: string) {
  if (identity.value?.user.id === userId) {return;}
  identity.invalidate();
  identity.value = { user: { id: userId } };
  authChannel()?.postMessage({ action: "account", userId });
}

export function resourceCacheIdentity() { return `${identity.value?.user.id ?? "anonymous"}:${identity.epoch}`; }

export async function clearResourceCache() {
  identity.invalidate();
  authChannel()?.postMessage({ action: "logout" });
  if (!isDesktop()) {
    const storage = browserStorage();
    const store = cache?.store ?? (storage ? new CacheStorageStore({ storage }) : undefined);
    await store?.clear().catch(error => console.warn("Cannot clear component library cache:", error));
  }
  // Desktop logout clears its native store in the existing main-process handler.
}

function browserStorage(): CacheStorage | undefined {
  try { return globalThis.caches; }
  catch { return undefined; }
}

export function fetchLibraryResource(input: string, init?: RequestInit): Promise<Response> {
  // The App protocol already delegates these requests to the same engine and its file store.
  if (isDesktop()) {return fetch(input, init);}
  const request = new Request(new URL(input, location.href), { credentials: "include", ...init });
  if (!resourceSpec(request, location.origin)) {return fetch(input, init);}
  const storage = browserStorage();
  if (!storage || !crypto.subtle || !authChannel()) {return fetch(input, { credentials: "include", ...init, cache: "no-store" });}
  cache ??= new ResourceCache({
    studioOrigin: location.origin, buildId: ENV.COMMITHASH, identity,
    store: new CacheStorageStore({ storage }),
    remoteFetch: remoteRequest => fetch(remoteRequest),
    hash: async body => {
      const bytes = new Uint8Array(body);
      const hash = await crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
    },
  });
  return cache.fetch(request);
}
