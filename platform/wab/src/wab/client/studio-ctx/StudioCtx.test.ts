import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import {
  ApiFeatureTier,
  ApiTeam,
  FeatureTierId,
  TeamId,
  UserId,
} from "@/wab/shared/ApiSchema";
import { getArenaFrames } from "@/wab/shared/Arenas";
import { generateSiteFromBundle } from "@/wab/shared/__testonly__/site-tests-utils";
import { Bundle } from "@/wab/shared/bundler";
import { assert, ensure, withoutNils } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { ParamExportType, mkParam } from "@/wab/shared/core/lang";
import { getDedicatedArena } from "@/wab/shared/core/sites";
import { isTplTag, mkSlot, mkTplTag } from "@/wab/shared/core/tpls";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { typeFactory } from "@/wab/shared/model/model-util";
import { SEARCH_PARAM_COMMENT } from "@/wab/shared/route/app-routes";
import { waitFor } from "@testing-library/react";
import { ok } from "neverthrow";
import { mock } from "vitest-mock-extended";
import type { AppCtx } from "@/wab/client/app-ctx";
import type { DesktopDraft } from "@/wab/shared/desktop-drafts";

import _bundle from "@/wab/shared/web-exporter/bundles/starter-project-desktop-first.json";

const TEAM_ID = "team123" as TeamId;

it("binds the active canvas to the restored draft model instead of the previous model", async () => {
  const { studioCtx, appCtx } = fakeStudioCtx({
    devFlagOverrides: { ccStubs: true },
  });
  try {
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    const page = await studioCtx.changeUnsafe(() =>
      studioCtx.addComponent("Page", { type: ComponentType.Page }),
    );
    const previousArena = studioCtx.currentArena;
    studioCtx.dbCtx().revisionNum = 10;
    appCtx.selfInfo = mock<NonNullable<AppCtx["selfInfo"]>>({ id: "user" as UserId });
    const remote = appCtx.bundler.bundle(studioCtx.site, studioCtx.siteInfo.id, appCtx.lastBundleVersion);
    const bundle = structuredClone(remote);
    const root = ensure(appCtx.bundler.addrOf(page.tplTree), "Missing page root bundle address");
    bundle.map[root.iid].name = "RecoveredRoot";
    const draft: DesktopDraft = {
      format: 1, id: "draft", projectId: studioCtx.siteInfo.id, projectName: "Draft project", branchId: null,
      baseRevision: 10, sequence: 3, savedAt: 1, modelVersion: studioCtx.dbCtx().modelVersion,
      hostlessDataVersion: studioCtx.dbCtx().hostlessDataVersion, bundle, dependencies: [],
    };
    const topApi = mock<NonNullable<AppCtx["topFrameApi"]>>();
    topApi.openDesktopDrafts.mockResolvedValue({ handle: "draft-handle", drafts: [draft] });
    topApi.readDesktopDraft.mockResolvedValue(draft);
    topApi.writeDesktopDraft.mockResolvedValue(undefined);
    appCtx.topFrameApi = topApi;

    studioCtx.latestVariantCreated = ensure(page.variants[0], "Expected the previous page base variant");
    await studioCtx.initializeDesktopDrafts();
    expect(studioCtx.latestVariantCreatedStore.getState()).toBeUndefined();
    expect(studioCtx.latestVariantCreated).toBeUndefined();

    const restoredPage = ensure(studioCtx.site.components.find(component => component.uuid === page.uuid), "Missing restored page");
    assert(isTplTag(restoredPage.tplTree), "Expected a page root tag");
    expect(restoredPage.tplTree.name).toBe("RecoveredRoot");
    expect(studioCtx.currentArena).toBe(getDedicatedArena(studioCtx.site, restoredPage));
    expect(studioCtx.currentArena).not.toBe(previousArena);
    expect(studioCtx.desktopDraft?.store.getState().status?.error).toBeUndefined();
  } finally {
    studioCtx.dispose();
  }
});

