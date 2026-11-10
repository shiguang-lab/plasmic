import { ModelFieldInputs } from "@/wab/client/stores/model-field-inputs";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { mkRuleSet } from "@/wab/shared/core/styles";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { ColumnsConfig } from "@/wab/shared/model/classes";
import { createStore } from "zustand/vanilla";

it("captures all committed fields once, reuses clean reads and catches disconnected edits", () => {
  const model = new ColumnsConfig({ colsSizes: [1], breakUpRows: false });
  const models = new ModelSnapshots(), lifetime = new AbortController();
  const recorder = new ChangeRecorder({ inst: model, _instUtil: instUtil });
  const collect = vi.fn((field: Parameters<ConstructorParameters<typeof ModelFieldInputs>[1]>[0]) => { field(model, "colsSizes", "breakUpRows"); });
  const source = new ModelFieldInputs({ models, lifetime: lifetime.signal, isCurrent: () => true }, collect);
  const edit = (run: () => void) => models.sync(recorder.withRecording(run).changes);
  const before = source.read(), changed = vi.fn();
  let stop = source.subscribe(changed);
  try {
    expect(source.read()).toBe(before);
    expect(collect).toHaveBeenCalledOnce();
    expect(changed).not.toHaveBeenCalled();
    edit(() => { model.colsSizes.push(2); model.breakUpRows = true; });
    expect(source.read()).toEqual([[1, 2], true]);
    expect(collect).toHaveBeenCalledTimes(2);
    expect(changed).toHaveBeenCalledOnce();
    stop(); changed.mockClear();
    edit(() => { model.colsSizes[0] = 3; });
    expect(changed).not.toHaveBeenCalled();
    const disconnected = source.read();
    expect(disconnected[0]).toEqual([3, 2]);
    stop = source.subscribe(changed);
    expect(source.read()).toBe(disconnected);
    expect(collect).toHaveBeenCalledTimes(3);
    lifetime.abort();
    expect(source.read()).toEqual([]);
    changed.mockClear();
    edit(() => { model.colsSizes[0] = 6; });
    expect(changed).not.toHaveBeenCalled();
  } finally { stop(); lifetime.abort(); recorder.dispose(); models.dispose(); }
});

it("rebinds native selection and model dependencies, releasing the old target", () => {
  const first = mkRuleSet({ values: { color: "red" } }), second = mkRuleSet({ values: { color: "blue" } });
  const a = new ChangeRecorder({ inst: first, _instUtil: instUtil }), b = new ChangeRecorder({ inst: second, _instUtil: instUtil });
  const models = new ModelSnapshots(), lifetime = new AbortController();
  const selected = createStore(() => first);
  const collect = vi.fn((field: Parameters<ConstructorParameters<typeof ModelFieldInputs>[1]>[0], watch: Parameters<ConstructorParameters<typeof ModelFieldInputs>[1]>[1]) => {
    watch(selected); field(selected.getState(), "values");
  });
  const source = new ModelFieldInputs({ models, lifetime: lifetime.signal, isCurrent: () => true }, collect);
  const changed = vi.fn(), stop = source.subscribe(changed);
  try {
    selected.setState(second, true);
    expect(source.read()[1]).toEqual({ color: "blue" });
    expect(changed).toHaveBeenCalledOnce(); changed.mockClear(); collect.mockClear();
    models.sync(a.withRecording(() => { first.values.color = "yellow"; }).changes);
    expect(collect).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
    models.sync(b.withRecording(() => { second.values.color = "orange"; }).changes);
    expect(source.read()[1]).toEqual({ color: "orange" });
    expect(changed).toHaveBeenCalledOnce();
  } finally { stop(); lifetime.abort(); a.dispose(); b.dispose(); models.dispose(); }
});

it("prepares shared projections before any field publishes without consuming their notifications", () => {
  const model = new ColumnsConfig({ colsSizes: [1], breakUpRows: false });
  const models = new ModelSnapshots(), lifetime = new AbortController();
  const scope = { models, lifetime: lifetime.signal, isCurrent: () => true };
  const recorder = new ChangeRecorder({ inst: model, _instUtil: instUtil });
  const parentCollect = vi.fn((field: Parameters<ConstructorParameters<typeof ModelFieldInputs>[1]>[0]) => field(model, "colsSizes", "breakUpRows"));
  const parent = new ModelFieldInputs(scope, parentCollect);
  const child = new ModelFieldInputs(scope, (_field, watch) => watch(parent));
  const early = models.field(model, "colsSizes").subscribe(() => {
    expect(child.read()).toEqual([[[1, 2], true]]);
  });
  const changed = vi.fn(), stop = child.subscribe(changed);
  try {
    models.sync(recorder.withRecording(() => { model.colsSizes.push(2); model.breakUpRows = true; }).changes);
    expect(changed).toHaveBeenCalledOnce();
    expect(parentCollect).toHaveBeenCalledTimes(2);
    for (let i = 0; i < 10; i++) { child.read(); }
    expect(parentCollect).toHaveBeenCalledTimes(2);
    stop(); early(); changed.mockClear(); parentCollect.mockClear();
    models.sync(recorder.withRecording(() => { model.colsSizes.push(3); }).changes);
    expect(changed).not.toHaveBeenCalled(); expect(parentCollect).not.toHaveBeenCalled();
    const reconnect = child.subscribe(changed);
    expect(child.read()).toEqual([[[1, 2, 3], true]]);
    reconnect();
  } finally { stop(); early(); lifetime.abort(); recorder.dispose(); models.dispose(); }
});
