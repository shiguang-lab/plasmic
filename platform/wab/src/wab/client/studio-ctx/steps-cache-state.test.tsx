import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  createStepsCacheStore,
  saveStepsCacheValue,
  useCachedStepValue,
  useHasCachedStepValue,
  useStepCacheVersion,
} from "@/wab/client/studio-ctx/steps-cache-state";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

/**
 * `$stepsCache` was an `observable.map`. Keyed reads must be reactive, and the
 * coarse version hook must cover call sites that look values up per row.
 */

afterEach(cleanup);

function fakeStudio(): StudioCtx {
  return { stepsCacheStore: createStepsCacheStore() } as unknown as StudioCtx;
}

it("reports whether a step has been played", async () => {
  const studio = fakeStudio();

  function Row({ uuid }: { uuid: string }) {
    const played = useHasCachedStepValue(studio, uuid);
    return <output data-testid="played">{played ? "played" : "notPlayed"}</output>;
  }

  render(<Row uuid="i-1" />);
  expect(screen.getByTestId("played").textContent).toBe("notPlayed");

  await act(async () => {
    saveStepsCacheValue(studio, "i-1", 42);
  });
  expect(screen.getByTestId("played").textContent).toBe("played");
});

it("exposes the latest value and ignores other keys", async () => {
  const studio = fakeStudio();
  let renders = 0;

  function Value() {
    const value = useCachedStepValue(studio, "i-1");
    renders += 1;
    return <output data-testid="value">{String(value)}</output>;
  }

  render(<Value />);
  const before = renders;

  await act(async () => {
    saveStepsCacheValue(studio, "i-2", "other");
  });
  expect(renders).toBe(before);

  await act(async () => {
    saveStepsCacheValue(studio, "i-1", "first");
  });
  expect(screen.getByTestId("value").textContent).toBe("first");
  expect(renders - before).toBe(1);

  await act(async () => {
    saveStepsCacheValue(studio, "i-1", "second");
  });
  expect(screen.getByTestId("value").textContent).toBe("second");
});

it("bumps a coarse version for per-row lookups", async () => {
  const studio = fakeStudio();
  let renders = 0;

  function Column() {
    const version = useStepCacheVersion(studio);
    renders += 1;
    return <output data-testid="version">{version}</output>;
  }

  render(<Column />);
  expect(screen.getByTestId("version").textContent).toBe("0");
  const before = renders;

  await act(async () => {
    saveStepsCacheValue(studio, "i-1", "value");
  });

  expect(screen.getByTestId("version").textContent).toBe("1");
  expect(renders - before).toBe(1);
});

it("falls back to version 0 without a Studio", () => {
  function Column() {
    const version = useStepCacheVersion(undefined);
    return <output data-testid="version">{version}</output>;
  }

  render(<Column />);

  expect(screen.getByTestId("version").textContent).toBe("0");
});
