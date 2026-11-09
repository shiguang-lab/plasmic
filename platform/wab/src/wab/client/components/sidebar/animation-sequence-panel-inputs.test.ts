import { AnimationSequencePanelInputs } from "@/wab/client/components/sidebar/animation-sequence-panel-inputs";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { extractAnimationSequenceUsages } from "@/wab/shared/core/styles";
import { instUtil } from "@/wab/shared/model/InstUtil";

const disposals: (() => void)[] = [];
afterEach(() => disposals.splice(0).forEach((stop) => stop()));
function fixture() {
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Animated", type: ComponentType.Plain });
  const sequence = manager.addAnimationSequence("Pulse"), animation = manager.addAnimation(sequence);
  const models = new ModelSnapshots(), lifetime = new AbortController();
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const studio = { site, modelSnapshots: models, arenaState: { lifetime: () => lifetime.signal } } as unknown as StudioCtx;
  const edit = (fn: () => void) => models.sync(recorder.withRecording(fn).changes);
  disposals.push(() => { lifetime.abort(); recorder.dispose(); models.dispose(); });
  return { site, component, sequence, animation, studio, lifetime, edit };
}

it("publishes directory names without subscribing to keyframe or timing contents", () => {
  const f = fixture(), source = new AnimationSequencePanelInputs(f.studio, { kind: "catalog" }), changed = vi.fn();
  disposals.push(source.subscribe(changed)); changed.mockClear();
  f.edit(() => { f.animation.duration = "500ms"; });
  expect(changed).not.toHaveBeenCalled();
  f.edit(() => { f.sequence.name = "Renamed pulse"; });
  expect(changed).toHaveBeenCalledOnce();
});

it("refreshes real reference ownership only while that graph is requested and retires with its world", () => {
  const f = fixture(), source = new AnimationSequencePanelInputs(f.studio, { kind: "usage", sequence: f.sequence }), changed = vi.fn();
  disposals.push(source.subscribe(changed)); changed.mockClear();
  f.edit(() => { f.component.tplTree.vsettings[0].rs.animations = [f.animation]; });
  expect(changed).toHaveBeenCalledOnce();
  expect(extractAnimationSequenceUsages(f.site, f.sequence)[1].components).toContain(f.component);
  f.edit(() => { f.component.tplTree.vsettings[0].rs.animations = null; });
  expect(extractAnimationSequenceUsages(f.site, f.sequence)[1].components).not.toContain(f.component);
  f.lifetime.abort(); changed.mockClear();
  f.edit(() => { f.sequence.name = "After closed world"; });
  expect(source.getSnapshot()).toEqual([]); expect(changed).not.toHaveBeenCalled();
});
