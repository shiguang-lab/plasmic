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

  get visible() {
    return Array.from(this.cards.values()).some(Boolean);
  }

  cancel() {
    this.read?.abort();
    this.read = undefined;
    window.clearTimeout(this.retry);
    this.retry = undefined;
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
  private source?: EventSource;
  private checks?: { stream: string; controller: AbortController };
  private checkScheduled = false;
  private checkRetry?: number;
  private reconnect?: number;
  private pageHidden = false;
  private stopDesktop: () => void;
  private elements = new Map<Element, (visible: boolean) => void>();
  private observer = new IntersectionObserver((entries) => {
    for (const entry of entries)
      this.elements.get(entry.target)?.(entry.isIntersecting);
    this.scheduleCheck();
  });

  constructor(readonly account: string) {
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
      if (
        !project ||
        event.publishedRevision < project.published ||
        event.publishedRevision <= project.displayed
      )
        return;
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
        for (const project of this.projects.values())
          project.setImage(undefined, 0);
        return;
      }
      for (const [id, project] of entries) {
        if (this.projects.get(id) !== project) continue;
        if (!Object.prototype.hasOwnProperty.call(revisions, id)) {
          project.cancel();
          project.published = 0;
          project.setImage(undefined, 0);
        } else {
          project.published = Math.max(project.published, revisions[id]);
          if (project.published > project.displayed)
            void this.fetchImage(id, project);
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
      (project.url && project.displayed >= project.published)
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
        project.published = 0;
        project.setImage(undefined, 0);
        return;
      }
      if (res.status === 202) return; // Missing cover queued; wait for publication.
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
          project.published > project.displayed
        )
          void this.fetchImage(id, project);
      }
    }
  }

  observe(element: Element, id: string, listener: Listener) {
    const project = this.projects.get(id) ?? new ProjectCover();
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
        project.setImage(undefined, 0);
        this.projects.delete(id);
      }
      if (!this.projects.size) this.dispose();
    };
  }

  dispose() {
    this.disconnect();
    document.removeEventListener("visibilitychange", this.updateActivity);
    window.removeEventListener("pagehide", this.hide);
    window.removeEventListener("pageshow", this.show);
    this.stopDesktop();
    this.observer.disconnect();
    this.elements.clear();
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
