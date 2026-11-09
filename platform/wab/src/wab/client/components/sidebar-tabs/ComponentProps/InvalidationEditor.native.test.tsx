import { InvalidationEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/InvalidationEditor";
import { QueryInvalidationInputs } from "@/wab/client/components/sidebar-tabs/ServerQuery/server-query-inputs";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { TplMgr } from "@/wab/shared/TplMgr";
import { mkCustomFunction } from "@/wab/shared/__testonly__/site-tests-utils";
import { ComponentType } from "@/wab/shared/core/components";
import { mkParam } from "@/wab/shared/core/lang";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { ComponentDataQuery, ComponentServerQuery, CustomCode, CustomFunctionExpr, QueryInvalidationExpr, QueryRef, isKnownCustomCode } from "@/wab/shared/model/classes";
import { getProjectFlags } from "@/wab/shared/devflags";
import { typeFactory } from "@/wab/shared/model/model-util";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { mock } from "vitest-mock-extended";

const state = vi.hoisted(() => ({studio: undefined as unknown}));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({useStudioCtx: () => state.studio}));
vi.mock("@/wab/client/studio-ctx/selection-state", () => ({useFocusedViewCtx: () => undefined}));
vi.mock("@/wab/client/components/sidebar/sidebar-helpers", () => ({LabeledItemRow: ({children}: React.PropsWithChildren) => <div>{children}</div>}));
vi.mock("@/wab/client/components/sidebar-tabs/ComponentProps/DataPickerEditor", () => ({DataPickerEditor: ({value}: {value: string}) => <output>{value}</output>}));
vi.mock("@/wab/client/components/sidebar-tabs/ComponentProps/MultiSelectEnumPropEditor", () => ({MultiSelectEnumPropEditor: ({options, onChange}: {options: {value: string; label: string}[]; onChange: (values: string[]) => void}) => <div>{options.map((option) => <button key={option.value} onClick={() => onChange([option.value])}>{option.label}</button>)}</div>}));

const stops: (() => void)[] = [];
afterEach(() => {cleanup(); stops.splice(0).forEach((stop) => stop());});
function fixture() {
  const context = {site: createSite(), modelSnapshots: new ModelSnapshots()};
  const arena = new StudioArenaState(context), studio = mock<StudioCtx>();
  Object.defineProperties(studio, {site: {get: () => context.site}, modelSnapshots: {get: () => context.modelSnapshots}, arenaState: {value: arena}});
  studio.subscribeModelChanges.mockReturnValue(() => undefined);
  studio.projectFlags.mockImplementation(() => getProjectFlags(context.site)); state.studio = studio;
  const component = new TplMgr({site: context.site}).addComponent({name: "Queries", type: ComponentType.Plain});
  const func = mkCustomFunction({importName: "load", namespace: "api", displayName: "Load data"});
  const first = new ComponentServerQuery({uuid: "first", name: "First", op: new CustomFunctionExpr({func, args: []})});
  const second = new ComponentServerQuery({uuid: "second", name: "Second", op: new CustomFunctionExpr({func, args: []})});
  const custom = new ComponentServerQuery({uuid: "custom", name: "Custom query", op: new CustomCode({code: "1", fallback: null})});
  const data = new ComponentDataQuery({uuid: "data", name: "Data query", op: undefined});
  component.dataQueries.push(data);
  context.site.customFunctions.push(func); component.serverQueries.push(first, second, custom);
  const value = new QueryInvalidationExpr({invalidationQueries: [new QueryRef({ref: first})], invalidationKeys: new CustomCode({code: '("keys")', fallback: null})});
  const param = mkParam({name: "refresh", paramType: "prop", type: typeFactory.any()}); param.defaultExpr = value; component.params.push(param);
  const recorder = new ChangeRecorder({inst: context.site, _instUtil: instUtil});
  const edit = (command: () => void) => act(() => context.modelSnapshots.sync(recorder.withRecording(command).changes));
  stops.push(() => {arena.dispose(); context.modelSnapshots.dispose(); recorder.dispose();});
  return {context, studio, arena, component, func, first, second, custom, data, value, edit};
}

it("updates query labels and function groups from real commits and preserves selected QueryRef targets", () => {
  const f = fixture(), onChange = vi.fn();
  render(<InvalidationEditor value={f.value} onChange={onChange} />);
  expect(screen.getByText("Load data (2 queries)")).toBeTruthy();
  f.edit(() => {f.func.displayName = "Reload"; f.custom.name = "Renamed custom"; f.data.name = "Renamed data";});
  expect(screen.getByText("Reload (2 queries)")).toBeTruthy();
  expect(screen.getByText("Renamed custom")).toBeTruthy();
  expect(screen.getByText("Renamed data")).toBeTruthy();
  fireEvent.click(screen.getByText("Renamed data"));
  expect(onChange.mock.calls[0][0].invalidationQueries[0].ref).toBe(f.data);
  onChange.mockClear();
  f.edit(() => {f.component.serverQueries.splice(1, 1);});
  fireEvent.click(screen.getByText("Reload (1 query)"));
  expect(onChange.mock.calls[0][0].invalidationQueries[0].ref).toBe(f.first);
  f.edit(() => {f.value.invalidationKeys = new CustomCode({code: '("changed")', fallback: null});});
  expect(screen.getByRole("status").textContent).toBe('"changed"');
});

it("ignores unrelated query bodies and stops enrolling fields after its original world closes", () => {
  const f = fixture(), source = new QueryInvalidationInputs(f.studio, f.value), changed = vi.fn();
  const off = source.subscribe(changed); stops.push(off);
  const before = source.getSnapshot();
  f.edit(() => {f.component.name = "Unrelated";});
  expect(source.getSnapshot()).toBe(before);
  expect(changed).not.toHaveBeenCalled();
  f.edit(() => {f.custom.op = new CustomCode({code: "2", fallback: null});});
  // Changing an operation identity is relevant; subsequent body-only edits are not.
  expect(source.getSnapshot()).not.toBe(before); changed.mockClear();
  const op = f.custom.op;
  f.edit(() => {if (isKnownCustomCode(op)) {op.code = "3";}});
  expect(changed).not.toHaveBeenCalled();
  f.arena.reset();
  expect(source.getSnapshot()).toBeNull();
  changed.mockClear();
  f.edit(() => {f.func.displayName = "After close";});
  expect(changed).not.toHaveBeenCalled();
});
