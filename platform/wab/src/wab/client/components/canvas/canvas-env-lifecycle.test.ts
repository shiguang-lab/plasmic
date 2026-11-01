import { getEnvId, RenderingCtx } from "@/wab/client/components/canvas/canvas-rendering";
import { globalHookCtx } from "@/wab/client/react-global-hook/globalHook";
import { tryGetEnvFromFullKey } from "@/wab/client/react-global-hook/utils";
import { autorun, observable, runInAction } from "mobx";

const ctx = (uid: number, value: string) => ({
  valKey: "same.node", env: { value }, wrappingEnv: {},
  viewCtx: { arenaFrame: () => ({ uid }) },
}) as unknown as RenderingCtx;

afterEach(() => [...globalHookCtx.frames.values()].forEach(frame => frame.dispose()));

it("keeps identical full keys on two artboards independent through rerender and disposal", () => {
  const a = globalHookCtx.createFrameState({ uid: 701, objectPrototype: {} });
  const b = globalHookCtx.createFrameState({ uid: 702, objectPrototype: {} });
  const tick = observable.box(0);
  let aId = "", bId = "";
  const stopA = autorun(() => { tick.get(); aId = getEnvId(ctx(a.uid, "a")); });
  const stopB = autorun(() => { bId = getEnvId(ctx(b.uid, "b")); });
  try {
    const old = aId;
    runInAction(() => tick.set(1));
    // The previous committed fiber may still read this id while React commits
    // the replacement. Losing its MobX observer must not invalidate that fiber.
    expect(globalHookCtx.envIdToEnvs.get(old)?.deref()?.env.value).toBe("a");
    expect(tryGetEnvFromFullKey(globalHookCtx, "same[0].node[0]", a.uid)?.env.value).toBe("a");
    expect(tryGetEnvFromFullKey(globalHookCtx, "same[0].node[0]", b.uid)?.env.value).toBe("b");
    stopA();
    expect(globalHookCtx.envIdToEnvs.has(aId)).toBe(true);
    a.dispose();
    expect(globalHookCtx.envIdToEnvs.has(old)).toBe(false);
    expect(globalHookCtx.envIdToEnvs.has(aId)).toBe(false);
    expect(globalHookCtx.envIdToEnvs.has(bId)).toBe(true);
    expect(tryGetEnvFromFullKey(globalHookCtx, "same[0].node[0]", b.uid)?.env.value).toBe("b");
  } finally { stopA(); stopB(); b.dispose(); }
});

it("also releases untracked error-display environments on frame disposal", () => {
  const frame = globalHookCtx.createFrameState({ uid: 703, objectPrototype: {} });
  const id = getEnvId(ctx(frame.uid, "error"));
  expect(globalHookCtx.envIdToEnvs.has(id)).toBe(true);
  frame.dispose();
  expect(globalHookCtx.envIdToEnvs.has(id)).toBe(false);
  expect(globalHookCtx.fullKeyToEnvId.has("703:same[0].node[0]")).toBe(false);
});
