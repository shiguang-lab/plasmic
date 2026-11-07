import { useEffect, useRef } from "react";

type WidgetResult = Promise<HTMLElement | undefined>;
interface TwitterWidgets {
  createTimeline(source: { sourceType: "url"; url: string }, target: HTMLElement, options: { tweetLimit?: number; chrome?: string; theme?: string }): WidgetResult;
  createTweet(id: string, target: HTMLElement, options: { theme?: string }): WidgetResult;
  createFollowButton(username: string, target: HTMLElement, options: { size?: string }): WidgetResult;
}
interface TwitterApi {
  widgets?: TwitterWidgets;
  _e?: Array<(api: TwitterApi) => void>;
  ready(callback: (api: TwitterApi) => void): void;
}
type TwitterWindow = Window & { twttr?: TwitterApi };
const scriptUrl = "https://platform.twitter.com/widgets.js";
const loaders = new WeakMap<Document, Promise<TwitterWidgets>>();

function loadWidgets(doc: Document): Promise<TwitterWidgets> {
  const win = doc.defaultView as TwitterWindow | null;
  if (!win) return Promise.reject(new Error("Twitter widgets require a window"));
  if (win.twttr?.widgets) return Promise.resolve(win.twttr.widgets);
  const pending = loaders.get(doc);
  if (pending) return pending;

  // This is the official widgets.js ready queue. Each canvas document owns its
  // SDK and script; no parent window or React internals are involved.
  const api = win.twttr ?? (win.twttr = {
    _e: [],
    ready(callback) { this._e?.push(callback); },
  });
  const promise = new Promise<TwitterWidgets>((resolve, reject) => {
    const existing = doc.querySelector<HTMLScriptElement>(`script[src="${scriptUrl}"]`);
    const script = existing ?? doc.createElement("script");
    api.ready((readyApi) => {
      if (readyApi.widgets) resolve(readyApi.widgets);
      else reject(new Error("Twitter widgets API did not initialize"));
    });
    script.addEventListener("error", () => {
      script.remove();
      reject(new Error("Twitter widgets script failed to load"));
    }, { once: true });
    if (!existing) {
      script.src = scriptUrl;
      script.async = true;
      doc.head.appendChild(script);
    }
  }).catch((error) => {
    loaders.delete(doc);
    throw error;
  });
  loaders.set(doc, promise);
  return promise;
}

export function TwitterWidget({
  kind, identifier, tweetLimit, chrome, theme, large,
}: {
  kind: "timeline" | "tweet" | "follow";
  identifier: string;
  tweetLimit?: number;
  chrome?: string;
  theme?: string;
  large?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const target = container.ownerDocument.createElement("div");
    container.appendChild(target);
    let cancelled = false;
    void loadWidgets(container.ownerDocument).then((widgets) => {
      if (cancelled) return;
      switch (kind) {
        case "timeline": return widgets.createTimeline({ sourceType: "url", url: identifier }, target, { tweetLimit, chrome, theme });
        case "tweet": return widgets.createTweet(identifier, target, { theme });
        case "follow": return widgets.createFollowButton(identifier, target, { size: large ? "large" : undefined });
      }
    }).catch((error) => {
      if (!cancelled) console.error("Twitter widget failed to load", error);
    });
    return () => {
      cancelled = true;
      // Late SDK work can only append to this detached target.
      target.remove();
    };
  }, [kind, identifier, tweetLimit, chrome, theme, large]);
  return <div ref={host} />;
}