it("keeps startup pending until the initial route has resolved, including an empty project", async () => {
  const { studioCtx, appCtx } = fakeStudioCtx();
  let finish: () => void = vi.fn();
  const comments = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const waitForComments = vi
    .spyOn(studioCtx.commentsCtx, "waitForInitialCommentsLoad")
    .mockReturnValue(comments);
  try {
    appCtx.history.replace(
      `/projects/${studioCtx.siteInfo.id}?${SEARCH_PARAM_COMMENT}=thread`,
    );
    expect(studioCtx.currentArena).toBeNull();
    expect(studioCtx.initialRouteReady).toBe(false);
    await waitFor(() => expect(waitForComments).toHaveBeenCalled());
    expect(studioCtx.initialRouteReady).toBe(false);
    finish();
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    expect(getArenaFrames(studioCtx.currentArena)).toEqual([]);
  } finally {
    finish();
    studioCtx.dispose();
  }
});

describe("model change queue failures", () => {
  it.each(["change", "changeObserved"] as const)(
    "%s rejects, rolls back, and continues processing after a thrown error",
    async (method) => {
      const { studioCtx } = fakeStudioCtx();
      try {
        const component = await studioCtx.changeUnsafe(() =>
          studioCtx.addComponent("Original", {
            type: ComponentType.Plain,
            noSwitchArena: true,
          }),
        );
        const failure = new Error("change failed");
        const change = () => {
          component.name = "Rolled back";
          throw failure;
        };
        const failed =
          method === "change"
            ? studioCtx.change(change)
            : studioCtx.changeObserved(() => [component], change);
        await expect(failed).rejects.toBe(failure);
        expect(component.name).toBe("Original");

        await expect(
          studioCtx.change(() => {
            component.name = "Recovered";
            return ok("done");
          }),
        ).resolves.toEqual(ok("done"));
        expect(component.name).toBe("Recovered");
        expect(studioCtx.hasPendingModelChanges()).toBe(false);
      } finally {
        studioCtx.dispose();
      }
    },
    5000,
  );
});

function mockTeam(overrides: Partial<ApiTeam>): ApiTeam {
  return {
    id: TEAM_ID,
    featureTierId: null,
    stripeCustomerId: null,
    onTrial: false,
    ...overrides,
  } as ApiTeam;
}

describe("chatCopilotEnabled", () => {
  function setup(team: ApiTeam, enabled = true) {
    return fakeStudioCtx({
      teams: [team],
      siteInfo: { teamId: TEAM_ID },
      devFlagOverrides: { enableLocalAiEditing: enabled },
    });
  }

  it("inherits an enterprise tier without a child Stripe customer", () => {
    const { studioCtx } = setup(
      mockTeam({
        parentTeamId: "parent" as TeamId,
        featureTier: { id: "enterprise" as FeatureTierId } as ApiFeatureTier,
      }),
    );
    expect(studioCtx.chatCopilotEnabled()).toBe(true);
  });

  it.each([
    {
      name: "paid",
      team: mockTeam({ featureTierId: "paid" as FeatureTierId }),
    },
    {
      name: "trial",
      team: mockTeam({ featureTierId: "paid" as FeatureTierId, onTrial: true }),
    },
    { name: "without a tier", team: mockTeam({}) },
    { name: "free", team: mockTeam({ featureTierId: DEVFLAGS.freeTier.id }) },
  ])(
    "uses the local AI feature flag independently of the $name plan",
    ({ team }) => {
      expect(setup(team).studioCtx.chatCopilotEnabled()).toBe(true);
      expect(setup(team, false).studioCtx.chatCopilotEnabled()).toBe(false);
    },
  );

  it.each(["viewer", "commenter", "content", "editor"] as const)(
    "checks project access for %s",
    (accessLevel) => {
      const { studioCtx, appCtx } = setup(
        mockTeam({ featureTierId: "paid" as FeatureTierId }),
      );
      const userId = "customer" as UserId;
      appCtx.selfInfo = {
        id: userId,
        email: "customer@example.com",
      } as NonNullable<typeof appCtx.selfInfo>;
      studioCtx.siteInfo.createdById = "owner" as UserId;
      studioCtx.siteInfo.perms = [
        {
          projectId: studioCtx.siteInfo.id,
          userId,
          accessLevel,
        } as (typeof studioCtx.siteInfo.perms)[number],
      ];
      expect(studioCtx.chatCopilotEnabled()).toBe(
        accessLevel === "content" || accessLevel === "editor",
      );
    },
  );
});

