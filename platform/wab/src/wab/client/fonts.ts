import { getUiLocale } from "@/wab/client/i18n";
import { translate } from "@/wab/client/i18n/locales";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { derefTokenRefs } from "@/wab/commons/StyleToken";
import { extractUsedFontsFromComponents } from "@/wab/shared/codegen/fonts";
import { assertNever, spawn } from "@/wab/shared/common";
import type { ModelChange } from "@/wab/shared/core/observable-model";
import { walkDependencyTree } from "@/wab/shared/core/project-deps";
import { siteFinalStyleTokensAllDeps } from "@/wab/shared/core/site-style-tokens";
import { isFontFamilyKeyword } from "@/wab/shared/css";
import {
  FontInstallSpec,
  getFontSpec,
  toGoogleFontInstallSpec,
} from "@/wab/shared/fonts";
import { getGoogFontsMeta, makeGoogleFontApiUrl } from "@/wab/shared/googfonts";
import { ProjectDependency, Site } from "@/wab/shared/model/classes";
import { maybeUnquote } from "@/wab/shared/strs";
import { notification } from "antd";
import $ from "jquery";
import L from "lodash";
import * as US from "underscore.string";
import { shallow } from "zustand/shallow";
import { createStore, StoreApi } from "zustand/vanilla";

// From http://www.ampsoft.net/webdesign-l/WindowsMacFonts.html
const commonLocalFonts = L(
  US.lines(
    `\
Arial
Arial Black
New York Extra Large
New York Large
New York Medium
New York Small
Comic Sans
Courier New
Futura
Futura PT Web
Futura PT Web Light
Georgia
Impact
Lucida Console
Lucida Sans Unicode
Meta Serif Pro
Palatino Linotype
Book Antiqua
Tahoma
Times New Roman
Trebuchet MS
Verdana
SF Compact Display
SF Compact Rounded
SF Compact Text
SF Mono
SF Pro Display
SF Pro Rounded
SF Pro Text
Symbol
Webdings
Wingdings
MS Sans Serif
system-ui\
`.trim(),
  ) as string[],
)
  .uniq()
  .sort()
  .value();

const plasmicTestFont = "plasmicTestFont";

interface NotificationArgs {
  message: string;
  description: string;
}

class ThrottledNotification {
  private doNotify: ReturnType<typeof L.throttle>;
  constructor(argsProps: NotificationArgs, waitMs: number) {
    const warnMissingFont = () => {
      notification.warning(argsProps);
    };
    this.doNotify = L.throttle(warnMissingFont, waitMs);
  }
  notify() {
    this.doNotify();
  }
  dispose() {
    this.doNotify.cancel();
  }
}

export interface FontState {
  readonly managedFonts: readonly FontInstallSpec[];
  /** Fonts declared by this project, in model order. */
  readonly ownUserManagedFonts: readonly string[];
  /** Unique fonts from direct dependencies, excluding own fonts. */
  readonly importedUserManagedFonts: readonly string[];
  /** Own and imported fonts combined; kept for availability and host checks. */
  readonly userManagedFonts: readonly string[];
  readonly availableFonts: readonly FontInstallSpec[];
  readonly localFonts: ReadonlySet<string>;
  readonly hostFonts: ReadonlySet<string>;
  readonly usedFonts: readonly FontInstallSpec[];
  readonly missingUsedFonts: readonly string[];
}

interface UserManagedFontLists {
  readonly own: readonly string[];
  readonly imported: readonly string[];
  readonly all: readonly string[];
}

/** Single source of truth for the immutable font lists captured with a site. */
function userManagedFontLists(site: Site): UserManagedFontLists {
  const own = Object.freeze([...site.userManagedFonts]);
  const ownFonts = new Set(own);
  const imported = Object.freeze(
    L.uniq(
      site.projectDependencies.flatMap((dep) =>
        dep.site.userManagedFonts.filter((font) => !ownFonts.has(font)),
      ),
    ),
  );
  return {
    own,
    imported,
    all: Object.freeze(L.uniq([...own, ...imported])),
  };
}

function availableFonts(
  managed: readonly FontInstallSpec[],
  user: readonly string[],
) {
  const families = new Set(managed.map((font) => font.fontFamily));
  return [
    ...managed,
    ...user
      .filter((font) => !families.has(font))
      .map((fontFamily) => ({ fontType: "local" as const, fontFamily })),
  ];
}

function missingFonts(
  used: readonly FontInstallSpec[],
  local: ReadonlySet<string>,
  host: ReadonlySet<string>,
) {
  return used
    .filter(
      (font) =>
        font.fontType === "local" &&
        !isFontFamilyKeyword(font.fontFamily) &&
        !local.has(font.fontFamily) &&
        !host.has(font.fontFamily),
    )
    .map((font) => font.fontFamily);
}

