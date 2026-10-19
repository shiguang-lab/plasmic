import { TemplatedTextEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/TemplatedTextEditor";
import { ensure } from "@/wab/shared/common";
import { customCode } from "@/wab/shared/core/exprs";
import { createSite } from "@/wab/shared/core/sites";
import { getProjectFlags } from "@/wab/shared/devflags";
import { TemplatedString } from "@/wab/shared/model/classes";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import * as React from "react";
import { ReactEditor } from "slate-react";

vi.mock("@/wab/client/contexts/StudioContexts", () => ({
  useStudioCtx: () => ({
    focusedViewCtx: () => undefined,
    projectFlags: () => getProjectFlags(createSite()),
  }),
}));

vi.mock(
  "@/wab/client/components/sidebar-tabs/DataBinding/useDataTokenSuggestionsMenu",
  () => ({
    useDataTokenSuggestionsMenu: () => ({
      openMenu: vi.fn(),
      getComboboxProps: () => ({}),
      getInputProps: (props: object) => props,
      menu: null,
    }),
  }),
);

vi.mock("@/wab/client/components/sidebar-tabs/DataBinding/DataPicker", () => ({
  default: ({ onCancel }: { onCancel: () => void }) => (
    <button onClick={onCancel}>Cancel expression</button>
  ),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("restores focus once after closing and does not steal it from a reopened picker", async () => {
  vi.useFakeTimers();
  const focus = vi.spyOn(ReactEditor, "focus").mockImplementation(vi.fn());
  vi.spyOn(ReactEditor, "isFocused").mockReturnValue(false);
  const { container } = render(
    <TemplatedTextEditor
      value={new TemplatedString({ text: ["", customCode("(user.name)"), ""] })}
      data={{ user: { name: "Example" } }}
      onChange={vi.fn()}
      exprCtx={{
        component: null,
        inStudio: true,
        projectFlags: getProjectFlags(createSite()),
      }}
    />,
  );
  const chip = ensure(
    container.querySelector(".code-chip"),
    "Expected expression chip",
  );
  fireEvent.click(chip);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(600);
  });
  expect(chip.classList.contains("right-panel-input-background-selected")).toBe(
    true,
  );
  expect(focus).not.toHaveBeenCalled();

  fireEvent.click(screen.getByText("Cancel expression"));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(600);
  });
  expect(focus).toHaveBeenCalledOnce();

  fireEvent.click(chip);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(screen.getByText("Cancel expression")).toBeTruthy();
  expect(focus).toHaveBeenCalledOnce();
});
