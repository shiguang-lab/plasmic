import { useArenaStatus, useStudioArena, subscribeStudioArena } from "@/wab/client/studio-ctx/arena-state";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import { mkMixedArena } from "@/wab/shared/Arenas";
import { createSite } from "@/wab/shared/core/sites";
import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";

const owners: StudioArenaState[] = [];
afterEach(() => { cleanup(); owners.splice(0).forEach((owner) => owner.dispose()); });

function fixture() {
  const site = createSite();
  const first = mkMixedArena("First");
  const second = mkMixedArena("Second");
  site.arenas.push(first, second);
  const modelSnapshots = new ModelSnapshots();
  const arenaState = new StudioArenaState({ site, modelSnapshots });
  owners.push(arenaState);
  return { studio: { arenaState }, arenaState, site, modelSnapshots, first, second };
}

it("selects exact committed arena fields, detaches old owners and ignores unrelated history changes", () => {
  const first = fixture();
  const second = fixture();
  const commits = vi.fn();
  function Name({ studio }: { studio: typeof first.studio }) {
    return <span>{useStudioArena(studio, (state) => state.name)}</span>;
  }
  const view = render(<React.Profiler id="name" onRender={commits}><Name studio={first.studio} /></React.Profiler>);
  act(() => first.arenaState.setCurrent(first.first));
  expect(screen.getByText("First")).toBeTruthy();
  const count = commits.mock.calls.length;
  act(() => {
    first.arenaState.setRecent([first.second, first.first]);
    first.arenaState.setCurrent(first.first);
  });
  expect(commits).toHaveBeenCalledTimes(count);
  view.rerender(<React.Profiler id="name" onRender={commits}><Name studio={second.studio} /></React.Profiler>);
  const switched = commits.mock.calls.length;
  act(() => first.arenaState.setCurrent(first.second));
  expect(commits).toHaveBeenCalledTimes(switched);
  act(() => second.arenaState.setCurrent(second.second));
  expect(screen.getByText("Second")).toBeTruthy();
});

it("subscribes per arena and keeps retired status readable through model disposal", () => {
  const { studio, arenaState, modelSnapshots, first, second } = fixture();
  const firstCommits = vi.fn();
  const secondCommits = vi.fn();
  function Status({ arena }: { arena: typeof first }) {
    return <span data-testid={arena.name}>{useArenaStatus(studio, arena)}</span>;
  }
  render(<>
    <React.Profiler id="first" onRender={firstCommits}><Status arena={first} /></React.Profiler>
    <React.Profiler id="second" onRender={secondCommits}><Status arena={second} /></React.Profiler>
  </>);
  act(() => arenaState.setCurrent(first));
  expect(screen.getByTestId("First").textContent).toBe("visible");
  const count = firstCommits.mock.calls.length;
  act(() => arenaState.ensureBackground(second, 1));
  expect(firstCommits).toHaveBeenCalledTimes(count);
  expect(screen.getByTestId("Second").textContent).toBe("background");
  const retired = arenaState.statusStore(first);
  act(() => arenaState.reset());
  modelSnapshots.dispose();
  expect(retired.getState()).toBe("dead");
  expect(arenaState.statusStore(first)).toBe(retired);
  expect(screen.getByTestId("First").textContent).toBe("dead");
  const notified = vi.fn();
  const stop = retired.subscribe(notified);
  expect(notified).not.toHaveBeenCalled();
  stop();
});

it("notifies selector subscribers after every prepared output is installed and stops after disposal", () => {
  const { studio, arenaState, first, second } = fixture();
  const values: string[] = [];
  const stop = subscribeStudioArena(studio, (state) => state.name, (next, previous) => {
    expect(arenaState.statusStore(first).getState()).toBe(next === "First" ? "visible" : "dead");
    expect(arenaState.statusStore(second).getState()).toBe(next === "Second" ? "visible" : "dead");
    values.push(`${previous}->${next}`);
  });
  arenaState.deferPublication(() => {
    arenaState.setCurrent(first);
    arenaState.setCurrent(second);
  });
  expect(values).toEqual(["->Second"]);
  stop();
  arenaState.setCurrent(first);
  expect(values).toHaveLength(1);
  arenaState.dispose();
  const disposed = vi.fn();
  const unsubscribe = subscribeStudioArena(studio, (state) => state.name, disposed);
  expect(disposed).not.toHaveBeenCalled();
  unsubscribe();
});
