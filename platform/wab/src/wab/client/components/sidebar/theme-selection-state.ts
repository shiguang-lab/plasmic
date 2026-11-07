import { activateTheme } from "@/wab/client/activate-theme";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type {
  ModelFieldStore,
  ModelRef,
} from "@/wab/client/studio-ctx/model-snapshots";
import { ensure } from "@/wab/shared/common";
import { getSelectableThemes } from "@/wab/shared/core/theme-styles";
import type { ObjInst, Site, Theme } from "@/wab/shared/model/classes";
import React from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";

/** An immutable option. The mutable theme is resolved only by activation. */
export interface ThemeSelectionOption {
  readonly ref: ModelRef<Theme>;
  readonly value: string;
  /** Undefined for themes owned by this site. */
  readonly ownerProjectName?: string;
}

export interface ThemeSelection {
  readonly siteRef: ModelRef<Site>;
  readonly activeThemeRef?: ModelRef<Theme>;
  readonly activeThemeValue?: string;
  readonly notOwnedBySite: boolean;
  readonly options: readonly ThemeSelectionOption[];
}

function sameSelection(
  previous: ThemeSelection,
  next: ThemeSelection,
): boolean {
  return (
    previous.siteRef === next.siteRef &&
    previous.activeThemeRef === next.activeThemeRef &&
    previous.activeThemeValue === next.activeThemeValue &&
    previous.notOwnedBySite === next.notOwnedBySite &&
    previous.options === next.options
  );
}

/** The existing selectable-theme projection, sourced from declared fields.
 * Each resource reads only current-site data and rebinds after owner replacement. */
class ThemeSelectionStore {
  private readonly state: StoreApi<ThemeSelection>;
  private readonly fields = new Map<ModelFieldStore<unknown>, () => void>();
  private stopCommits: (() => void) | undefined;
  private subscribers = 0;
  readonly store: ModelFieldStore<ThemeSelection>;

  constructor(private readonly studio: StudioCtx) {
    const initial = this.project();
    this.state = createStore(() => initial);
    this.store = {
      getState: this.state.getState,
      getInitialState: this.state.getInitialState,
      subscribe: (listener) => {
        const stop = this.state.subscribe(listener);
        this.subscribers++;
        if (this.subscribers === 1) {
          this.connect();
        }
        return () => {
          stop();
          this.subscribers--;
          if (this.subscribers === 0) {
            this.disconnect();
          }
        };
      },
    };
  }

  async activate(ref: ModelRef<Theme>) {
    const theme = this.studio.modelSnapshots.resolve(ref);
    if (theme !== this.studio.site.activeTheme) {
      await this.studio.changeUnsafe(() => {
        activateTheme(this.studio, theme);
      });
    }
  }

  private connect() {
    // Native save publishes these exact field notifications only after the
    // completed command, after commit listeners. Each notification therefore
    // projects the fully installed field set; commit only rebinds a new owner.
    this.stopCommits = this.studio.subscribeModelChanges((event) => {
      if (event.type === "site-replaced") {
        this.publish();
      }
    });
    this.publish();
  }

  private disconnect() {
    this.stopCommits?.();
    this.stopCommits = undefined;
    this.fields.forEach((stop) => stop());
    this.fields.clear();
  }

  private publish() {
    const previous = this.state.getState();
    const next = this.project(previous, true);
    if (sameSelection(previous, next)) {
      return;
    }
    this.state.setState(next, true);
  }

  private project(
    previous?: ThemeSelection,
    wire = false,
  ): ThemeSelection {
    const models = this.studio.modelSnapshots;
    const site = this.studio.site;
    const sources = new Set<ModelFieldStore<unknown>>();
    const read = <T extends ObjInst, Key extends Exclude<keyof T, "uid"> & string>(
      model: T,
      key: Key,
    ) => {
      const field = models.field(model, key);
      sources.add(field);
      return field.getState();
    };

    const siteRef = models.ref(site);
    const siteThemes = read(site, "themes");
    const activeThemeRef = read(site, "activeTheme");
    const ownedThemeRefs = new Set(siteThemes);

    for (const ref of read(site, "projectDependencies")) {
      const dependency = models.resolve(ref);
      const dependencySite = models.resolve(read(dependency, "site"));
      read(dependencySite, "activeTheme");
      read(dependencySite, "hostLessPackageInfo");
    }

    const activeTheme = activeThemeRef
      ? models.resolve(activeThemeRef)
      : undefined;
    const activeThemeValue = activeTheme
      ? read(models.resolve(read(activeTheme, "defaultStyle")), "uuid")
      : undefined;

    const options = getSelectableThemes(site).map(
      ({ theme }): ThemeSelectionOption => {
        const ownedBySite = ownedThemeRefs.has(models.ref(theme));
        const owner = ownedBySite
          ? undefined
          : ensure(
              this.studio.projectDependencyManager.getOwnerDep(theme),
              "Could not find owner dep for theme",
            );
        return {
          ref: models.ref(theme),
          value: read(models.resolve(read(theme, "defaultStyle")), "uuid"),
          ownerProjectName: owner ? read(owner, "name") : undefined,
        };
      },
    );

    const previousOptions = previous?.options;
    const previousByUid = new Map(
      previousOptions?.map((option) => [option.ref.uid, option]),
    );
    const sharedOptions = options.map((option) => {
      const before = previousByUid.get(option.ref.uid);
      return before &&
        before.ref === option.ref &&
        before.value === option.value &&
        before.ownerProjectName === option.ownerProjectName
        ? before
        : Object.freeze(option);
    });
    const shared =
      previousOptions &&
      previousOptions.length === sharedOptions.length &&
      previousOptions.every((option, index) => option === sharedOptions[index])
        ? previousOptions
        : Object.freeze(sharedOptions);

    if (wire) {
      for (const [field, stop] of this.fields) {
        if (!sources.has(field)) {
          stop();
          this.fields.delete(field);
        }
      }
      for (const field of sources) {
        if (!this.fields.has(field)) {
          this.fields.set(
            field,
            field.subscribe(() => this.publish()),
          );
        }
      }
    }

    const next: ThemeSelection = Object.freeze({
      siteRef,
      activeThemeRef: activeThemeRef ?? undefined,
      activeThemeValue,
      notOwnedBySite: !!activeThemeRef && !ownedThemeRefs.has(activeThemeRef),
      options: shared,
    });
    return previous && sameSelection(previous, next) ? previous : next;
  }
}

/** One demand-owned theme selection for the mounted panel. */
export function useThemeSelection<Selected>(studio: StudioCtx, selector: (selection: ThemeSelection) => Selected) {
  const store = React.useMemo(() => new ThemeSelectionStore(studio), [studio]);
  const selection = useStore(store.store, selector);
  return {
    selection,
    activate: (ref: ModelRef<Theme>) => store.activate(ref),
  };
}
