import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import {
  ComponentType,
  formatParamDisplayName,
  getParamDisplayName,
} from "@/wab/shared/core/components";
import { mkParam, mkVar } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { reorderLevelWithParams } from "@/wab/shared/folders/prop-tree";
import { typeFactory } from "@/wab/shared/model/model-util";
import type { Component, Param } from "@/wab/shared/model/classes";
import type { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { smartHumanize } from "@/wab/shared/strs";
import {
  PropTreeInputs,
  collectPropTreeParams,
  type PropTreeInputNode,
  usePropTreeInputs,
} from "@/wab/client/studio-ctx/prop-tree-inputs";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

afterEach(cleanup);

function MountedProbe(props: {
  studioCtx: StudioCtx;
  component: Component;
  params: readonly Param[];
  suspend?: boolean;
}) {
  const pending = React.useMemo(() => new Promise<void>(() => undefined), []);
  const { models, tree } = usePropTreeInputs(
    props.studioCtx,
    props.component,
    props.params,
  );
  if (props.suspend) {
    throw pending;
  }
  return React.createElement("div", {
    "data-testid": "mounted-prop-tree",
    "data-model": models === props.studioCtx.modelSnapshots ? "current" : "captured",
    "data-count": String(tree.length),
    "data-tree": JSON.stringify(
      tree.map((node) =>
        node.kind === "folder" ? `folder:${node.name}` : `param:${node.param.uid}`,
      ),
    ),
  });
}

async function mountedFixture() {
  const site = createSite();
  const component = new TplMgr({ site }).addComponent({
    name: "Mounted props",
    type: ComponentType.Plain,
  });
  const first = makeParam("Group/Leaf");
  const second = makeParam("Other");
  component.params.push(first, second);
  const { studioCtx: studio, api } = fakeStudioCtx({ site });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  return { site, component, studio, api, first, second };
}

function makeParam(name: string, displayName?: string) {
  return mkParam({
    name,
    displayName,
    paramType: "prop",
    type: typeFactory.text(),
  });
}

function fixture() {
  const site = createSite();
  const component = new TplMgr({ site }).addComponent({
    name: "Native params",
    type: ComponentType.Plain,
  });
  const first = makeParam("Group/Leaf");
  const second = makeParam("Other");
  component.params.push(first, second);
  return { site, models: new ModelSnapshots(), component, first, second };
}

function displayNameChange(param: ReturnType<typeof makeParam>, value: string) {
  return {
    type: "update" as const,
    oldValue: param.displayName,
    newValue: value,
    changeNode: { inst: param, field: "displayName" as const },
  };
}

function modelsSync(
  models: ModelSnapshots,
  param: ReturnType<typeof makeParam>,
  value: string,
) {
  models.sync([displayNameChange(param, value)]);
}

it("uses the one shared display-name formatter and committed folder moves", async () => {
  expect(formatParamDisplayName(undefined, "fooBar", true)).toBe(
    smartHumanize("fooBar"),
  );
  expect(formatParamDisplayName("Explicit", "fooBar", true)).toBe("Explicit");
  expect(formatParamDisplayName(undefined, "fooBar", false)).toBe("fooBar");

  const { site, models, component, first, second } = fixture();
  expect(getParamDisplayName(component, first)).toBe(
    formatParamDisplayName(first.displayName, first.variable.name, false),
  );
  const source = new PropTreeInputs(
    models,
    component,
    site,
    component.params,
    () => true,
  );
  const tree = source.getSnapshot();
  expect(tree[0]).toMatchObject({ kind: "folder", name: "Group" });
  expect(collectPropTreeParams(ensure(tree[0], "folder")).map((p) => p.uid)).toEqual([
    first.uid,
  ]);
  expect(
    collectPropTreeParams(ensure(tree[1], "second")).map((p) => p.uid),
  ).toEqual([second.uid]);

  const same = source.getSnapshot();
  source.setParams([...component.params]);
  expect(source.getSnapshot()).toBe(same);

  const stop = source.subscribe(vi.fn());
  const unchangedFolder = source.getSnapshot()[0];
  second.displayName = "Other2";
  models.sync([displayNameChange(second, "Other2")]);
  await Promise.resolve();
  expect(source.getSnapshot()[0]).toBe(unchangedFolder);

  first.displayName = "Moved/Leaf";
  models.sync([displayNameChange(first, "Moved/Leaf")]);
  await Promise.resolve();
  expect(source.getSnapshot()[0]).toMatchObject({
    kind: "folder",
    name: "Moved",
  });
  expect(
    collectPropTreeParams(ensure(source.getSnapshot()[0], "moved folder")).map(
      (param) => param.uid,
    ),
  ).toEqual([first.uid]);
  stop();
});

it("exposes final prepared trees to an earlier public field subscriber", async () => {
  const { site, models, component, first, second } = fixture();
  const source = new PropTreeInputs(
    models,
    component,
    site,
    component.params,
    () => true,
  );
  const observed: (readonly PropTreeInputNode[])[] = [];
  const external = models
    .field(first, "displayName")
    .subscribe(() => observed.push(source.getSnapshot()));
  const listener = vi.fn();
  const stop = source.subscribe(listener);

  first.displayName = "A/Leaf";
  second.displayName = "B/Leaf";
  models.sync([
    displayNameChange(first, "A/Leaf"),
    displayNameChange(second, "B/Leaf"),
  ]);
  await Promise.resolve();

  expect(observed.length).toBeGreaterThan(0);
  expect(observed[observed.length - 1]).toMatchObject([
    { kind: "folder", name: "A" },
    { kind: "folder", name: "B" },
  ]);
  expect(listener).toHaveBeenCalledOnce();
  external();
  stop();
});

it("updates active in-place param membership and reorders original Param identities", () => {
  const { site, models, component, first, second } = fixture();
  const source = new PropTreeInputs(
    models,
    component,
    site,
    component.params,
    () => true,
  );
  const third = makeParam("Third");
  component.params.push(third);
  source.setParams(component.params);
  expect(source.getSnapshot()).toHaveLength(3);
  expect(
    collectPropTreeParams(ensure(source.getSnapshot()[2], "third")).map(
      (p) => p.uid,
    ),
  ).toEqual([third.uid]);

  reorderLevelWithParams(
    component,
    source.getSnapshot(),
    (node) =>
      collectPropTreeParams(node).map((param) => models.resolve(param)),
    2,
    0,
  );
  expect(component.params.map((param) => param.uid)).toEqual([
    third.uid,
    first.uid,
    second.uid,
  ]);
  expect(component.params[0]).toBe(third);

  component.params.splice(0, 1);
  source.setParams(component.params);
  expect(source.getSnapshot()).toHaveLength(2);
  expect(
    collectPropTreeParams(ensure(source.getSnapshot()[0], "remaining folder")).map(
      (param) => param.uid,
    ),
  ).toEqual([first.uid]);
});

it("reconnects after last release and coalesces same-commit field changes", async () => {
  const { site, models, component, first, second } = fixture();
  const source = new PropTreeInputs(
    models,
    component,
    site,
    component.params,
    () => true,
  );
  const firstListener = vi.fn();
  const stop = source.subscribe(firstListener);
  stop();

  const secondListener = vi.fn();
  source.subscribe(secondListener);
  first.displayName = "A";
  second.displayName = "B";
  models.sync([
    displayNameChange(first, "A"),
    displayNameChange(second, "B"),
  ]);
  await Promise.resolve();
  expect(secondListener).toHaveBeenCalledOnce();
});

it("closes an old owner before passive effects without resolving its refs", async () => {
  const { site, models, component, first } = fixture();
  let ownerCurrent = true;
  const source = new PropTreeInputs(
    models,
    component,
    site,
    component.params,
    () => ownerCurrent,
  );
  const notified = vi.fn();
  const stop = source.subscribe(notified);
  const field = vi.spyOn(models, "field");
  const resolve = vi.spyOn(models, "resolve");
  ownerCurrent = false;
  expect(source.getSnapshot()).toEqual([]);
  expect(field).not.toHaveBeenCalled();
  expect(resolve).not.toHaveBeenCalled();
  await Promise.resolve();
  expect(notified).toHaveBeenCalled();
  source.setParams([first], false);
  expect(field).not.toHaveBeenCalled();
  expect(resolve).not.toHaveBeenCalled();
  stop();
});
it("rebinds a replaced Param.variable name and releases the old Var field", async () => {
  const { site, models, component, first } = fixture();
  const source = new PropTreeInputs(
    models,
    component,
    site,
    component.params,
    () => true,
  );
  const listener = vi.fn();
  const stop = source.subscribe(listener);
  const oldVar = first.variable;
  const newVar = mkVar("Fresh/Leaf");
  first.variable = newVar;
  models.sync([
    {
      type: "update",
      oldValue: oldVar,
      newValue: newVar,
      changeNode: { inst: first, field: "variable" },
    },
  ]);
  await Promise.resolve();
  expect(source.getSnapshot()[0]).toMatchObject({
    kind: "folder",
    name: "Fresh",
  });

  newVar.name = "Final/Leaf";
  models.sync([
    {
      type: "update",
      oldValue: "Fresh/Leaf",
      newValue: "Final/Leaf",
      changeNode: { inst: newVar, field: "name" },
    },
  ]);
  await Promise.resolve();
  expect(source.getSnapshot()[0]).toMatchObject({
    kind: "folder",
    name: "Final",
  });

  oldVar.name = "Stale/Leaf";
  models.sync([
    {
      type: "update",
      oldValue: "Group/Leaf",
      newValue: "Stale/Leaf",
      changeNode: { inst: oldVar, field: "name" },
    },
  ]);
  await Promise.resolve();
  expect(source.getSnapshot()[0]).toMatchObject({
    kind: "folder",
    name: "Final",
  });
  stop();
});
it("does not register field leases before the first subscriber", () => {
  const { site, models, component } = fixture();
  const source = new PropTreeInputs(
    models,
    component,
    site,
    component.params,
    () => true,
  );
  const subscribePrepared = vi.spyOn(models, "subscribePreparedField");
  source.getSnapshot();
  expect(subscribePrepared).not.toHaveBeenCalled();
});
it("keeps a StrictMode mounted tree live and closes the old owner before passive cleanup", async () => {
  const { component, studio, api } = await mountedFixture();
  const oldModels = studio.modelSnapshots;
  const bundle = studio.bundleSite().site;
  const release = mock<PkgVersionInfoMeta>({
    id: "prop-tree-world",
    pkgId: "prop-tree-pkg",
    version: "1.0.0",
    branchId: null,
  });
  api.getPkgVersion.mockResolvedValueOnce({
    pkg: { ...release, model: bundle },
    depPkgs: [],
    etag: "prop-tree-world-etag",
  });

  const view = render(
    React.createElement(
      React.StrictMode,
      null,
      React.createElement(MountedProbe, {
        studioCtx: studio,
        component,
        params: component.params,
      }),
    ),
  );
  expect(view.getByTestId("mounted-prop-tree")).toHaveAttribute(
    "data-count",
    "2",
  );

  await act(async () => {
    await studio["loadVersion"](release, true);
  });
  const newModels = studio.modelSnapshots;
  expect(newModels).not.toBe(oldModels);
  const declaredField = vi.spyOn(newModels, "declaredField");
  const newField = vi.spyOn(newModels, "field");
  const newResolve = vi.spyOn(newModels, "resolve");
  declaredField.mockClear();
  newField.mockClear();
  newResolve.mockClear();

  view.rerender(
    React.createElement(
      React.StrictMode,
      null,
      React.createElement(MountedProbe, {
        studioCtx: studio,
        component,
        params: [...component.params],
      }),
    ),
  );
  expect(view.getByTestId("mounted-prop-tree")).toHaveAttribute(
    "data-count",
    "0",
  );
  expect(declaredField).not.toHaveBeenCalled();
  expect(newField).not.toHaveBeenCalled();
  expect(newResolve).not.toHaveBeenCalled();
  view.unmount();
  await studio.awaitEval();
  studio.dispose();
});

it("rejects a new mount of a pre-loadVersion component before field enrollment", async () => {
  const { component, studio, api } = await mountedFixture();
  const bundle = studio.bundleSite().site;
  const release = mock<PkgVersionInfoMeta>({
    id: "prop-tree-old-mount",
    pkgId: "prop-tree-old-mount-pkg",
    version: "1.0.0",
    branchId: null,
  });
  api.getPkgVersion.mockResolvedValueOnce({
    pkg: { ...release, model: bundle },
    depPkgs: [],
    etag: "prop-tree-old-mount-etag",
  });
  await act(async () => {
    await studio["loadVersion"](release, true);
  });
  const newModels = studio.modelSnapshots;
  const declaredField = vi.spyOn(newModels, "declaredField");
  const field = vi.spyOn(newModels, "field");
  const resolve = vi.spyOn(newModels, "resolve");
  declaredField.mockClear();
  field.mockClear();
  resolve.mockClear();

  expect(() =>
    render(
      React.createElement(MountedProbe, {
        studioCtx: studio,
        component,
        params: component.params,
      }),
    ),
  ).toThrow(/captured site\/dependency roster/);
  expect(declaredField).not.toHaveBeenCalled();
  expect(field).not.toHaveBeenCalled();
  expect(resolve).not.toHaveBeenCalled();
  await studio.awaitEval();
  studio.dispose();
});

it("rejects a never-bound foreign component before any field declaration", async () => {
  const { studio } = await mountedFixture();
  const foreignSite = createSite();
  const foreignComponent = new TplMgr({ site: foreignSite }).addComponent({
    name: "Foreign component",
    type: ComponentType.Plain,
  });
  const foreignParam = makeParam("Foreign/Leaf");
  foreignComponent.params.push(foreignParam);
  const declaredField = vi.spyOn(studio.modelSnapshots, "declaredField");
  const field = vi.spyOn(studio.modelSnapshots, "field");
  const resolve = vi.spyOn(studio.modelSnapshots, "resolve");
  declaredField.mockClear();
  field.mockClear();
  resolve.mockClear();

  expect(() =>
    render(
      React.createElement(MountedProbe, {
        studioCtx: studio,
        component: foreignComponent,
        params: foreignComponent.params,
      }),
    ),
  ).toThrow(/captured site\/dependency roster/);
  expect(declaredField).not.toHaveBeenCalled();
  expect(field).not.toHaveBeenCalled();
  expect(resolve).not.toHaveBeenCalled();
  await studio.awaitEval();
  studio.dispose();
});

it("keeps committed tree untouched by a suspended same-hook params update", async () => {
  const { component, studio, first, second } = await mountedFixture();
  const view = render(
    React.createElement(
      React.Suspense,
      { fallback: React.createElement("span", null, "pending") },
      React.createElement(MountedProbe, {
        studioCtx: studio,
        component,
        params: component.params,
      }),
    ),
  );
  expect(view.getByTestId("mounted-prop-tree")).toHaveAttribute(
    "data-count",
    "2",
  );
  const subscribePrepared = vi.spyOn(
    studio.modelSnapshots,
    "subscribePreparedField",
  );
  subscribePrepared.mockClear();

  view.rerender(
    React.createElement(
      React.Suspense,
      { fallback: React.createElement("span", null, "pending") },
      React.createElement(MountedProbe, {
        studioCtx: studio,
        component,
        params: [first],
        suspend: true,
      }),
    ),
  );
  expect(view.getByText("pending")).toBeInTheDocument();
  expect(subscribePrepared).not.toHaveBeenCalled();
  second.displayName = "Changed/Leaf";
  modelsSync(studio.modelSnapshots, second, "Changed/Leaf");
  await Promise.resolve();

  view.rerender(
    React.createElement(
      React.Suspense,
      { fallback: React.createElement("span", null, "pending") },
      React.createElement(MountedProbe, {
        studioCtx: studio,
        component,
        params: component.params,
      }),
    ),
  );
  expect(view.getByTestId("mounted-prop-tree")).toHaveAttribute(
    "data-count",
    "2",
  );
  expect(view.getByTestId("mounted-prop-tree")).toHaveAttribute(
    "data-tree",
    expect.stringContaining("Changed"),
  );
  expect(subscribePrepared).not.toHaveBeenCalled();

  view.rerender(
    React.createElement(
      React.Suspense,
      { fallback: React.createElement("span", null, "pending") },
      React.createElement(MountedProbe, {
        studioCtx: studio,
        component,
        params: [first],
      }),
    ),
  );
  expect(view.getByTestId("mounted-prop-tree")).toHaveAttribute(
    "data-count",
    "1",
  );
  expect(subscribePrepared).toHaveBeenCalled();

  view.unmount();
  await studio.awaitEval();
  studio.dispose();
});
it("does not alias distinct folder tuples containing delimiters", async () => {
  const { site, models, component, first, second } = fixture();
  first.variable.name = `A/Leaf|${second.uid}:B/Leaf`;
  second.variable.name = "C/Leaf";
  const source = new PropTreeInputs(
    models,
    component,
    site,
    component.params,
    () => true,
  );
  const stop = source.subscribe(vi.fn());
  const paths = () =>
    source
      .getSnapshot()
      .map((node) =>
        node.kind === "folder" ? node.path : `param:${node.param.uid}`,
      );

  const before = paths();
  first.variable.name = "A/Leaf";
  second.variable.name = `B/Leaf|${second.uid}:C/Leaf`;
  models.sync([
    {
      type: "update",
      oldValue: `A/Leaf|${second.uid}:B/Leaf`,
      newValue: "A/Leaf",
      changeNode: { inst: first.variable, field: "name" },
    },
    {
      type: "update",
      oldValue: "C/Leaf",
      newValue: `B/Leaf|${second.uid}:C/Leaf`,
      changeNode: { inst: second.variable, field: "name" },
    },
  ]);
  await Promise.resolve();
  expect(paths()).not.toEqual(before);
  stop();
});


it("tracks in-place caller roster edits through the same mounted hook", async () => {
  const { component, studio } = await mountedFixture();
  const params = [...component.params];
  const view = render(React.createElement(MountedProbe, { studioCtx: studio, component, params }));
  try {
    expect(view.getByTestId("mounted-prop-tree")).toHaveAttribute("data-count", "2");
    params.pop();
    view.rerender(React.createElement(MountedProbe, { studioCtx: studio, component, params }));
    expect(view.getByTestId("mounted-prop-tree")).toHaveAttribute("data-count", "1");
    params.push(component.params[1]);
    view.rerender(React.createElement(MountedProbe, { studioCtx: studio, component, params }));
    expect(view.getByTestId("mounted-prop-tree")).toHaveAttribute("data-count", "2");
  } finally { view.unmount(); await studio.awaitEval(); studio.dispose(); }
});

it("retains the latest committed row identity across successive roster edits", async () => {
  const { component, studio, first, second } = await mountedFixture();
  let committedTree: readonly PropTreeInputNode[] = [];
  function Probe({ params }: { params: readonly Param[] }) {
    const { tree } = usePropTreeInputs(studio, component, params);
    React.useLayoutEffect(() => { committedTree = tree; }, [tree]);
    return null;
  }
  const view = render(React.createElement(Probe, { params: [first] }));
  try {
    view.rerender(React.createElement(Probe, { params: [first, second] }));
    const secondNode = committedTree[1];
    expect(secondNode).toBeDefined();
    view.rerender(React.createElement(Probe, { params: [second] }));
    expect(committedTree[0]).toBe(secondNode);
  } finally { view.unmount(); await studio.awaitEval(); studio.dispose(); }
});
