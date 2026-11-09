import {
  createPageSettingsStore,
  usePageSettingsDialog,
} from "@/wab/client/studio-ctx/page-settings-state";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { PageComponent } from "@/wab/shared/core/components";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

/**
 * `pageSettingsOpen` / `pageSettingsPage` were two `observable.box` fields read
 * by the canvas dialog. They are now one store.
 */

afterEach(cleanup);

function page(name: string): PageComponent {
  return { name } as unknown as PageComponent;
}

function fakeStudio(): StudioCtx {
  return { pageSettingsStore: createPageSettingsStore() } as unknown as StudioCtx;
}

it("opens the dialog for the requested page", () => {
  const studio = fakeStudio();
  studio.pageSettingsStore.setState({ open: true, page: page("Home") });

  function Dialog() {
    const { open, page: target } = usePageSettingsDialog(studio);
    return (
      <output data-testid="dialog">
        {open ? `open:${target?.name}` : "closed"}
      </output>
    );
  }

  render(<Dialog />);

  expect(screen.getByTestId("dialog").textContent).toBe("open:Home");
});

it("re-renders when the dialog opens and closes", async () => {
  const studio = fakeStudio();
  let renders = 0;

  function Dialog() {
    const { open } = usePageSettingsDialog(studio);
    renders += 1;
    return <output data-testid="dialog">{open ? "open" : "closed"}</output>;
  }

  render(<Dialog />);
  expect(screen.getByTestId("dialog").textContent).toBe("closed");
  const before = renders;

  await act(async () => {
    studio.pageSettingsStore.setState({ open: true, page: page("Home") });
  });
  expect(screen.getByTestId("dialog").textContent).toBe("open");
  expect(renders - before).toBe(1);

  await act(async () => {
    studio.pageSettingsStore.setState({ open: false });
  });
  expect(screen.getByTestId("dialog").textContent).toBe("closed");
  expect(renders - before).toBe(2);
});

it("does not re-render when the snapshot is shallow-equal", async () => {
  const studio = fakeStudio();
  let renders = 0;

  function Dialog() {
    const { open } = usePageSettingsDialog(studio);
    renders += 1;
    return <output data-testid="dialog">{open ? "open" : "closed"}</output>;
  }

  render(<Dialog />);
  const before = renders;

  await act(async () => {
    // Same values, new object: `useShallow` keeps the snapshot stable.
    studio.pageSettingsStore.setState({ open: false, page: undefined });
  });

  expect(renders).toBe(before);
});
