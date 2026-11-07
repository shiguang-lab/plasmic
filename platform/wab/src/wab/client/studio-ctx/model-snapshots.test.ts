import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { instUtil } from "@/wab/shared/model/InstUtil";

function fixture() {
  const site = createSite();
  const component = new TplMgr({ site }).addComponent();
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const snapshots = new ModelSnapshots();
  return { site, component, recorder, snapshots };
}

it("captures demanded fields only, normalizes identity and preserves model cycles", () => {
  const { site, component, recorder, snapshots } = fixture();
  try {
    const components = snapshots.field(site, "components");
    const ref = ensure(components.getState()[0], "Component reference");
    expect(ref).toEqual({ uid: component.uid, type: "Component" });
    expect(ref).not.toBe(component);
    expect(snapshots.ref(component)).toBe(ref);
    expect(snapshots.declaredField(component, "name")).toBe(snapshots.field(component, "name"));
    expect(() => snapshots.declaredField(component, "missingField")).toThrow("does not exist");
    expect(Object.isFrozen(ref)).toBe(true);
    expect(Object.isFrozen(components.getState())).toBe(true);
    expect(snapshots.resolve(ref)).toBe(component);
    expect(snapshots.field(site, "components")).toBe(components);
    const child = mkTplTagX("span");
    const root = component.tplTree;
    expect("children" in root).toBe(true);
    if (!("children" in root)) {
      throw new Error("Expected a tag root");
    }
    const changes = recorder.withRecording(() => {
      root.children.push(child);
      child.parent = root;
    });
    snapshots.sync(changes.changes);
    const children = snapshots.field(root, "children").getState();
    const parent = ensure(
      snapshots.field(child, "parent").getState(),
      "Parent reference",
    );
    expect(snapshots.resolve(ensure(children[0], "Child reference"))).toBe(
      child,
    );
    expect(snapshots.resolve(parent)).toBe(root);
    expect(snapshots.field(root, "children").getState()).toBe(children);
    const childName = snapshots.field(child, "name");
    const listPublish = vi.fn();
    const stopList = snapshots.field(root, "children").subscribe(listPublish);
    const rename = recorder.withRecording(() => {
      child.name = "Renamed";
    });
    snapshots.sync(rename.changes);
    expect(childName.getState()).toBe("Renamed");
    expect(snapshots.field(root, "children").getState()).toBe(children);
    expect(listPublish).not.toHaveBeenCalled();
    stopList();
    const other = new ModelSnapshots();
    expect(() => other.resolve(ref)).toThrow("another owner");
    other.dispose();
  } finally {
    snapshots.dispose();
    recorder.dispose();
  }
});

it("captures dictionary primitives without changing their values and skips final-value no-ops", () => {
  const { site, recorder, snapshots } = fixture();
  try {
    const seed = recorder.withRecording(() => {
      site.flags = { zero: 0, disabled: false, empty: "", two: "old" };
    });
    snapshots.sync(seed.changes);
    const flags = snapshots.field(site, "flags");
    const before = flags.getState();
    const publish = vi.fn();
    const stop = flags.subscribe(publish);
    const edit = recorder.withRecording(() => {
      site.flags.two = "new";
    });
    expect(flags.getState()).toBe(before);
    expect(before.two).toBe("old");
    snapshots.sync(edit.changes);
    expect(flags.getState()).toEqual({
      zero: 0,
      disabled: false,
      empty: "",
      two: "new",
    });
    expect(Object.isFrozen(flags.getState())).toBe(true);
    expect(publish).toHaveBeenCalledOnce();
    const current = flags.getState();
    const noOp = recorder.withRecording(() => {
      site.flags.two = "intermediate";
      site.flags.two = "new";
    });
    snapshots.sync(noOp.changes);
    expect(flags.getState()).toBe(current);
    expect(publish).toHaveBeenCalledOnce();
    const remove = recorder.withRecording(() => {
      delete site.flags.two;
    });
    snapshots.sync(remove.changes);
    expect(flags.getState()).not.toHaveProperty("two");
    expect(flags.getState().disabled).toBe(false);
    stop();
  } finally {
    snapshots.dispose();
    recorder.dispose();
  }
});

