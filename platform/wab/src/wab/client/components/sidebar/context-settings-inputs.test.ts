import { mkParam } from "@/wab/shared/core/lang";
import { typeFactory } from "@/wab/shared/model/model-util";
import { ContextSettingsInputs } from "@/wab/client/components/sidebar/context-settings-inputs";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { TplMgr } from "@/wab/shared/TplMgr";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { createSite } from "@/wab/shared/core/sites";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { codeLit } from "@/wab/shared/core/exprs";
import { ensure } from "@/wab/shared/common";
import { ensureKnownCustomCode } from "@/wab/shared/model/classes";
import type { GlobalContextMeta } from "@plasmicapp/host";

const disposals: (() => void)[] = [];
afterEach(() => disposals.splice(0).forEach((dispose) => dispose()));
function fixture() {
  const site = createSite(), manager = new TplMgr({ site });
  const meta = { name: "Settings", props: { apiUrl: { type: "string", defaultValue: "initial" } }, importPath: "", __isContext: true } as unknown as GlobalContextMeta<any>;
  const component = mkCodeComponent("Settings", meta, {});
  // mkCodeComponent creates the implementation identity; registration sync owns params.
  component.params.push(mkParam({ name: "apiUrl", paramType: "prop", type: typeFactory.text(), defaultExpr: codeLit("initial") }));
  manager.attachComponent(component);
  const tpl = ensure(site.globalContexts[0], "Installed context");
  const param = ensure(component.params.find((candidate) => candidate.variable.name === "apiUrl"), "Context parameter");
  const models = new ModelSnapshots(), lifetime = new AbortController();
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const studio = { site, modelSnapshots: models, arenaState: { lifetime: () => lifetime.signal } } as unknown as StudioCtx;
  const source = new ContextSettingsInputs(studio), changed = vi.fn(), stop = source.subscribe(changed);
  const edit = (fn: () => void) => models.sync(recorder.withRecording(fn).changes);
  disposals.push(() => { stop(); lifetime.abort(); models.dispose(); recorder.dispose(); });
  return { site, component, tpl, param, source, changed, edit, lifetime, manager };
}

it("follows context param defaults and the actual mutable argument expressions", () => {
  const f = fixture();
  f.edit(() => { f.param.displayName = "API endpoint"; });
  expect(f.changed).toHaveBeenCalledOnce();
  f.changed.mockClear();
  f.edit(() => { f.param.defaultExpr = codeLit("replacement"); });
  expect(f.changed).toHaveBeenCalledOnce();
  f.edit(() => { f.manager.setArg(f.tpl, f.tpl.vsettings[0], f.param.variable, codeLit("draft")); });
  const arg = ensure(f.tpl.vsettings[0].args.find((candidate) => candidate.param === f.param), "Edited argument");
  f.changed.mockClear();
  f.edit(() => { ensureKnownCustomCode(arg.expr).code = '"committed"'; });
  expect(f.changed).toHaveBeenCalledOnce();
});

it("drops fields for removed contexts and closes with the model owner", () => {
  const f = fixture();
  f.edit(() => { f.site.globalContexts.splice(0); });
  f.changed.mockClear();
  f.edit(() => { f.param.displayName = "Detached editor"; });
  expect(f.changed).not.toHaveBeenCalled();
  f.lifetime.abort();
  expect(f.source.getSnapshot()).toEqual([]);
});
