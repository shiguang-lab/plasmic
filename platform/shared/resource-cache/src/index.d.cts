export interface Scope { origin: string; userId: string; buildId: string; epoch: number; }
export interface Entry { body: Uint8Array; headers: HeadersInit; }
export interface Store {
  protect(scope: Scope, kind: string, key: string): () => void;
  read(scope: Scope, kind: string, key: string, check: () => void): Promise<Entry | undefined>;
  write(scope: Scope, kind: string, key: string, body: Uint8Array, headers: HeadersInit, check: () => void): Promise<void>;
  remove(scope: Scope, kind: string, key: string): Promise<void>;
  clear(): Promise<void>;
}
export interface Identity {
  epoch: number;
  value: { user: { id: string } } | undefined;
  read(): Promise<Identity["value"]>;
  invalidate(): void;
}
export class ResourceCache {
  constructor(options: {studioOrigin: string; buildId: string; identity: Identity; store: Store; remoteFetch: (request: Request) => Promise<Response>; hash: (body: Uint8Array) => string | Promise<string>});
  store: Store;
  scope(): Promise<Scope | undefined>;
  check(scope: Scope): void;
  clear(): Promise<void>;
  fetch(request: Request): Promise<Response>;
}
export function resourceSpec(request: Request, origin: string): {kind: string; key: string} | undefined;
export const maxBytes: number;

export class CacheStorageStore implements Store {
  constructor(options: {storage: CacheStorage; maxBytes?: number});
  protect: Store["protect"];
  read: Store["read"];
  write: Store["write"];
  remove: Store["remove"];
  clear: Store["clear"];
}
