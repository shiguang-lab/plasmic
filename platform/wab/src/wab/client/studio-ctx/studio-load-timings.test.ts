import { StudioLoadTimings } from "@/wab/client/studio-ctx/studio-load-timings";

afterEach(() => vi.restoreAllMocks());

it("records relative stage and frame timings once, excludes later arenas, and returns detached snapshots", () => {
  let now = 100;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const timings = new StudioLoadTimings();
  timings.setInitialFrames(["target"]);
  const fetchDone = timings.begin("project-fetch");
  now = 250;
  fetchDone();
  now = 300;
  fetchDone();
  const frameDone = timings.begin("frame-runtime", "target");
  now = 350;
  frameDone();
  timings.mark("frame-rendered", "other-arena");
  const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
  timings.report("canvas-revealed");
  timings.report("canvas-revealed");
  expect(log).toHaveBeenCalledTimes(1);
  expect(timings.snapshot()).toEqual({
    elapsedMs: 250,
    frameCount: 1,
    entries: [
      {
        phase: "project-fetch",
        frameUuid: undefined,
        startMs: 0,
        durationMs: 150,
      },
      {
        phase: "frame-runtime",
        frameUuid: "target",
        startMs: 200,
        durationMs: 50,
      },
      {
        phase: "canvas-revealed",
        frameUuid: undefined,
        startMs: 250,
        durationMs: 0,
      },
    ],
  });
  const snapshot = timings.snapshot();
  snapshot.entries[0].durationMs = -1;
  expect(timings.snapshot().entries[0].durationMs).toBe(150);
});
