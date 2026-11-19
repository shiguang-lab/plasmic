import { observeCover } from "./cover-subscriptions";

class Feed extends EventTarget {
  static CLOSED = 2;
  static all: Feed[] = [];
  close = vi.fn();
  constructor(readonly url: string) {
    super();
    Feed.all.push(this);
  }
  send(id: string, revision: number) {
    this.dispatchEvent(
      new MessageEvent("coverReady", {
        data: JSON.stringify({ projectId: id, publishedRevision: revision }),
      }),
    );
  }
}

const activity = vi.hoisted(() => ({
  active: true,
  listeners: new Set<() => void>(),
}));
vi.mock("@/wab/client/desktop-navigation", () => ({
  isDesktopViewActive: () => activity.active,
  subscribeDesktopView: (fn: () => void) => {
    activity.listeners.add(fn);
    return () => activity.listeners.delete(fn);
  },
}));

let intersections: ((visible: boolean) => void)[];
const cleanups: (() => void)[] = [];
const fetcher = vi.fn<typeof fetch>();
const decode = vi.fn<() => Promise<void>>();
const revoke = vi.fn();
let urlCount = 0;

function card(id: string, account = "user") {
  const changed = vi.fn();
  const stop = observeCover(
    document.createElement("div"),
    account,
    id,
    changed,
  );
  cleanups.push(stop);
  return { changed, stop, visible: intersections[intersections.length - 1] };
}
function image(revision: number) {
  return new Response("image", {
    headers: { "X-Cover-Revision": String(revision) },
  });
}
function desktop(active: boolean) {
  activity.active = active;
  for (const notify of activity.listeners) notify();
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  intersections = [];
  Feed.all = [];
  activity.active = true;
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  vi.stubGlobal("EventSource", Feed);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(
        private readonly cb: (
          entries: { target: Element; isIntersecting: boolean }[],
        ) => void,
      ) {}
      observe(target: Element) {
        intersections.push((visible) =>
          this.cb([{ target, isIntersecting: visible }]),
        );
      }
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("fetch", fetcher);
  vi.stubGlobal(
    "Image",
    class {
      decode = decode;
    },
  );
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = () => "blob:" + ++urlCount;
      static revokeObjectURL = revoke;
    },
  );
  fetcher.mockReset().mockResolvedValue(new Response(null, { status: 202 }));
  decode.mockReset().mockResolvedValue(undefined);
  revoke.mockClear();
  urlCount = 0;
});

afterEach(() => {
  for (const stop of cleanups.splice(0)) stop();
  expect(activity.listeners.size).toBe(0);
  Reflect.deleteProperty(document, "hidden");
  vi.unstubAllGlobals();
});

it("shares one feed across 100 cards, ignores other projects, releases the last consumer", async () => {
  const cards = Array.from({ length: 100 }, (_, i) => card(String(i)));
  expect(Feed.all).toHaveLength(1);
  const feed = Feed.all[0];
  feed.send("unrelated", 10);
  feed.send("5", 1);
  expect(fetcher).not.toHaveBeenCalled();
  fetcher.mockResolvedValueOnce(image(2));
  cards[5].visible(true);
  await tick();
  expect(cards[5].changed).toHaveBeenLastCalledWith("blob:1");
  cards[5].visible(false);
  feed.send("5", 3);
  expect(fetcher).toHaveBeenCalledTimes(1);
  for (const item of cards.slice(1)) item.stop();
  expect(feed.close).not.toHaveBeenCalled();
  cards[0].stop();
  expect(feed.close).toHaveBeenCalledTimes(1);
  feed.send("5", 4);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("shares the image of duplicate cards and catches a publication during the initial GET", async () => {
  const a = card("p"),
    b = card("p");
  let finish: (response: Response) => void;
  fetcher
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce(image(3));
  a.visible(true);
  b.visible(true);
  Feed.all[0].send("p", 3);
  a.stop();
  finish!(new Response(null, { status: 202 }));
  await tick();
  expect(a.changed).toHaveBeenCalledTimes(1);
  expect(b.changed).toHaveBeenLastCalledWith("blob:1");
  Feed.all[0].send("p", 2);
  Feed.all[0].send("p", 3);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("ignores a previous account's feed, pending fetch and decoded image after navigation", async () => {
  let finishDecode: () => void;
  let finishFetch: (response: Response) => void;
  decode.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishDecode = resolve;
      }),
  );
  fetcher.mockResolvedValueOnce(image(1)).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishFetch = resolve;
      }),
  );
  const a = card("same"),
    old = card("other");
  a.visible(true);
  old.visible(true);
  await tick();
  const signal = fetcher.mock.calls[1][1]?.signal;
  const b = card("same", "next");
  expect(signal?.aborted).toBe(true);
  expect(Feed.all[0].close).toHaveBeenCalledOnce();
  Feed.all[0].send("same", 4);
  finishDecode!();
  finishFetch!(image(2));
  await tick();
  expect(b.changed.mock.calls).toEqual([[undefined]]);
  expect(revoke).toHaveBeenCalledWith("blob:1");
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("reconciles visible revisions after Desktop activation and Web restoration", async () => {
  desktop(false);
  const a = card("p");
  a.visible(true);
  expect(Feed.all).toHaveLength(0);
  let revision = 1;
  fetcher.mockImplementation(async (url) =>
    String(url).includes("/revisions?")
      ? Response.json({ p: revision })
      : image(revision),
  );
  desktop(true);
  Feed.all[0].dispatchEvent(
    new MessageEvent("ready", { data: JSON.stringify("stream") }),
  );
  await tick();
  expect(a.changed).toHaveBeenLastCalledWith("blob:1");
  desktop(false);
  expect(Feed.all[0].close).toHaveBeenCalledOnce();
  revision = 4;
  Feed.all[0].send("p", 2);
  desktop(true);
  Feed.all[1].dispatchEvent(
    new MessageEvent("ready", { data: JSON.stringify("stream") }),
  );
  await tick();
  expect(a.changed).toHaveBeenLastCalledWith("blob:2");
  expect(
    fetcher.mock.calls.filter(([u]) => String(u).includes("/cover?")),
  ).toHaveLength(2);
  window.dispatchEvent(new Event("pagehide"));
  expect(Feed.all[1].close).toHaveBeenCalledOnce();
  window.dispatchEvent(new Event("pageshow"));
  Feed.all[2].dispatchEvent(
    new MessageEvent("ready", { data: JSON.stringify("stream") }),
  );
  await tick();
  expect(a.changed).toHaveBeenLastCalledWith("blob:2");
  expect(
    fetcher.mock.calls.filter(([u]) => String(u).includes("/cover?")),
  ).toHaveLength(2);
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
  expect(Feed.all[2].close).toHaveBeenCalledOnce();
});

