// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TwitterWidget } from "./native-widgets";

let frame: HTMLIFrameElement;
let doc: Document;
let root: Root;
let container: HTMLDivElement;
let widgets: ReturnType<typeof makeWidgets>;
function makeWidgets() {
  const create = (_id: unknown, target: HTMLElement, _options: unknown) => {
    const element = target.ownerDocument.createElement("span");
    element.textContent = "Native widget";
    target.appendChild(element);
    return Promise.resolve(element);
  };
  return { createTweet: vi.fn(create), createTimeline: vi.fn(create), createFollowButton: vi.fn(create) };
}
function installApi() {
  const api = { widgets, ready(callback: (api: unknown) => void) { callback(api); } };
  Object.assign(frame.contentWindow as Window, { twttr: api });
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  frame = document.createElement("iframe");
  document.body.append(frame);
  doc = frame.contentDocument as Document;
  container = doc.createElement("div");
  doc.body.appendChild(container);
  root = createRoot(container);
  widgets = makeWidgets();
});
afterEach(async () => {
  await act(async () => root.unmount());
  frame.remove();
  vi.restoreAllMocks();
});

it("uses the official APIs with all existing component options", async () => {
  installApi();
  await act(async () => root.render(<>
    <TwitterWidget kind="tweet" identifier="123" theme="dark" />
    <TwitterWidget kind="timeline" identifier="https://twitter.com/plasmicapp" tweetLimit={4} chrome="noheader" theme="light" />
    <TwitterWidget kind="follow" identifier="plasmicapp" large />
  </>));
  expect(widgets.createTweet).toHaveBeenCalledWith("123", expect.objectContaining({ ownerDocument: doc }), { theme: "dark" });
  expect(widgets.createTimeline).toHaveBeenCalledWith({ sourceType: "url", url: "https://twitter.com/plasmicapp" }, expect.objectContaining({ ownerDocument: doc }), { tweetLimit: 4, chrome: "noheader", theme: "light" });
  expect(widgets.createFollowButton).toHaveBeenCalledWith("plasmicapp", expect.objectContaining({ ownerDocument: doc }), { size: "large" });
  expect(container.textContent).toBe("Native widgetNative widgetNative widget");
  expect(doc.querySelectorAll("script")).toHaveLength(0);
});

it("replaces widgets after a prop edit and detaches old SDK targets", async () => {
  installApi();
  await act(async () => root.render(<TwitterWidget kind="tweet" identifier="123" theme="light" />));
  const target = widgets.createTweet.mock.calls[0][1];
  await act(async () => root.render(<TwitterWidget kind="tweet" identifier="456" theme="dark" />));
  expect(widgets.createTweet).toHaveBeenCalledTimes(2);
  expect(target.isConnected).toBe(false);
  expect(container.textContent).toBe("Native widget");
  await act(async () => root.render(<TwitterWidget kind="follow" identifier="other" />));
  expect(widgets.createFollowButton.mock.calls[0][2]).toEqual({ size: undefined });
});

it("loads one SDK per document and ignores a widget removed before SDK readiness", async () => {
  await act(async () => root.render(<>
    <TwitterWidget key="one" kind="tweet" identifier="123" />
    <TwitterWidget key="two" kind="tweet" identifier="456" />
  </>));
  expect(doc.querySelectorAll('script[src="https://platform.twitter.com/widgets.js"]')).toHaveLength(1);
  expect(document.querySelector('script[src="https://platform.twitter.com/widgets.js"]')).toBeNull();
  await act(async () => root.render(<TwitterWidget key="two" kind="tweet" identifier="456" />));
  const queued = (frame.contentWindow as any).twttr._e;
  installApi();
  await act(async () => queued.forEach((callback: (api: unknown) => void) => callback((frame.contentWindow as any).twttr)));
  expect(widgets.createTweet).toHaveBeenCalledTimes(1);
  expect(widgets.createTweet.mock.calls[0][0]).toBe("456");
});

it("does not reconnect an async widget after unmount", async () => {
  installApi();
  let finish: (() => void) | undefined;
  widgets.createTweet.mockImplementation((_id, target) => new Promise((resolve) => {
    finish = () => {
      const late = doc.createElement("span");
      late.textContent = "Late widget";
      target.appendChild(late);
      resolve(late);
    };
  }));
  await act(async () => root.render(<TwitterWidget kind="tweet" identifier="123" />));
  const target = widgets.createTweet.mock.calls[0][1];
  await act(async () => root.render(null));
  await act(async () => finish?.());
  expect(target.isConnected).toBe(false);
  expect(container.textContent).toBe("");
});

it("allows a failed script to retry on the next mount", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  await act(async () => root.render(<TwitterWidget kind="tweet" identifier="123" />));
  await act(async () => doc.querySelector("script")?.dispatchEvent(new Event("error")));
  expect(error).toHaveBeenCalledWith("Twitter widget failed to load", expect.any(Error));
  expect(doc.querySelector("script")).toBeNull();
  await act(async () => root.render(null));
  await act(async () => root.render(<TwitterWidget kind="tweet" identifier="123" />));
  expect(doc.querySelectorAll("script")).toHaveLength(1);
  const queued = (frame.contentWindow as any).twttr._e;
  installApi();
  await act(async () => queued.forEach((callback: (api: unknown) => void) => callback((frame.contentWindow as any).twttr)));
  expect(widgets.createTweet).toHaveBeenCalledTimes(1);
});

it("renders an inert container during native React server rendering", () => {
  expect(renderToString(<TwitterWidget kind="tweet" identifier="123" />)).toBe("<div></div>");
  expect(doc.querySelector("script")).toBeNull();
});
