import { CanvasClickTracker } from "@/wab/client/components/canvas/canvas-clicks";
import { describe, expect, it } from "vitest";

const point = {
  button: 0, screenX: 100, screenY: 200,
  metaKey: false, ctrlKey: false, altKey: false, shiftKey: false,
};

describe("CanvasClickTracker", () => {
  it("drills down on clicks 2, 4 and 6 without native dblclick events", () => {
    const tracker = new CanvasClickTracker();
    const frame = {};
    const results = Array.from({ length: 6 }, (_, index) => {
      tracker.start(point, frame, index * 80);
      return tracker.finish(point, index * 80 + 20);
    });
    expect(results).toEqual([false, true, false, true, false, true]);
  });

  it.each(["timeout", "position", "frame", "drag", "cancel", "hold"])(
    "starts a new pair after %s",
    (reason) => {
      const tracker = new CanvasClickTracker();
      const frame = {};
      tracker.start(point, frame, 0);
      expect(tracker.finish(point, 20)).toBe(false);
      const next = reason === "position" ? { ...point, screenX: 110 } : point;
      let time = reason === "timeout" ? 600 : 80;
      if (reason === "cancel") {
        tracker.reset();
      }
      if (reason === "drag") {
        tracker.start(point, frame, 40);
        tracker.move({ ...point, screenX: 110 });
        expect(tracker.finish(point, 60)).toBe(false);
      }
      if (reason === "hold") {
        tracker.start(point, frame, 40);
        expect(tracker.finish(point, 600)).toBe(false);
        time = 680;
      }
      const context = reason === "frame" ? {} : frame;
      tracker.start(next, context, time);
      expect(tracker.finish(next, time + 20)).toBe(false);
      tracker.start(next, context, time + 80);
      expect(tracker.finish(next, time + 100)).toBe(true);
    },
  );

  it.each(["metaKey", "ctrlKey", "altKey", "shiftKey"] as const)(
    "keeps %s selection out of the drill-down sequence",
    (modifier) => {
      const tracker = new CanvasClickTracker();
      const frame = {};
      tracker.start(point, frame, 0);
      tracker.finish(point, 20);
      const modified = { ...point, [modifier]: true };
      tracker.start(modified, frame, 80);
      expect(tracker.finish(modified, 100)).toBe(false);
      tracker.start(point, frame, 160);
      expect(tracker.finish(point, 180)).toBe(false);
    },
  );

  it("does not count a release without an eligible press", () => {
    const tracker = new CanvasClickTracker();
    const frame = {};
    tracker.start(point, frame, 0);
    tracker.finish(point, 20);
    expect(tracker.finish(point, 80)).toBe(false);
    tracker.start(point, frame, 160);
    expect(tracker.finish(point, 180)).toBe(false);
  });
});
