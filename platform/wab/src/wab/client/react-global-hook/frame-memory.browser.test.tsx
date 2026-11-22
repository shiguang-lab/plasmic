import type { Fiber } from "@/wab/client/react-global-hook/fiber";
import { globalHookCtx } from "@/wab/client/react-global-hook/globalHook";
import { UndoLog } from "@/wab/client/undo-log";
import { ensure, ensureInstance } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import {
  ChangeRecorder,
  emptyRecordedChanges,
} from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { ValComponent } from "@/wab/shared/core/val-nodes";
import { instUtil } from "@/wab/shared/model/InstUtil";
import type { TplComponent } from "@/wab/shared/model/classes";
import { getEmptyDeletedAssetsSummary } from "@/wab/shared/server-updates-utils";
import type { CDPSession } from "@vitest/browser-playwright";
import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { cdp } from "vitest/browser";

function openFrame(uid: number, tpl: TplComponent) {
  const iframe = document.body.appendChild(document.createElement("iframe"));
  const doc = ensure(iframe.contentDocument, "Expected a same-origin frame");
  const reactRoot = createRoot(doc.body);
  flushSync(() => reactRoot.render(<button>Board {uid}</button>));
  const button = ensure(
    doc.querySelector("button"),
    "Expected a rendered element",
  );
  const key = ensure(
    Object.keys(button).find((k) => k.startsWith("__reactFiber$")),
    "Expected a React Fiber",
  );
  const fiber: Fiber = Reflect.get(button, key);
  const frame = globalHookCtx.createFrameState({
    uid,
    objectPrototype: Object.getPrototypeOf(doc),
  });
  const val = new ValComponent({
    tpl,
    frameUid: uid,
    key: tpl.uuid,
    fullKey: tpl.uuid,
    fibers: [fiber],
    className: "",
    parent: undefined,
    valOwner: undefined,
    slotInfo: undefined,
    slotArgs: new Map(),
    slotCanvasEnvs: new Map(),
  });
  val.codeComponentProps = { element: button };
  const selected = ensureInstance(
    frame.renderState.registerVal(val),
    ValComponent,
  );
  return {
    selected,
    documentRef: new WeakRef(doc),
    close() {
      reactRoot.unmount();
      frame.renderState.unregisterVal(val);
      frame.dispose();
      iframe.remove();
    },
  };
}

it("collects evicted iframe documents while undo retains selections and restores them on reopen", async () => {
  const site = createSite();
  const component = mkComponent({
    name: "Initial",
    type: ComponentType.Plain,
    tplTree: mkTplTagX("div"),
  });
  site.components.push(component);
  const tpl = mkTplComponent(component, component.variants[0]);
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const history = new UndoLog(site, recorder, getEmptyDeletedAssetsSummary());
  history.record({
    view: { focusedOnFrame: false },
    changes: emptyRecordedChanges(),
  });
  function editAndClose(index: number) {
    const board = openFrame(5550 + index, tpl);
    try {
      const changes = recorder.withRecording(() => {
        component.name = "Change" + index;
      });
      history.record({
        view: { focusedOnFrame: false, focusedSelectable: board.selected },
        changes,
      });
      return board.documentRef;
    } finally {
      board.close();
    }
  }

  try {
    const documents = Array.from({ length: 8 }, (_, index) =>
      editAndClose(index),
    );
    const session: CDPSession = cdp();
    for (let i = 0; i < 3; i++) {
      await session.send("HeapProfiler.collectGarbage");
    }
    expect(documents.filter((ref) => ref.deref())).toHaveLength(0);
    const { view } = history.undo();
    expect(component.name).toBe("Change6");
    const reopened = openFrame(5556, tpl);
    try {
      expect(reopened.selected).toBe(view.focusedSelectable);
      expect(reopened.selected.codeComponentProps?.element.ownerDocument).toBe(
        reopened.documentRef.deref(),
      );
      history.redo();
      expect(component.name).toBe("Change7");
    } finally {
      reopened.close();
    }
  } finally {
    recorder.dispose();
  }
});
