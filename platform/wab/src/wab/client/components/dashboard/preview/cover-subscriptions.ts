import {
  isDesktopViewActive,
  subscribeDesktopView,
} from "@/wab/client/desktop-navigation";
import {
  coverRevisionBatchSize,
  coverRevisionHeader,
  PublishedCover,
} from "@/wab/shared/project-covers";

type Listener = (url: string | undefined) => void;

class ProjectCover {
  cards = new Map<Listener, boolean>();
  displayed = 0;
  published = 0;
  url?: string;
  read?: AbortController;
  retry?: number;
  needsCheck = true;
  recovery: "none" | "fetch" | "waiting" = "none";

  get visible() {
    return Array.from(this.cards.values()).some(Boolean);
  }

  cancel() {
    this.read?.abort();
    this.read = undefined;
    window.clearTimeout(this.retry);
    this.retry = undefined;
    this.recovery = "none";
  }

  setImage(url: string | undefined, revision: number) {
    const old = this.url;
    this.url = url;
    this.displayed = revision;
    for (const listener of this.cards.keys()) listener(url);
    if (old) URL.revokeObjectURL(old);
  }
}

class CoverSubscriptions {
  private projects = new Map<string, ProjectCover>();
  // Detached cards keep their decoded cover URL for a return to the list.
  private recent = new Map<string, { url: string; revision: number }>();
  private source?: EventSource;
  private checks?: { stream: string; controller: AbortController };
  private checkScheduled = false;
  private checkRetry?: number;
  private reconnect?: number;
  private pageHidden = false;
  private stopDesktop?: () => void;
  private elements = new Map<Element, (visible: boolean) => void>();
  private observer = new IntersectionObserver((entries) => {
    for (const entry of entries)
      this.elements.get(entry.target)?.(entry.isIntersecting);
    this.scheduleCheck();
  });

  constructor(readonly account: string) {}

  private start() {
    this.pageHidden = false;
    document.addEventListener("visibilitychange", this.updateActivity);
    window.addEventListener("pagehide", this.hide);
    window.addEventListener("pageshow", this.show);
    this.stopDesktop = subscribeDesktopView(this.updateActivity);
  }

  private hide = () => {
    this.pageHidden = true;
    this.updateActivity();
  };
  private show = () => {
    this.pageHidden = false;
    this.updateActivity();
  };

  private updateActivity = () => {
    if (
      this.pageHidden ||
      document.hidden ||
      !isDesktopViewActive() ||
      !this.projects.size
    ) {
      this.disconnect();
      return;
    }
    if (this.source || this.reconnect !== undefined) return;
    const source = new EventSource(
      "/api/v1/project-covers/events?account=" +
        encodeURIComponent(this.account),
    );
    this.source = source;
    source.addEventListener("ready", (message: MessageEvent) => {
      if (source !== this.source) return;
      this.checks?.controller.abort();
      this.checks = {
        stream: JSON.parse(message.data),
        controller: new AbortController(),
      };
      for (const project of this.projects.values()) project.needsCheck = true;
      this.scheduleCheck();
    });
    source.addEventListener("coverReady", (message: MessageEvent) => {
      if (source !== this.source) return;
      const event: PublishedCover = JSON.parse(message.data);
      const project = this.projects.get(event.projectId);
      const recoversDisplayedRevision =
        !!project &&
        project.recovery !== "none" &&
        event.publishedRevision === project.displayed;
      if (
        !project ||
        event.publishedRevision < project.published ||
        (event.publishedRevision <= project.displayed &&
          !recoversDisplayedRevision)
      )
        return;
      if (project.recovery === "waiting") {
        project.recovery = "fetch";
      }
      project.published = event.publishedRevision;
      void this.fetchImage(event.projectId, project);
    });
    source.onerror = () => {
      if (source !== this.source) return;
      this.checks?.controller.abort();
      this.checks = undefined;
      if (source.readyState === EventSource.CLOSED) {
        // Browsers also stop retrying after a proxy returns a non-SSE response.
        this.disconnect();
        this.reconnect = window.setTimeout(() => {
          this.reconnect = undefined;
          this.updateActivity();
        }, 10_000);
      }
    };
    // A visible card can still request its first image while the feed connects.
    for (const [id, project] of this.projects) {
      if (!project.url) void this.fetchImage(id, project);
    }
  };