describe("background arenas", () => {
  // Share the site, each test gets its own StudioCtx.
  const site = generateSiteFromBundle(_bundle as [string, Bundle][]);

  const contexts: StudioCtx[] = [];
  afterEach(() => contexts.splice(0).forEach((context) => context.dispose()));

  async function setup() {
    const { studioCtx } = fakeStudioCtx({
      site,
      devFlagOverrides: { noObserve: true },
    });
    contexts.push(studioCtx);
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    const arenas = withoutNils(site.components.map((component) => getDedicatedArena(site, component))).filter((arena) => arena !== studioCtx.currentArena);
    return { studioCtx, arenas };
  }

  it("ensureArenaAliveInBackground marks the arena alive without changing currentArena or focus", async () => {
    const { studioCtx, arenas } = await setup();
    const arena = arenas[0];
    const prevArena = studioCtx.currentArena;
    const prevFocused = studioCtx.focusedViewCtx();

    studioCtx.ensureArenaAliveInBackground(arena);

    expect(studioCtx.getArenaStatus(arena)).toBe("background");
    expect(studioCtx.currentArena).toBe(prevArena);
    expect(studioCtx.focusedViewCtx()).toBe(prevFocused);
  });

  it("tryGetLiveViewCtxForComponent finds a live ViewCtx in a non-current arena", async () => {
    const { studioCtx } = await setup();
    const comp = site.components.find((c) => getDedicatedArena(site, c) && getDedicatedArena(site, c) !== studioCtx.currentArena)!;
    const arena = ensure(getDedicatedArena(site, comp), "Component arena");
    const fakeVc = ensure(studioCtx.tryGetViewCtxForFrame(getArenaFrames(arena)[0]), "Live component view");

    expect(studioCtx.tryGetLiveViewCtxForComponent(comp)).toBe(fakeVc);
  });

  it("withBackgroundViewCtxForComponent runs the callback with a reused live ViewCtx", async () => {
    const { studioCtx } = await setup();
    const comp = site.components.find((c) => getDedicatedArena(site, c) && getDedicatedArena(site, c) !== studioCtx.currentArena)!;
    const arena = getDedicatedArena(site, comp)!;
    const fakeVc = ensure(studioCtx.tryGetViewCtxForFrame(getArenaFrames(arena)[0]), "Live component view");

    const received = await studioCtx.withBackgroundViewCtxForComponent(
      comp,
      async (vc) => vc,
    );
    expect(received).toBe(fakeVc);
  });

  it("garbage collects background arenas before user-visited ones", async () => {
    const { studioCtx, arenas } = await setup();
    const [userArena, bgArena] = arenas;
    expect(userArena).not.toBe(bgArena);

    // user visited userArena at some point. The background arena was touched
    // just now, but still needs to be evicted first.
    studioCtx.arenaState.activate(userArena, 1);
    studioCtx.ensureArenaAliveInBackground(bgArena);

    const savedLiveArenas = DEVFLAGS.liveArenas;
    try {
      DEVFLAGS.liveArenas = 1;
      studioCtx.arenaState.collect(DEVFLAGS.liveArenas);
      studioCtx.pruneInvalidViewCtxs();
    } finally {
      DEVFLAGS.liveArenas = savedLiveArenas;
    }

    expect(studioCtx.getArenaStatus(bgArena)).toBe("dead");
    expect(studioCtx.getArenaStatus(userArena)).toBe("cached");
  });

  it("renders a cached arena during a background read and restores its cached status", async () => {
    const { studioCtx, arenas } = await setup();
    const arena = arenas[0];
    const comp = site.components.find(
      (c) => getDedicatedArena(site, c) === arena,
    )!;
    ensure(studioCtx.tryGetViewCtxForFrame(getArenaFrames(arena)[0]), "Live component view");
    studioCtx.arenaState.activate(arena, Date.now());
    const currentArena = studioCtx.currentArena;
    expect(studioCtx.getArenaStatus(arena)).toBe("cached");
    await studioCtx.withBackgroundViewCtxForComponent(comp, async () => {
      expect(studioCtx.getArenaStatus(arena)).toBe("background");
      expect(studioCtx.currentArena).toBe(currentArena);
    });
    expect(studioCtx.getArenaStatus(arena)).toBe("cached");
  });

  it("withBackgroundViewCtxForComponent keeps the arena alive until the callback resolves", async () => {
    const { studioCtx, arenas } = await setup();
    const [userArena, bgArena] = arenas;
    const bgComp = site.components.find(
      (c) => getDedicatedArena(site, c) === bgArena,
    )!;
    ensure(studioCtx.tryGetViewCtxForFrame(getArenaFrames(bgArena)[0]), "Live background view");

    studioCtx.arenaState.activate(userArena, 1);
    studioCtx.ensureArenaAliveInBackground(bgArena);

    const savedLiveArenas = DEVFLAGS.liveArenas;
    try {
      DEVFLAGS.liveArenas = 1;
      let statusDuringRead: string | undefined;
      let userStatusDuringRead: string | undefined;
      await studioCtx.withBackgroundViewCtxForComponent(bgComp, async () => {
        // A GC triggered mid-read (e.g. the user switches arenas) must not evict the arena
        // whose ViewCtx we're reading, or promote the user's arena into the victim slot.
        studioCtx.arenaState.collect(DEVFLAGS.liveArenas);
      studioCtx.pruneInvalidViewCtxs();
        statusDuringRead = studioCtx.getArenaStatus(bgArena);
        userStatusDuringRead = studioCtx.getArenaStatus(userArena);
      });
      expect(statusDuringRead).not.toBe("dead");
      expect(userStatusDuringRead).toBe("cached");
      // Once the read completes the arena is unpinned; the trailing GC evicts it.
      expect(studioCtx.getArenaStatus(bgArena)).toBe("dead");
      expect(studioCtx.getArenaStatus(userArena)).toBe("cached");
    } finally {
      DEVFLAGS.liveArenas = savedLiveArenas;
    }
  });
});

