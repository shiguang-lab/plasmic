import {
  promptComponentTemplate,
  promptPageTemplate,
} from "@/wab/client/prompts";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

vi.mock("@/wab/client/components/widgets/NewPageModal", () => ({
  default: ({
    onSubmit,
    onCancel,
  }: {
    onSubmit: (info: { type: "blank"; name: string }) => void;
    onCancel: () => void;
  }) => (
    <div>
      <button onClick={() => onSubmit({ type: "blank", name: "Customers" })}>
        Create page
      </button>
      <button onClick={onCancel}>Cancel page</button>
    </div>
  ),
}));
vi.mock("@/wab/client/components/widgets/NewComponentModal", () => ({
  default: ({
    onSubmit,
    onCancel,
  }: {
    onSubmit: (info: { name: string }) => void;
    onCancel: () => void;
  }) => (
    <div>
      <button onClick={() => onSubmit({ name: "CustomerCard" })}>
        Create component
      </button>
      <button onClick={onCancel}>Cancel component</button>
    </div>
  ),
}));

const cases = [
  {
    kind: "page",
    prompt: promptPageTemplate,
    result: { type: "blank", name: "Customers" },
  },
  {
    kind: "component",
    prompt: promptComponentTemplate,
    result: { name: "CustomerCard" },
  },
] as const;

it.each(cases)(
  "opens the real $kind modal and returns its submitted creation data",
  async ({ kind, prompt, result }) => {
    let answer: Promise<unknown> = Promise.resolve();
    await act(async () => {
      answer = prompt(mock<StudioCtx>());
    });
    const submit = await screen.findByRole("button", {
      name: `Create ${kind}`,
    });
    expect(submit.closest(".ant-modal")).not.toBeNull();
    await act(async () => fireEvent.click(submit));
    await expect(answer).resolves.toEqual(result);
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: `Create ${kind}` }),
      ).toBeNull(),
    );
  },
);

it.each(cases)(
  "opens and cancels the real $kind modal without returning creation data",
  async ({ kind, prompt }) => {
    let answer: Promise<unknown> = Promise.resolve();
    await act(async () => {
      answer = prompt(mock<StudioCtx>());
    });
    const cancel = await screen.findByRole("button", {
      name: `Cancel ${kind}`,
    });
    await act(async () => fireEvent.click(cancel));
    await expect(answer).resolves.toBeUndefined();
  },
);