export class FontManager {
  private readonly state: StoreApi<FontState>;
  readonly store: Pick<
    StoreApi<FontState>,
    "getState" | "getInitialState" | "subscribe"
  >;
  private _loaded = false;
  private stopped = false;
  private pendingLocalFonts = new Set<string>();
  private localFontInstallAttempts = new Set<FontInstallSpec>();
  private notifiers = new Map<string, ThrottledNotification>();
  private hostObservers = new Set<() => void>();

  constructor(private site: Site) {
    const usedFonts = [
      ...extractUsedFontsFromComponents(site, site.components),
      ...walkDependencyTree(site, "all").flatMap((dep) =>
        extractUsedFontsFromComponents(dep.site, dep.site.components),
      ),
    ];
    const managedFonts = getGoogFontsMeta().items.map(toGoogleFontInstallSpec);
    const fontLists = userManagedFontLists(site);
    const localFonts = new Set<string>();
    const hostFonts = new Set<string>();
    this.state = createStore<FontState>(() => ({
      usedFonts,
      managedFonts,
      ownUserManagedFonts: fontLists.own,
      importedUserManagedFonts: fontLists.imported,
      userManagedFonts: fontLists.all,
      localFonts,
      hostFonts,
      availableFonts: availableFonts(managedFonts, fontLists.all),
      missingUsedFonts: missingFonts(usedFonts, localFonts, hostFonts),
    }));
    this.store = {
      getState: this.state.getState,
      getInitialState: this.state.getInitialState,
      subscribe: this.state.subscribe,
    };
    spawn(
      asyncTestFonts(
        L.uniq([
          ...commonLocalFonts,
          ...fontLists.all,
          ...usedFonts.map((font) => font.fontFamily),
        ]),
      ).then((avails) => {
        if (this.stopped) {
          return;
        }
        const googleFamilies = new Set(
          managedFonts.map((font) => font.fontFamily),
        );
        this.publish({
          managedFonts: [
            ...managedFonts,
            ...commonLocalFonts
              .filter((font) => avails.includes(font))
              .map((fontFamily) => ({
                fontType: "local" as const,
                fontFamily,
              })),
          ],
          localFonts: new Set(
            avails.filter((font) => !googleFamilies.has(font)),
          ),
        });
        this._loaded = true;
        this.localFontInstallAttempts.forEach((spec) =>
          this.tryWarnMissingPlasmicManagedFont(spec.fontFamily),
        );
        this.localFontInstallAttempts.clear();
      }),
    );
  }

  /** Called with committed model writes, including undo/redo and remote merges. */
  syncSite(site: Site, changes?: readonly ModelChange[]) {
    if (this.stopped) {
      return;
    }
    const replacing = site !== this.site;
    if (
      !replacing &&
      changes &&
      !changes.some((change) =>
        ["userManagedFonts", "projectDependencies", "site"].includes(
          change.changeNode.field,
        ),
      )
    ) {
      return;
    }
    this.site = site;
    const fontLists = userManagedFontLists(site);
    this.publish({
      ownUserManagedFonts: fontLists.own,
      importedUserManagedFonts: fontLists.imported,
      userManagedFonts: fontLists.all,
    });
  }

  private publish(patch: Partial<FontState>) {
    if (this.stopped) {
      return;
    }
    this.state.setState((previous) => {
      const next = { ...previous, ...patch };
      if (shallow(next.ownUserManagedFonts, previous.ownUserManagedFonts)) {
        next.ownUserManagedFonts = previous.ownUserManagedFonts;
      }
      if (
        shallow(
          next.importedUserManagedFonts,
          previous.importedUserManagedFonts,
        )
      ) {
        next.importedUserManagedFonts = previous.importedUserManagedFonts;
      }
      if (shallow(next.userManagedFonts, previous.userManagedFonts)) {
        next.userManagedFonts = previous.userManagedFonts;
      }
      if (shallow(next.localFonts, previous.localFonts)) {
        next.localFonts = previous.localFonts;
      }
      if (shallow(next.hostFonts, previous.hostFonts)) {
        next.hostFonts = previous.hostFonts;
      }
      if (
        next.managedFonts !== previous.managedFonts ||
        next.userManagedFonts !== previous.userManagedFonts
      ) {
        next.availableFonts = availableFonts(
          next.managedFonts,
          next.userManagedFonts,
        );
      }
      if (
        next.usedFonts !== previous.usedFonts ||
        next.localFonts !== previous.localFonts ||
        next.hostFonts !== previous.hostFonts
      ) {
        const missing = missingFonts(
          next.usedFonts,
          next.localFonts,
          next.hostFonts,
        );
        next.missingUsedFonts = shallow(missing, previous.missingUsedFonts)
          ? previous.missingUsedFonts
          : missing;
      }
      return shallow(next, previous) ? previous : next;
    });
  }

