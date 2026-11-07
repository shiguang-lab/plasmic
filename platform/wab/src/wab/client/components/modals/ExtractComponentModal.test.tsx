import { ExtractComponentForm } from "@/wab/client/components/modals/ExtractComponentModal";
import { isAnyModalOpen } from "@/wab/client/components/widgets/open-modals";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkParam } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import {
  ComponentDataQuery,
  ComponentServerQuery,
} from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

afterEach(cleanup);

function fixture() {
  const props = {
    site: createSite(),
    containingComponent: mkComponent({
      name: "Container",
      type: ComponentType.Plain,
      tplTree: mkTplTagX("div"),
    }),
    linkedParams: [
      mkParam({
        name: "customerName",
        paramType: "prop",
        type: typeFactory.text(),
      }),
    ],
    queriesToCreateProps: [mock<ComponentDataQuery>({ name: "customerQuery" })],
    serverQueriesToCreateProps: [
      mock<ComponentServerQuery>({ name: "accountQuery" }),
    ],
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
  };
  const view = render(<ExtractComponentForm {...props} />);
  return { props, ...view };
}

it("retains form submission, keyboard input and linked prop descriptions without observable state", async () => {
  const f = fixture();
  expect(isAnyModalOpen()).toBe(true);
  const create = screen.getByRole<HTMLButtonElement>("button", {
    name: "Create component",
  });
  expect(create.disabled).toBe(true);
  const input = screen.getByPlaceholderText(
    "Enter the name of your new component",
  );
  expect(screen.getByText("customerName")).toBeTruthy();
  expect(screen.getByText("customerQuery")).toBeTruthy();
  expect(screen.getByText("accountQuery")).toBeTruthy();
  fireEvent.change(input, { target: { value: "CustomerCard" } });
  expect(create.disabled).toBe(false);
  fireEvent.click(create);
  await waitFor(() =>
    expect(f.props.onSubmit).toHaveBeenCalledWith({ name: "CustomerCard" }),
  );
  f.props.onSubmit.mockClear();
  fireEvent.change(input, { target: { value: "" } });
  expect(create.disabled).toBe(true);
  const form = input.closest("form");
  if (!form) {
    throw new Error("Missing extraction form");
  }
  fireEvent.submit(form);
  await waitFor(() => expect(f.props.onSubmit).not.toHaveBeenCalled());
  f.unmount();
  expect(isAnyModalOpen()).toBe(false);
});

it("preserves cancellation and the existing non-empty name acceptance rule", async () => {
  const f = fixture();
  const input = screen.getByPlaceholderText(
    "Enter the name of your new component",
  );
  fireEvent.change(input, { target: { value: " " } });
  fireEvent.click(screen.getByRole("button", { name: "Create component" }));
  await waitFor(() =>
    expect(f.props.onSubmit).toHaveBeenCalledWith({ name: " " }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(f.props.onCancel).toHaveBeenCalledOnce();
});
