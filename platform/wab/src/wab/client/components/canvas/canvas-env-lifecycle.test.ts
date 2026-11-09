import { getEnvId, RenderingCtx } from "@/wab/client/components/canvas/canvas-rendering";
import { globalHookCtx } from "@/wab/client/react-global-hook/globalHook";
import { tryGetEnvFromFullKey } from "@/wab/client/react-global-hook/utils";
import { CanvasRenderOwner } from "@/wab/client/components/canvas/canvas-cache";
import { CanvasSessionState } from "@/wab/client/components/canvas/canvas-session-state";

const ctx = (uid: number, value: string, canvasRenderOwner: CanvasRenderOwner) => ({
  valKey: "same.node", env: { value }, wrappingEnv: {},
  viewCtx: { arenaFrame: () => ({ uid }), canvasRenderOwner },
}) as unknown as RenderingCtx;

afterEach(() => [...globalHookCtx.frames.values()].forEach(frame => frame.dispose()));

it("keeps identical full keys on two artboards independent through rerender and disposal", () => {
  const a = globalHookCtx.createFrameState({ uid: 701, objectPrototype: {} });
  const b = globalHookCtx.createFrameState({ uid: 702, objectPrototype: {} });
  const sessionA = new CanvasSessionState(), sessionB = new CanvasSessionState();
  const ownerA = new CanvasRenderOwner(sessionA), ownerB = new CanvasRenderOwner(sessionB);
  let aId = getEnvId(ctx(a.uid, "a", ownerA));
  const bId = getEnvId(ctx(b.uid, "b", ownerB));
  try {
    const old = aId;
    aId = getEnvId(ctx(a.uid, "a", ownerA));
    // The previous committed fiber may still read this id while React commits
    // the replacement. Its environment remains owned until the replacement is committed.
    expect(globalHookCtx.envIdToEnvs.get(old)?.deref()?.env.value).toBe("a");
    expect(tryGetEnvFromFullKey(globalHookCtx, "same[0].node[0]", a.uid)?.env.value).toBe("a");
    expect(tryGetEnvFromFullKey(globalHookCtx, "same[0].node[0]", b.uid)?.env.value).toBe("b");
    expect(globalHookCtx.envIdToEnvs.has(aId)).toBe(true);
    a.dispose();
    expect(globalHookCtx.envIdToEnvs.has(old)).toBe(false);
    expect(globalHookCtx.envIdToEnvs.has(aId)).toBe(false);
    expect(globalHookCtx.envIdToEnvs.has(bId)).toBe(true);
    expect(tryGetEnvFromFullKey(globalHookCtx, "same[0].node[0]", b.uid)?.env.value).toBe("b");
  } finally { ownerA.dispose(); ownerB.dispose(); sessionA.dispose(); sessionB.dispose(); b.dispose(); }
});

it("also releases untracked error-display environments on frame disposal", () => {
  const frame = globalHookCtx.createFrameState({ uid: 703, objectPrototype: {} });
  const session = new CanvasSessionState(), owner = new CanvasRenderOwner(session);
  const id = getEnvId(ctx(frame.uid, "error", owner));
  expect(globalHookCtx.envIdToEnvs.has(id)).toBe(true);
  frame.dispose();
  expect(globalHookCtx.envIdToEnvs.has(id)).toBe(false);
  expect(globalHookCtx.fullKeyToEnvId.has("703:same[0].node[0]")).toBe(false);
  owner.dispose(); session.dispose();
});