  isUserManagedFontInstalled = (family: string) => {
    const state = this.store.getState();
    return (
      isFontFamilyKeyword(family) ||
      state.localFonts.has(family) ||
      state.hostFonts.has(family)
    );
  };

  /** Track declarations without fetching unused font weights or Unicode subsets. */
  observeHostFonts(win: Window) {
    const doc = win.document;
    const fonts = doc.fonts;
    if (!fonts || this.stopped) {
      return () => undefined;
    }
    let disposed = false;
    const refresh = () => {
      if (disposed || this.stopped) {
        return;
      }
      const state = this.store.getState();
      const hostFamilies = new Set<string>();
      fonts.forEach((face) => {
        if (face.status !== "error") {
          hostFamilies.add(maybeUnquote(face.family).toLowerCase());
        }
      });
      const families = L.uniq([
        ...state.userManagedFonts,
        ...state.usedFonts.map((font) => font.fontFamily),
      ]);
      this.publish({
        hostFonts: new Set(
          families.filter((family) => hostFamilies.has(family.toLowerCase())),
        ),
      });
    };
    const stop = this.store.subscribe((next, previous) => {
      if (
        next.userManagedFonts !== previous.userManagedFonts ||
        next.usedFonts !== previous.usedFonts
      ) {
        refresh();
      }
    });
    refresh();
    fonts.addEventListener("loadingdone", refresh);
    fonts.addEventListener("loadingerror", refresh);
    const stylesObserver = new MutationObserver(refresh);
    if (doc.head) {
      stylesObserver.observe(doc.head, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["href", "media", "disabled"],
      });
    }
    const onStylesheetLoad = (event: Event) => {
      if ((event.target as Element).tagName === "LINK") {
        refresh();
      }
    };
    doc.addEventListener("load", onStylesheetLoad, true);
    const proto = (win as typeof window).CSSStyleSheet.prototype;
    let refreshQueued = false;
    const unpatches = (["insertRule", "deleteRule"] as const).map((method) => {
      const original = proto[method] as (...args: unknown[]) => unknown;
      const patched = function (this: CSSStyleSheet, ...args: unknown[]) {
        const result = original.apply(this, args);
        if (!refreshQueued) {
          refreshQueued = true;
          queueMicrotask(() => {
            refreshQueued = false;
            refresh();
          });
        }
        return result;
      };
      proto[method] = patched as any;
      return () => {
        if (proto[method] === (patched as unknown)) {
          proto[method] = original as any;
        }
      };
    });
    spawn(fonts.ready.then(refresh));
    const dispose = () => {
      if (disposed) {
        return;
      }
      disposed = true;
      stop();
      fonts.removeEventListener("loadingdone", refresh);
      fonts.removeEventListener("loadingerror", refresh);
      stylesObserver.disconnect();
      doc.removeEventListener("load", onStylesheetLoad, true);
      unpatches.forEach((unpatch) => unpatch());
      this.hostObservers.delete(dispose);
      this.publish({ hostFonts: new Set() });
    };
    this.hostObservers.add(dispose);
    return dispose;
  }

  dispose() {
    if (this.stopped) {
      return;
    }
    this.stopped = true;
    this.hostObservers.forEach((dispose) => dispose());
    this.hostObservers.clear();
    this.localFontInstallAttempts.clear();
    this.pendingLocalFonts.clear();
    this.notifiers.forEach((notifier) => notifier.dispose());
    this.notifiers.clear();
  }

  availFonts = () => this.store.getState().availableFonts;

  private tryWarnMissingPlasmicManagedFont = (fontFamily: string) => {
    // The picker lists common fonts only; availability also includes detected
    // local fonts and fonts supplied by the host. Wait for pending probes.
    if (
      this.pendingLocalFonts.has(fontFamily) ||
      this.isUserManagedFontInstalled(fontFamily)
    ) {
      return;
    }
    const availableFontFamilies = this.store
      .getState()
      .managedFonts.map((s) => s.fontFamily);
    if (!availableFontFamilies.includes(fontFamily)) {
      const notifier = this.notifiers.get(fontFamily);
      if (notifier) {
        notifier.notify();
      } else {
        this.notifiers.set(
          fontFamily,
          new ThrottledNotification(
            {
              message: translate(
                getUiLocale(),
                'Font "{part1}" is not available on this machine',
                { part1: String(fontFamily) },
              ),
              description: translate(
                getUiLocale(),
                "This font won't be rendered correctly.",
              ),
            },
            // 1 day
            24 * 3600 * 1000,
          ),
        );
      }
    }
  };

  addUserManagedFont = async (f: string) => {
    if (this.stopped) {
      return;
    }
    const avails = await asyncTestFonts([f]);
    if (avails.length === 1) {
      this.publish({
        localFonts: new Set([...this.store.getState().localFonts, avails[0]]),
      });
    }
  };

  private installFont = (
    htmlHeads: Array<JQuery>,
    fontSpec: FontInstallSpec,
  ) => {
    if (fontSpec.fontType === "local") {
      if (!this.site.userManagedFonts.includes(fontSpec.fontFamily)) {
        // We only warn missing fonts that is not in user managed fonts. This
        // means, when user has deleted the font from userManagedFonts, they
        // will be warned too.
        if (this._loaded) {
          this.tryWarnMissingPlasmicManagedFont(fontSpec.fontFamily);
        } else {
          this.localFontInstallAttempts.add(fontSpec);
        }
      }
      return;
    } else if (fontSpec.fontType === "google-font") {
      const url = makeGoogleFontApiUrl(fontSpec.fontFamily);
      htmlHeads.forEach(($head) => {
        const $link = $("<link />", {
          rel: "stylesheet",
          href: url,
          crossOrigin: "anonymous",
        });
        $head.append($link);
      });
      return;
    } else {
      assertNever(fontSpec);
    }
  };

  installAllUsedFonts = (htmlHeads: Array<JQuery>) => {
    if (this.stopped) {
      return;
    }
    this.store
      .getState()
      .usedFonts.forEach((fontSpec) => this.installFont(htmlHeads, fontSpec));
  };

  missingUsedFonts = () => this.store.getState().missingUsedFonts;

  useFont = (studioCtx: StudioCtx, fontFamily: string) => {
    fontFamily = derefTokenRefs(
      siteFinalStyleTokensAllDeps(studioCtx.site),
      fontFamily,
    );
    if (
      this.stopped ||
      this.store.getState().usedFonts.find((fs) => fs.fontFamily === fontFamily)
    ) {
      // already installed
      return;
    }
    const installSpec = getFontSpec(fontFamily);
    this.publish({
      usedFonts: [...this.store.getState().usedFonts, installSpec],
    });
    const install = () => {
      this.installFont(
        studioCtx.viewCtxs.map((vc) => vc.canvasCtx.$head()),
        installSpec,
      );
      // Install font globally for style tokens.
      this.installFont([$(document.head)], installSpec);
    };
    if (installSpec.fontType === "local") {
      // This is mostly used by paste from Figma, where fonts are not added
      // to UserManagedFont list.
      this.pendingLocalFonts.add(installSpec.fontFamily);
      spawn(
        asyncTestFonts([installSpec.fontFamily]).then((avails) => {
          if (this.stopped) {
            return;
          }
          if (avails.length === 1) {
            this.publish({
              localFonts: new Set([
                ...this.store.getState().localFonts,
                installSpec.fontFamily,
              ]),
            });
          }
          this.pendingLocalFonts.delete(installSpec.fontFamily);
          install();
        }),
      );
    } else {
      install();
    }
  };

  installDepFonts(studioCtx: StudioCtx, dep: ProjectDependency) {
    const usages = extractUsedFontsFromComponents(
      dep.site,
      dep.site.components,
    );
    for (const usage of usages) {
      this.useFont(studioCtx, usage.fontFamily);
    }
  }
}

const asyncTestFonts = async (fontsToTest: string[]) => {
  const f = document["fonts"];
  const testFontSpec = `12px ${plasmicTestFont}`;
  if (!f || f.check(testFontSpec)) {
    return fontsToTest.filter(isLocalFontAvailable);
  } else {
    await f.load(testFontSpec);
    return fontsToTest.filter(isLocalFontAvailable);
  }
};

const isLocalFontAvailable = (localFont: string) => {
  // Generic families are resolved by the browser, not installed by name.
  // Quoting them in the width probe would turn them into named families.
  if (isFontFamilyKeyword(localFont)) {
    return true;
  }
  const $fontTester = $(".fontTester");
  const initialWidth = $fontTester.width();

  $fontTester.css("font-family", `"${localFont}", "${plasmicTestFont}"`);
  const newWidth = $fontTester.width();
  $fontTester.css("font-family", `"${plasmicTestFont}"`);

  const r = newWidth !== initialWidth;
  return r;
};
