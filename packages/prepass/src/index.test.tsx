import {
  HeadMetadataContext,
  useMutablePlasmicQueryData,
  usePlasmicPrepass,
  usePlasmicQueryData,
} from "@plasmicapp/query";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { unstable_serialize } from "swr";
import { expect, it, vi } from "vitest";
import { extractPlasmicQueryData, plasmicPrepassExtract } from "./index";

it("awaits dependent queries, spreads tuple keys and deduplicates repeated components", async () => {
  const first = vi.fn(async (name: string, id: number) => ({ id, name }));
  const detail = vi.fn(async (_name: string, id: number) => ({
    label: `Item ${id}`,
  }));
  function Item() {
    const parent = usePlasmicQueryData(["items", 7], first);
    const child = usePlasmicQueryData(
      () => (parent.data ? ["detail", parent.data.id] : null),
      detail,
    );
    return <span>{child.data?.label}</span>;
  }
  expect(
    await extractPlasmicQueryData(
      <>
        <Item />
        <Item />
      </>,
    ),
  ).toEqual({
    [unstable_serialize(["items", 7])]: { id: 7, name: "items" },
    [unstable_serialize(["detail", 7])]: { label: "Item 7" },
  });
  expect(first).toHaveBeenCalledExactlyOnceWith("items", 7);
  expect(detail).toHaveBeenCalledExactlyOnceWith("detail", 7);
});

it("returns query failures without dropping successful siblings or retrying", async () => {
  const failed = vi.fn(async () => {
    throw new Error("fetch failed");
  });
  const success = vi.fn(async () => 0);
  const errors: string[] = [];
  function Queries() {
    const a = usePlasmicQueryData("failure", failed);
    const b = useMutablePlasmicQueryData<number, Error>(
      "mutable failure",
      failed,
    );
    const c = useMutablePlasmicQueryData("zero", success);
    if (a.error && b.error) {errors.push(a.error.message, b.error.message);}
    return <span>{c.data}</span>;
  }
  expect(await extractPlasmicQueryData(<Queries />)).toEqual({ zero: 0 });
  expect(errors).toContain("fetch failed");
  expect(failed).toHaveBeenCalledTimes(2);
  expect(success).toHaveBeenCalledTimes(1);
});

it("isolates concurrent extractions with the same query key", async () => {
  const finish: ((value: string) => void)[] = [];
  let started!: () => void;
  const bothStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  function Item() {
    const result = usePlasmicQueryData(
      "same-key",
      () =>
        new Promise<string>((resolve) => {
          finish.push(resolve);
          if (finish.length === 2) {started();}
        }),
    );
    return <span>{result.data}</span>;
  }
  const first = extractPlasmicQueryData(<Item />);
  const second = extractPlasmicQueryData(<Item />);
  await bothStarted;
  finish[1]("second request");
  finish[0]("first request");
  expect(await first).toEqual({ "same-key": "first request" });
  expect(await second).toEqual({ "same-key": "second request" });
});

it("uses native React 19 hooks and the server external-store snapshot", async () => {
  const promise = Promise.resolve("native hooks");
  const clientSnapshot = vi.fn(() => {
    throw new Error("client snapshot during SSR");
  });
  const seen: unknown[] = [];
  function Hooks() {
    const message = React.use(promise);
    const [actionState] = React.useActionState(
      async (value: number) => value + 1,
      3,
    );
    const [optimistic] = React.useOptimistic("stable");
    const event = React.useEffectEvent(() => {});
    const snapshot = React.useSyncExternalStore(
      () => () => {},
      clientSnapshot,
      () => "server",
    );
    seen.push({
      message,
      actionState,
      optimistic,
      snapshot,
      event: typeof event,
      prepass: usePlasmicPrepass(),
    });
    return null;
  }
  expect(await extractPlasmicQueryData(<Hooks />)).toEqual({});
  expect(seen).toContainEqual({
    message: "native hooks",
    actionState: 3,
    optimistic: "stable",
    snapshot: "server",
    event: "function",
    prepass: true,
  });
  expect(clientSnapshot).not.toHaveBeenCalled();
});

it("keeps head metadata, JSON-safe values and client-only query filtering", async () => {
  function Metadata() {
    const head = React.use(HeadMetadataContext);
    if (!head) { throw new Error("Missing request metadata collector"); }
    head.collect({ title: "Saved page" });
    usePlasmicQueryData("$csq$client", async () => "private");
    usePlasmicQueryData("$swr$internal", async () => "internal");
    usePlasmicQueryData("empty", async () => undefined);
    usePlasmicQueryData("json", async () => ({
      missing: undefined,
      date: new Date("2026-01-01T00:00:00Z"),
    }));
    return null;
  }
  expect(await plasmicPrepassExtract(<Metadata />)).toEqual({
    queryData: { json: { missing: null, date: "2026-01-01T00:00:00.000Z" } },
    headMetadata: { title: "Saved page" },
  });
});

it("reads prepass only from the current provider, without leaking into ordinary SSR", async () => {
  const seen: boolean[] = [];
  function Status() {
    seen.push(usePlasmicPrepass());
    return null;
  }
  renderToStaticMarkup(<Status />);
  await extractPlasmicQueryData(<Status />);
  renderToStaticMarkup(<Status />);
  expect(seen).toEqual([false, true, false]);
});

it("isolates head metadata and identical query keys across concurrent requests", async () => {
  let resolveFirst: (title: string) => void = () => { throw new Error("First request not initialized"); };
  let resolveSecond: (title: string) => void = () => { throw new Error("Second request not initialized"); };
  const firstTitle = new Promise<string>((resolve) => { resolveFirst = resolve; });
  const secondTitle = new Promise<string>((resolve) => { resolveSecond = resolve; });
  function Page({title}: {title: Promise<string>}) {
    const head = React.use(HeadMetadataContext);
    const result = usePlasmicQueryData("request-title", () => title);
    if (!head) throw new Error("Missing request collector");
    if (result.data) head.collect({title: result.data});
    return null;
  }
  const first = plasmicPrepassExtract(<Page title={firstTitle} />);
  const second = plasmicPrepassExtract(<Page title={secondTitle} />);
  resolveSecond("Second page");
  expect(await second).toEqual({queryData: {"request-title": "Second page"}, headMetadata: {title: "Second page"}});
  resolveFirst("First page");
  expect(await first).toEqual({queryData: {"request-title": "First page"}, headMetadata: {title: "First page"}});
});
