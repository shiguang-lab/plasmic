import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { CommentSubjectName, CommentSubjectType } from "@/wab/client/components/comments/CommentSubjectInputs";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { RSH } from "@/wab/shared/RuleSetHelpers";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { CustomCode, TemplatedString, ensureKnownTplTag, isKnownCustomCode, isKnownTemplatedString } from "@/wab/shared/model/classes";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("updates a comment heading through committed name, layout, tag and input-attribute changes", async () => {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Commented", type: ComponentType.Plain });
  const unrelated = manager.addComponent({ name: "Unrelated", type: ComponentType.Plain });
  const tpl = ensureKnownTplTag(component.tplTree);
  tpl.name = "Before";
  RSH(tpl.vsettings[0].rs, tpl).set("display", "flex");
  RSH(tpl.vsettings[0].rs, tpl).set("flex-direction", "column");
  const frame = mkArenaFrame({ site, component, name: "Commented", width: 200, height: 100 });
  site.arenas.push(mkMixedArena("Comments", [frame]));
  const { studioCtx: studio } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Comments" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Commented view");
  studio.setStudioFocusOnViewCtxContent(view);
  const commits = vi.fn();
  const mounted = render(<React.Profiler id="comment-heading" onRender={commits}><><output data-testid="subject-name"><CommentSubjectName studio={studio} subject={tpl} fallback="Unnamed" /></output><output data-testid="subject-type"><CommentSubjectType view={view} subject={tpl} /></output></></React.Profiler>);
  try {
    expect(screen.getByTestId("subject-name").textContent).toBe("Before");
    expect(screen.getByTestId("subject-type").textContent).toBe("vertical stack");
    const before = commits.mock.calls.length;
    await act(async () => { await studio.changeUnsafe(() => { unrelated.name = "Still unrelated"; }); });
    expect(commits).toHaveBeenCalledTimes(before);
    await act(async () => { await studio.changeUnsafe(() => { tpl.name = "After"; RSH(tpl.vsettings[0].rs, tpl).set("flex-direction", "row"); }); });
    expect(screen.getByTestId("subject-name").textContent).toBe("After");
    expect(screen.getByTestId("subject-type").textContent).toBe("horizontal stack");
    await act(async () => { await studio.changeUnsafe(() => {
      tpl.tag = "input";
      tpl.vsettings[0].attrs.type = new CustomCode({ code: '"password"', fallback: undefined });
    }); });
    expect(screen.getByTestId("subject-type").textContent).toBe("password input");
    await act(async () => { await studio.changeUnsafe(() => {
      const expression = tpl.vsettings[0].attrs.type;
      if (!isKnownCustomCode(expression)) { throw new Error("Expected CustomCode"); }
      expression.code = '"checkbox"';
    }); });
    expect(screen.getByTestId("subject-type").textContent).toBe("checkbox");
    await act(async () => { await studio.changeUnsafe(() => {
      tpl.vsettings[0].attrs.type = new TemplatedString({ text: ["password"] });
    }); });
    expect(screen.getByTestId("subject-type").textContent).toBe("password input");
    await act(async () => { await studio.changeUnsafe(() => {
      const expression = tpl.vsettings[0].attrs.type;
      if (!isKnownTemplatedString(expression)) { throw new Error("Expected TemplatedString"); }
      expression.text = ["radio"];
    }); });
    expect(screen.getByTestId("subject-type").textContent).toBe("radio button");
    act(() => { studio.arenaState.viewRegistry.remove(view); view.dispose(); });
    const departed = new ChangeRecorder({inst: site, _instUtil: instUtil});
    try { act(() => studio.modelSnapshots.sync(departed.withRecording(() => {tpl.tag = "section";}).changes)); } finally {departed.dispose();}
    mounted.rerender(<React.Profiler id="comment-heading" onRender={commits}><><output data-testid="subject-name"><CommentSubjectName studio={studio} subject={tpl} fallback="Unnamed" /></output><output data-testid="subject-type"><CommentSubjectType view={view} subject={tpl} /></output></></React.Profiler>);
    expect(screen.getByTestId("subject-type").textContent).toBe("radio button");
  } finally { mounted.unmount(); await studio.awaitEval(); studio.dispose(); }
});

it("retains a comment name and releases fields when its captured model world retires", () => {
  const site = createSite(), component = new TplMgr({site}).addComponent({name: "Subject", type: ComponentType.Plain});
  const subject = ensureKnownTplTag(component.tplTree); subject.name = "Captured name";
  const models = new ModelSnapshots(), recorder = new ChangeRecorder({inst: site, _instUtil: instUtil});
  const arena = new StudioArenaState({site, modelSnapshots: models});
  const studio = {site, modelSnapshots: models, arenaState: arena} as unknown as StudioCtx;
  const mounted = render(<CommentSubjectName studio={studio} subject={subject} fallback="Unnamed" />);
  try {
    expect(screen.getByText("Captured name")).toBeDefined();
    act(() => arena.reset());
    act(() => models.sync(recorder.withRecording(() => {subject.name = "Departed edit";}).changes));
    const field = vi.spyOn(models, "declaredField");
    mounted.rerender(<CommentSubjectName studio={studio} subject={subject} fallback="Different fallback" />);
    expect(screen.getByText("Captured name")).toBeDefined();
    expect(field).not.toHaveBeenCalled();
  } finally {mounted.unmount(); recorder.dispose(); arena.dispose(); models.dispose();}
});