  private disconnect() {
    const source = this.source;
    this.source = undefined;
    source?.close();
    this.checks?.controller.abort();
    this.checks = undefined;
    window.clearTimeout(this.checkRetry);
    window.clearTimeout(this.reconnect);
    this.reconnect = undefined;
    for (const project of this.projects.values()) project.cancel();
  }

  private scheduleCheck() {
    if (!this.checks || this.checkScheduled) return;
    this.checkScheduled = true;
    queueMicrotask(() => {
      this.checkScheduled = false;
      const checks = this.checks;
      if (!checks) return;
      const pending = [...this.projects].filter(
        ([, p]) => p.visible && p.needsCheck,
      );
      for (const [, project] of pending) project.needsCheck = false;
      for (let i = 0; i < pending.length; i += coverRevisionBatchSize) {
        void this.reconcile(
          pending.slice(i, i + coverRevisionBatchSize),
          checks.stream,
          checks.controller.signal,
        );
      }
    });
  }

  private async reconcile(
    entries: [string, ProjectCover][],
    stream: string,
    signal: AbortSignal,
  ) {
    const params = new URLSearchParams({
      account: this.account,
      stream,
      ids: entries.map(([id]) => id).join(","),
    });
    try {
      const res = await fetch("/api/v1/project-covers/revisions?" + params, {
        signal,
        cache: "no-store",
      });
      const denied = res.status === 401 || res.status === 403;
      if (!res.ok && !denied) throw new Error("Cover revisions unavailable");
      const revisions: Record<string, number> = denied ? {} : await res.json();
      if (signal.aborted) return;
      if (denied) {
        this.disconnect();
        this.clearRecent();
        for (const project of this.projects.values())
          project.setImage(undefined, 0);
        return;
      }
      for (const [id, project] of entries) {
        const allowed = Object.prototype.hasOwnProperty.call(revisions, id);
        if (this.projects.get(id) !== project) {
          if (!allowed && !this.projects.has(id)) this.forgetRecent(id);
          continue;
        }
        if (!allowed) {
          project.cancel();
          project.published = 0;
          project.setImage(undefined, 0);
        } else {
          project.published = Math.max(project.published, revisions[id]);
          if (revisions[id] === 0 && project.url && project.displayed > 0) {
            if (project.recovery === "none") {
              project.recovery = "fetch";
              void this.fetchImage(id, project);
            }
          } else if (
            project.published > project.displayed ||
            (project.recovery === "waiting" &&
              revisions[id] > 0 &&
              revisions[id] >= project.displayed)
          ) {
            if (project.recovery === "waiting") {
              project.recovery = "fetch";
            }
            void this.fetchImage(id, project);
          }
        }
      }
    } catch {
      if (signal.aborted) return;
      for (const [, project] of entries) project.needsCheck = true;
      window.clearTimeout(this.checkRetry);
      this.checkRetry = window.setTimeout(() => this.scheduleCheck(), 10_000);
    }
  }

