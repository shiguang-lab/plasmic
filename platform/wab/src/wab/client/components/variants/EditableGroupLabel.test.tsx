import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { EditableGroupLabel } from "@/wab/client/components/variants/EditableGroupLabel";
import type { EditableLabelHandles } from "@/wab/client/components/widgets/EditableLabel";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { cloneParamAndVar } from "@/wab/shared/core/lang";
import { createSite, writeable } from "@/wab/shared/core/sites";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ok } from "neverthrow";
import React from "react";

afterEach(cleanup);

function setup() {
  const site = createSite();
  const tplMgr = new TplMgr({ site });
  const component = tplMgr.addComponent({
    type: ComponentType.Plain,
    name: "Card",
  });
  const group = tplMgr.createVariantGroup({ component, name: "State" });
  const { studioCtx } = fakeStudioCtx({ site });
  return { site, tplMgr, component, group, studioCtx };
}

function renderLabel(
  studioCtx: ReturnType<typeof setup>["studioCtx"],
  group: ReturnType<typeof setup>["group"],
  onEdit: (name: string) => void,
  ref?: React.Ref<EditableLabelHandles>,
) {
  return render(
    <StudioCtxContext.Provider value={studioCtx}>
      <EditableGroupLabel ref={ref} group={group} onEdit={onEdit} />
    </StudioCtxContext.Provider>,
  );
}

it("follows a same-length variable rename through a real Studio transaction and keeps ref editing", async () => {
  const { group, studioCtx } = setup();
  try {
    const onEdit = vi.fn((name: string) => {
      void studioCtx.change(() => {
        group.param.variable.name = name;
        return ok();
      });
    });
    const ref = React.createRef<EditableLabelHandles>();
    renderLabel(studioCtx, group, onEdit, ref);

    expect(screen.getByText("State")).toBeTruthy();
    const labelRef = ensure(ref.current, "EditableGroupLabel ref");
    act(() => labelRef.setEditing(true));

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("State");
    fireEvent.change(input, { target: { value: "Sizes" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    await waitFor(() => expect(screen.getByText("Sizes")).toBeTruthy());
    expect(onEdit).toHaveBeenCalledWith("Sizes");
    expect(group.param.variable.name).toBe("Sizes");
  } finally {
    studioCtx.dispose();
  }
});

it("follows nested param and variable replacement in the owning Studio model", async () => {
  const { component, group, studioCtx } = setup();
  try {
    const onEdit = vi.fn();
    renderLabel(studioCtx, group, onEdit);
    expect(screen.getByText("State")).toBeTruthy();

    const oldParam = group.param;
    const replacement = cloneParamAndVar(oldParam);
    await act(async () => {
      await studioCtx.change(() => {
        writeable(replacement).state = oldParam.state;
        writeable(oldParam.state).param = replacement;
        writeable(group).param = replacement;
        component.params[component.params.indexOf(oldParam)] = replacement;
        replacement.variable.name = "Scale";
        return ok();
      });
    });

    await waitFor(() => expect(screen.getByText("Scale")).toBeTruthy());
    expect(onEdit).not.toHaveBeenCalled();
    expect(component.params).toContain(replacement);

    await act(async () => {
      await studioCtx.change(() => {
        replacement.variable.name = "Scope";
        return ok();
      });
    });

    await waitFor(() => expect(screen.getByText("Scope")).toBeTruthy());
    expect(onEdit).not.toHaveBeenCalled();
  } finally {
    studioCtx.dispose();
  }
});
