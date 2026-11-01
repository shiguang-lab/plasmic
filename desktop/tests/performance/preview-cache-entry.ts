// Diagnostic entry only; never register in a release build.
import {
  buildDocsPreviewModules,
  buildPreviewModules,
  PreviewCodegenContext,
} from "@/wab/client/components/live/preview-codegen";

const w = window as any;
let checkpoint: any;
let protectedContext: PreviewCodegenContext;
let protectedRoot: unknown;
let expectedLive: string;
let expectedDocs: string;
let retired: { site: WeakRef<object>; component: WeakRef<object> }[] = [];
let cycles = 0;

async function hash(modules: any[]) {
  const data = JSON.stringify(
    [...modules].sort((a, b) => a.name.localeCompare(b.name)),
  );
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(data),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
function generate(context: PreviewCodegenContext) {
  const component = context.site.pageArenas[0].component;
  const live = buildPreviewModules(context, component);
  const docs = buildDocsPreviewModules(context, component, false);
  return { live, docs };
}
function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(message);
}

w.__previewCacheDiag = {
  async setup() {
    const s = w.studioCtx;
    await s.awaitEval();
    await s.awaitStudioReady();
    let arena: any;
    await s.changeUnsafe(() => {
      arena = s.tplMgr().addArena("PreviewCache");
      s.tplMgr().addNewMixedArenaFrame(
        arena,
        "CacheFrame",
        s.site.pageArenas[0].component,
        {
          width: 640,
          height: 480,
          insertPt: s.viewportCtx.visibleScalerBox().topLeft(),
        },
      );
    });
    s.changeSelection(() => s.switchToArena(arena));
    await s.awaitEval();
    await s.awaitStudioReady();
    check(s.viewCtxs.length === 1, "Expected an active diagnostic canvas");
    s.needsFullSave = true;
    await s.save();
    check(s.saveStatus === "saved", "Diagnostic checkpoint save failed");
    await s.refreshRevisions();
    checkpoint = s.revisions.find(
      (r: any) => r.revision === s.dbCtx().revisionNum,
    );
    check(checkpoint, "Diagnostic checkpoint missing from revision list");
    protectedContext = {
      site: s.site,
      siteInfo: {
        id: s.siteInfo.id,
        name: s.siteInfo.name,
        appAuthProvider: s.siteInfo.appAuthProvider,
      },
    };
    const active = generate(s),
      other = generate(protectedContext);
    protectedRoot = other.live.rootOutput;
    expectedLive = await hash(active.live.modules);
    expectedDocs = await hash(active.docs.modules);
    check(
      (await hash(other.live.modules)) === expectedLive,
      "Protected consumer modules differ",
    );
    retired = [];
    cycles = 0;
    return {
      liveHash: expectedLive,
      docsHash: expectedDocs,
      modules: active.live.modules.length,
    };
  },
  async cycle() {
    const s = w.studioCtx;
    if (s.site !== protectedContext.site) {
      Object.defineProperty(s.site, "__retiredPreviewCacheSite", {
        value: "preview-site-" + cycles,
        configurable: true,
      });
      retired.push({
        site: new WeakRef(s.site),
        component: new WeakRef(s.site.pageArenas[0].component),
      });
    }
    await s.revertTo(checkpoint);
    await s.awaitEval();
    await s.awaitStudioReady();
    check(
      s.currentArena?.name === "PreviewCache" && s.viewCtxs.length === 1,
      "Restored diagnostic canvas not active",
    );
    const start = performance.now(),
      active = generate(s),
      coldMs = performance.now() - start;
    const warmStart = performance.now(),
      warm = generate(s),
      warmMs = performance.now() - warmStart;
    check(
      active.live.rootOutput === warm.live.rootOutput,
      "Warm consumer lost cached output identity",
    );
    check(
      (await hash(active.live.modules)) === expectedLive,
      "Live generated modules changed after model replacement",
    );
    check(
      (await hash(active.docs.modules)) === expectedDocs,
      "Docs generated modules changed after model replacement",
    );
    const other = generate(protectedContext);
    check(
      other.live.rootOutput === protectedRoot,
      "Another consumer lost its active cached output",
    );
    check(
      (await hash(other.live.modules)) === expectedLive,
      "Another consumer modules changed",
    );
    check(
      !w.__perf.errors.length,
      "Studio errors during code generation/model restore",
    );
    cycles++;
    return {
      cycle: cycles,
      coldMs,
      warmMs,
      liveHash: expectedLive,
      docsHash: expectedDocs,
      protectedIdentity: true,
      warmIdentity: true,
    };
  },
  state() {
    return {
      cycles,
      retired: retired.length,
      retiredSitesAlive: retired.filter((r) => !!r.site.deref()).length,
      retiredComponentsAlive: retired.filter((r) => !!r.component.deref())
        .length,
      activeViews: w.studioCtx.viewCtxs.length,
      undoRecords: w.studioCtx.undoLog._log.length,
      errors: w.__perf.errors,
    };
  },
};