it("installs all dirty entity fields before the first notification and ignores unrelated changes", () => {
  const { site, component, recorder, snapshots } = fixture();
  try {
    const name = snapshots.field(component, "name");
    const fonts = snapshots.field(site, "userManagedFonts");
    const flags = snapshots.field(site, "flags");
    const unrelated = vi.fn();
    const consistent = vi.fn(() => {
      expect(name.getState()).toBe("Committed");
      expect(fonts.getState()).toEqual(["Font"]);
    });
    const stopName = name.subscribe(consistent);
    const stopFonts = fonts.subscribe(consistent);
    const stopFlags = flags.subscribe(unrelated);
    const changes = recorder.withRecording(() => {
      component.name = "Intermediate";
      component.name = "Committed";
      site.userManagedFonts.push("Font");
    });
    snapshots.sync(changes.changes);
    expect(consistent).toHaveBeenCalledTimes(2);
    expect(unrelated).not.toHaveBeenCalled();
    stopName();
    stopFonts();
    stopFlags();
  } finally {
    snapshots.dispose();
    recorder.dispose();
  }
});

it("releases subscriptions and prevents publication after owner disposal", () => {
  const { component, recorder, snapshots } = fixture();
  try {
    const name = snapshots.field(component, "name");
    const before = name.getState();
    const publish = vi.fn();
    const stop = name.subscribe(publish);
    snapshots.dispose();
    const changes = recorder.withRecording(() => {
      component.name = "Stale";
    });
    snapshots.sync(changes.changes);
    expect(name.getState()).toBe(before);
    expect(publish).not.toHaveBeenCalled();
    expect(() => snapshots.field(component, "name")).toThrow("disposed");
    const lateStop = name.subscribe(publish);
    stop();
    lateStop();
  } finally {
    recorder.dispose();
  }
});

it("holds field notifications until the completed synchronous command while keeping installed inputs readable", () => {
  const { component, recorder, snapshots } = fixture();
  try {
    const name = snapshots.field(component, "name");
    let completed = false;
    const changed = vi.fn(() => {
      expect(completed).toBe(true);
      expect(name.getState()).toBe("Final");
    });
    name.subscribe(changed);
    snapshots.deferPublication(() => {
      snapshots.sync(recorder.withRecording(() => { component.name = "Intermediate"; }).changes);
      expect(name.getState()).toBe("Intermediate");
      snapshots.deferPublication(() => {
        snapshots.sync(recorder.withRecording(() => { component.name = "Final"; }).changes);
      });
      expect(name.getState()).toBe("Final");
      expect(changed).not.toHaveBeenCalled();
      completed = true;
    });
    expect(changed).toHaveBeenCalledOnce();
    snapshots.deferPublication(() => {
      snapshots.sync(recorder.withRecording(() => { component.name = "Detached"; }).changes);
      snapshots.dispose();
    });
    expect(changed).toHaveBeenCalledOnce();
  } finally {
    snapshots.dispose();
    recorder.dispose();
  }
});

it("prepares declared dependents after all field installs and before derived/UI publication", () => {
  const { site, component, recorder, snapshots } = fixture();
  try {
    const name = snapshots.field(component, "name");
    const fonts = snapshots.field(site, "userManagedFonts");
    const order: string[] = [];
    const prepared = vi.fn(() => {
      expect(name.getState()).toBe("Prepared");
      expect(fonts.getState()).toEqual(["Font"]);
      order.push("prepare");
    });
    const stop = snapshots.subscribePreparedField(name, prepared);
    const changed = vi.fn(() => order.push("UI"));
    name.subscribe(changed);
    snapshots.deferPublication(() => {
      const changes = recorder.withRecording(() => {
        component.name = "Prepared";
        site.userManagedFonts.push("Font");
      });
      snapshots.sync(changes.changes, () => {
        expect(prepared).toHaveBeenCalledOnce();
        expect(changed).not.toHaveBeenCalled();
        order.push("derived");
      });
      expect(changed).not.toHaveBeenCalled();
    });
    expect(order).toEqual(["prepare", "derived", "UI"]);
    snapshots.sync(recorder.withRecording(() => { component.name = "Prepared"; }).changes);
    expect(prepared).toHaveBeenCalledOnce();
    stop();
    snapshots.sync(recorder.withRecording(() => { component.name = "Detached"; }).changes);
    expect(prepared).toHaveBeenCalledOnce();
    const foreign = new ModelSnapshots();
    expect(() => foreign.subscribePreparedField(name, prepared)).toThrow("another owner");
    foreign.dispose();
  } finally {
    snapshots.dispose();
    recorder.dispose();
  }
});