it("registers visible projects in batches and reconciles after a transport reconnect on the same feed", async () => {
  const cards = Array.from({ length: 35 }, (_, i) => card(String(i)));
  const feed = Feed.all[0];
  let revision = 0;
  fetcher.mockImplementation(async (url) => {
    const path = new URL(String(url), "https://studio.test");
    if (path.pathname.endsWith("/revisions")) {
      const ids = path.searchParams.get("ids")!.split(",");
      return Response.json(
        Object.fromEntries(ids.map((id) => [id, id === "2" ? revision : 0])),
      );
    }
    return revision && path.pathname.includes("/2/")
      ? image(revision)
      : new Response(null, { status: 202 });
  });
  for (const item of cards) item.visible(true);
  const ready = (stream: string) =>
    feed.dispatchEvent(
      new MessageEvent("ready", { data: JSON.stringify(stream) }),
    );
  ready("original");
  await tick();
  const batches = () =>
    fetcher.mock.calls
      .filter(([url]) => String(url).includes("/revisions?"))
      .map(([url]) => new URL(String(url), "https://studio.test").searchParams);
  expect(
    batches().map((params) => params.get("ids")!.split(",").length),
  ).toEqual([32, 3]);
  revision = 9;
  cards[3].visible(false);
  ready("reconnected");
  await tick();
  expect(
    batches()
      .slice(2)
      .every((params) => params.get("stream") === "reconnected"),
  ).toBe(true);
  expect(cards[2].changed).toHaveBeenLastCalledWith("blob:1");
  expect(Feed.all).toHaveLength(1);
});

it("discards a delayed revision check when the same project reappears on a different page", async () => {
  const first = card("p");
  first.visible(true);
  let finish: (response: Response) => void;
  fetcher.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  Feed.all[0].dispatchEvent(
    new MessageEvent("ready", { data: JSON.stringify("old") }),
  );
  await tick();
  first.stop();
  const second = card("p");
  finish!(Response.json({ p: 123 }));
  await tick();
  expect(second.changed.mock.calls).toEqual([[undefined]]);
  expect(
    fetcher.mock.calls.filter(([url]) => String(url).includes("/cover?")),
  ).toHaveLength(1);
});

it("loads a rebuilt missing file even if the publisher already reported that revision", async () => {
  const item = card("p");
  let available = false;
  fetcher.mockImplementation(async (url) =>
    String(url).includes("/revisions?")
      ? Response.json({ p: 7 })
      : available
        ? image(7)
        : new Response(null, { status: 202 }),
  );
  item.visible(true);
  Feed.all[0].dispatchEvent(
    new MessageEvent("ready", { data: JSON.stringify("stream") }),
  );
  await tick();
  available = true;
  Feed.all[0].send("p", 7);
  await tick();
  expect(item.changed).toHaveBeenLastCalledWith("blob:1");
});
