// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { usePlasmicDataMutationOp } from "./usePlasmicDataOp";

const state = vi.hoisted(() => ({ context: { userAuthToken: "same-token", user: { id: "first" } }, execute: vi.fn(async () => ({})) }));
vi.mock("@plasmicapp/data-sources-context", () => ({ usePlasmicDataSourceContext: () => state.context }));
vi.mock("../executor", () => ({ executePlasmicDataOp: state.execute }));
afterEach(cleanup);

it("executes mutations with the new user even when the authentication token stays unchanged", async () => {
  const operation = { sourceId: "source", opId: "update", userArgs: {} };
  const view = renderHook(() => usePlasmicDataMutationOp(operation));
  await view.result.current();
  expect(state.execute.mock.calls.at(-1)?.[1]).toMatchObject({ user: { id: "first" } });
  state.context = { ...state.context, user: { id: "second" } };
  view.rerender();
  await view.result.current();
  expect(state.execute.mock.calls.at(-1)?.[1]).toMatchObject({ user: { id: "second" } });
});