  private async fetchImage(id: string, project: ProjectCover) {
    if (
      !this.source ||
      !project.visible ||
      project.read ||
      (project.url &&
        project.displayed >= project.published &&
        project.recovery !== "fetch")
    )
      return;
    window.clearTimeout(project.retry);
    const read = new AbortController();
    project.read = read;
    const requested = project.published;
    let candidate: string | undefined;
    try {
      const res = await fetch(
        "/api/v1/projects/" +
          encodeURIComponent(id) +
          "/cover?account=" +
          encodeURIComponent(this.account),
        {
          signal: read.signal,
          cache: "no-store",
        },
      );
      if (read.signal.aborted) return;
      if ([401, 403, 404].includes(res.status)) {
        project.recovery = "none";
        project.published = 0;
        project.setImage(undefined, 0);
        return;
      }
      if (res.status === 202) {
        project.recovery = "waiting";
        return; // Missing cover queued; wait for publication.
      }
      if (!res.ok) throw new Error("Cover unavailable");
      const revision = Number(res.headers.get(coverRevisionHeader));
      const blob = await res.blob();
      if (read.signal.aborted) return;
      if (
        !Number.isSafeInteger(revision) ||
        revision < 1 ||
        revision < requested
      ) {
        throw new Error("Cover revision unavailable");
      }
      candidate = URL.createObjectURL(blob);
      const image = new Image();
      image.src = candidate;
      await image.decode();
      if (read.signal.aborted || revision < project.published) return;
      project.recovery = "none";
      project.published = revision;
      project.setImage(candidate, revision);
      candidate = undefined;
    } catch {
      if (!read.signal.aborted) {
        project.retry = window.setTimeout(
          () => void this.fetchImage(id, project),
          10_000,
        );
      }
    } finally {
      if (candidate) URL.revokeObjectURL(candidate);
      if (project.read === read) {
        project.read = undefined;
        if (
          project.published > requested &&
          (project.published > project.displayed ||
            (project.recovery !== "none" &&
              project.published === project.displayed))
        ) {
          if (project.recovery === "waiting") {
            project.recovery = "fetch";
          }
          void this.fetchImage(id, project);
        }
      }
    }
  }

  observe(element: Element, id: string, listener: Listener) {
    if (!this.projects.size) this.start();
    const project = this.projects.get(id) ?? new ProjectCover();
    const cached = this.recent.get(id);
    if (cached) {
      this.recent.delete(id);
      project.setImage(cached.url, cached.revision);
    }
    this.projects.set(id, project);
    project.cards.set(listener, false);
    listener(project.url);
    this.updateActivity();
    this.elements.set(element, (visible) => {
      project.cards.set(listener, visible);
      if (visible) void this.fetchImage(id, project);
    });
    this.observer.observe(element);
    return () => {
      if (!project.cards.delete(listener)) return;
      this.elements.delete(element);
      this.observer.unobserve(element);
      if (!project.cards.size) {
        project.cancel();
        if (project.url) {
          this.recent.set(id, { url: project.url, revision: project.displayed });
          if (this.recent.size > 48) {
            const oldest = this.recent.keys().next();
            if (!oldest.done) this.forgetRecent(oldest.value);
          }
        }
        this.projects.delete(id);
      }
      if (!this.projects.size) this.stop();
    };
  }

  private forgetRecent(id: string) {
    const cached = this.recent.get(id);
    if (cached) {
      URL.revokeObjectURL(cached.url);
      this.recent.delete(id);
    }
  }

  private clearRecent() {
    for (const id of this.recent.keys()) this.forgetRecent(id);
  }

  private stop() {
    this.disconnect();
    document.removeEventListener("visibilitychange", this.updateActivity);
    window.removeEventListener("pagehide", this.hide);
    window.removeEventListener("pageshow", this.show);
    this.stopDesktop?.();
    this.stopDesktop = undefined;
    this.observer.disconnect();
    this.elements.clear();
  }

  dispose() {
    this.stop();
    this.clearRecent();
    for (const project of this.projects.values()) {
      project.setImage(undefined, 0);
      project.cards.clear();
    }
    this.projects.clear();
    if (subscriptions === this) subscriptions = undefined;
  }
}

let subscriptions: CoverSubscriptions | undefined;

export function observeCover(
  element: Element,
  account: string,
  projectId: string,
  listener: Listener,
) {
  if (subscriptions?.account !== account) {
    subscriptions?.dispose();
    subscriptions = new CoverSubscriptions(account);
  }
  return subscriptions.observe(element, projectId, listener);
}
