import { useModelSelector } from "@/wab/client/stores/model-revisions-react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { ModelRevisions } from "@/wab/shared/model-revisions";
import * as React from "react";

afterEach(() => { cleanup(); revisions.dispose(); });

it("does not render when the selected output is equal", () => {
  let name = "Same";
  const rendered = vi.fn();
  function Value() {
    const value = useModelSelector(revisions, ["component"], () => ({ name }), (a, b) => a.name === b.name);
    rendered();
    return <output>{value.name}</output>;
  }
  render(<Value />);
  const before = rendered.mock.calls.length;
  act(() => { revisions.markModelKeysDirty(["component"]); revisions.flushModelRevisions(); });
  expect(rendered).toHaveBeenCalledTimes(before);
  act(() => { name = "Changed"; revisions.markModelKeysDirty(["component"]); revisions.flushModelRevisions(); });
  expect(screen.getByRole("status").textContent).toBe("Changed");
});

it("recomputes when props or selected keys change at the same revision", () => {
  function Value({ id, label }: { id: string; label: string }) {
    const value = useModelSelector(revisions, [id], () => label);
    return <output>{value}</output>;
  }
  const { rerender } = render(<Value id="first" label="A" />);
  expect(screen.getByRole("status").textContent).toBe("A");
  rerender(<Value id="second" label="B" />);
  expect(screen.getByRole("status").textContent).toBe("B");
  rerender(<Value id="second" label="C" />);
  expect(screen.getByRole("status").textContent).toBe("C");
});

it("recomputes after a subscribed model changes", () => {
  let label = "A";
  function Value() {
    const value = useModelSelector(revisions, ["selected"], () => label);
    return <output>{value}</output>;
  }
  render(<Value />);
  act(() => { label = "B"; revisions.markModelKeysDirty(["selected"]); revisions.flushModelRevisions(); });
  expect(screen.getByRole("status").textContent).toBe("B");
});

it("switches the selected model at the same revision and disconnects the old selection", () => {
  const labels = new Map([["first", "First"], ["second", "Second"]]);
  const read = vi.fn((id: string) => labels.get(id));
  function Selection({ id }: { id: string }) {
    const value = useModelSelector(revisions, [id], () => read(id));
    return <output>{value}</output>;
  }

  const { rerender, unmount } = render(<Selection id="first" />);
  expect(screen.getByRole("status").textContent).toBe("First");
  rerender(<Selection id="second" />);
  expect(screen.getByRole("status").textContent).toBe("Second");
  read.mockClear();

  act(() => {
    labels.set("first", "Retired edit");
    revisions.markModelKeysDirty(["first"]);
    revisions.flushModelRevisions();
  });
  expect(read).not.toHaveBeenCalled();
  expect(screen.getByRole("status").textContent).toBe("Second");

  act(() => {
    labels.set("second", "Current edit");
    revisions.markModelKeysDirty(["second"]);
    revisions.flushModelRevisions();
  });
  expect(screen.getByRole("status").textContent).toBe("Current edit");
  expect(read).toHaveBeenCalledWith("second");

  unmount();
  read.mockClear();
  act(() => {
    revisions.markModelKeysDirty(["first", "second"]);
    revisions.flushModelRevisions();
  });
  expect(read).not.toHaveBeenCalled();
});

it("updates after a model changes between rendering and subscription", () => {
  let label = "Before commit";
  function Selection() {
    const value = useModelSelector(revisions, ["selected"], () => label);
    return <output>{value}</output>;
  }
  function Commit() {
    React.useLayoutEffect(() => {
      label = "Committed value";
      revisions.markModelKeysDirty(["selected"]);
      revisions.flushModelRevisions();
    }, []);
    return <Selection />;
  }

  render(<Commit />);
  expect(screen.getByRole("status").textContent).toBe("Committed value");
});

let revisions = new ModelRevisions();
beforeEach(() => { revisions = new ModelRevisions(); });
