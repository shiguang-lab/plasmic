import {
  createCopilotStore,
  useCopilotFeedback,
  useCopilotHistory,
} from "@/wab/client/studio-ctx/copilot-state";
import type {
  CopilotInteraction,
  StudioCtx,
} from "@/wab/client/studio-ctx/StudioCtx";
import type { CopilotInteractionId } from "@/wab/shared/ApiSchema";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

/**
 * Copilot history/feedback used to be two `observable.map`s on StudioCtx. The
 * hooks are keyed, so these tests pin the two things a keyed store read can get
 * wrong: a stable reference for missing keys, and per-key isolation.
 */

afterEach(cleanup);

function fakeStudio(): StudioCtx {
  return { copilotStore: createCopilotStore() } as unknown as StudioCtx;
}

function interaction(prompt: string): CopilotInteraction {
  return { prompt } as unknown as CopilotInteraction;
}

it("returns a stable empty array for a missing key", () => {
  const studio = fakeStudio();
  const seen: unknown[] = [];

  function Probe() {
    const history = useCopilotHistory(studio, "code");
    seen.push(history);
    return <output data-testid="count">{history.length}</output>;
  }

  const { rerender } = render(<Probe />);
  rerender(<Probe />);

  expect(seen.length).toBeGreaterThan(1);
  expect(seen[0]).toBe(seen[seen.length - 1]);
  expect(screen.getByTestId("count").textContent).toBe("0");
});

it("re-renders only the readers of the changed type", async () => {
  const studio = fakeStudio();
  let codeRenders = 0;
  let sqlRenders = 0;

  function Code() {
    const history = useCopilotHistory(studio, "code");
    codeRenders += 1;
    return <output data-testid="code">{history.length}</output>;
  }
  function Sql() {
    const history = useCopilotHistory(studio, "sql");
    sqlRenders += 1;
    return <output data-testid="sql">{history.length}</output>;
  }

  render(<Code />);
  render(<Sql />);
  const codeBefore = codeRenders;
  const sqlBefore = sqlRenders;

  await act(async () => {
    studio.copilotStore.setState((state) => ({
      history: { ...state.history, code: [interaction("a")] },
    }));
  });

  expect(screen.getByTestId("code").textContent).toBe("1");
  expect(screen.getByTestId("sql").textContent).toBe("0");
  expect(codeRenders - codeBefore).toBe(1);
  expect(sqlRenders).toBe(sqlBefore);
});

it("reads feedback per interaction id", () => {
  const studio = fakeStudio();
  const id = "i-1" as CopilotInteractionId;
  studio.copilotStore.setState({ feedback: { [id]: true } });

  function Probe({ interactionId }: { interactionId: CopilotInteractionId | undefined }) {
    const feedback = useCopilotFeedback(studio, interactionId);
    return <output data-testid="feedback">{String(feedback)}</output>;
  }

  const { rerender } = render(<Probe interactionId={id} />);
  expect(screen.getByTestId("feedback").textContent).toBe("true");

  rerender(<Probe interactionId={undefined} />);
  expect(screen.getByTestId("feedback").textContent).toBe("undefined");

  rerender(<Probe interactionId={"i-2" as CopilotInteractionId} />);
  expect(screen.getByTestId("feedback").textContent).toBe("undefined");
});