describe("attachComponent", () => {
  afterEach(() => {
    delete (window as any).studioCtx;
  });

  it("observes sub components attached during a change", async () => {
    const { studioCtx } = fakeStudioCtx();
    (window as any).studioCtx = studioCtx;

    const select = mkComponent({
      name: "Select",
      tplTree: mkTplTag("div"),
      type: ComponentType.Plain,
    });
    const children = mkParam({
      name: "children",
      type: typeFactory.renderable(),
      exportType: ParamExportType.External,
      paramType: "slot",
    });
    const option = mkComponent({
      name: "Option",
      params: [children],
      tplTree: mkTplTag("div", mkSlot(children)),
      type: ComponentType.Plain,
      superComp: select,
    });

    await studioCtx.changeUnsafe(() => {
      studioCtx.tplMgr().attachComponent(select);
    });

    expect(studioCtx.site.components).toEqual(
      expect.arrayContaining([select, option]),
    );
    expect(studioCtx.observeComponents([select, option])).toBe(false);
  });
});


it("cancels the actual pending initial-route producer when its Studio is disposed", async () => {
  const fixture = fakeStudioCtx();
  await waitFor(() => expect(fixture.studioCtx.initialRouteReady).toBe(true));
  fixture.studioCtx.dispose();
  let resolvePreferences: (value: string | null) => void = vi.fn();
  const preferences = new Promise<string | null>((resolve) => { resolvePreferences = resolve; });
  fixture.api.getStorageItem.mockReturnValue(preferences);
  fixture.history.replace(`/projects/${fixture.dbCtx.siteInfo.id}`);
  const original = StudioCtx.prototype["handleInitialRoute"];
  let routeTask: Promise<void> | undefined;
  StudioCtx.prototype["handleInitialRoute"] = function(this: StudioCtx) {
    const task = original.call(this);
    routeTask = task;
    return task;
  };
  let reopened: StudioCtx | undefined;
  try {
    reopened = new StudioCtx({ dbCtx: fixture.dbCtx, autoSave: false });
    const change = vi.spyOn(reopened, "change");
    const snapshots = reopened.modelSnapshots;
    reopened.dispose();
    resolvePreferences("true");
    await ensure(routeTask, "The constructor must start its actual initial route task");
    expect(change).not.toHaveBeenCalled();
    expect(reopened.initialRouteReady).toBe(false);
    expect(reopened.focusedViewCtx()).toBeUndefined();
    expect(reopened.focusedOrFirstViewCtx()).toBeUndefined();
    expect(reopened.modelSnapshots).toBe(snapshots);
  } finally {
    StudioCtx.prototype["handleInitialRoute"] = original;
    resolvePreferences(null);
    reopened?.dispose();
  }
});
