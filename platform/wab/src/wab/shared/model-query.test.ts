import { memoizeModelQuery } from "@/wab/shared/model-query";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { mkRuleSet } from "@/wab/shared/core/styles";
import { ColumnsConfig } from "@/wab/shared/model/classes";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { shallow } from "zustand/shallow";
import { err } from "neverthrow";

it("caches recorded models between writes and reads current writes before the command commits", () => {
  const rs = mkRuleSet({values: {color: "red"}}), recorder = new ChangeRecorder({inst: rs, _instUtil: instUtil});
  const read = vi.fn(() => ({color: rs.values.color})), query = memoizeModelQuery((_rs: typeof rs) => read());
  try {
    const before = query(rs); expect(query(rs)).toBe(before); expect(read).toHaveBeenCalledOnce();
    recorder.withRecording(() => {
      rs.values.color = "blue";
      expect(query(rs)).toEqual({color: "blue"}); expect(query(rs)).not.toBe(before);
    });
    expect(read).toHaveBeenCalledTimes(2);
  } finally {recorder.dispose();}
});
it("preserves equal results without suppressing real dictionary additions, deletions and rollback", () => {
  const rs = mkRuleSet({values: {color: "red"}}), recorder = new ChangeRecorder({inst: rs, _instUtil: instUtil});
  const query = memoizeModelQuery((_rs: typeof rs) => ({color: rs.values.color}), {equals: shallow});
  try {
    const before = query(rs);
    recorder.withRecording(() => {rs.values.opacity = "0.5";}); expect(query(rs)).toBe(before);
    const failed = recorder.withRecording<string>(() => {rs.values.color = "blue"; expect(query(rs).color).toBe("blue"); return err("cancel");});
    expect(failed.isErr()).toBe(true); expect(query(rs).color).toBe("red");
    recorder.withRecording(() => {delete rs.values.color;}); expect(query(rs).color).toBeUndefined();
  } finally {recorder.dispose();}
});
it("does not cache unrecorded mutable arguments", () => {
  const value = {number: 1}, query = memoizeModelQuery((input: typeof value) => input.number);
  expect(query(value)).toBe(1); value.number = 2; expect(query(value)).toBe(2);
});
it("records splice, index replacement and length truncation with rollback", () => {
  const config = new ColumnsConfig({colsSizes: [1, 2, 3], breakUpRows: false});
  const recorder = new ChangeRecorder({inst: config, _instUtil: instUtil});
  try {
    const changes = recorder.withRecording(() => {config.colsSizes.push(4); config.colsSizes[0] = 6; config.colsSizes.length = 2;});
    expect(config.colsSizes).toEqual([6, 2]);
    expect(changes.changes.map(change => change.type)).toEqual(["array-splice", "array-update", "array-splice"]);
    expect(() => recorder.withRecording(() => {config.colsSizes.unshift(7); config.colsSizes.reverse(); throw new Error("cancel");})).toThrow("cancel");
    expect(config.colsSizes).toEqual([6, 2]);
    recorder.dispose(); const listener = vi.fn(); recorder.setExtraListener(listener); config.colsSizes.push(3); expect(listener).not.toHaveBeenCalled();
  } finally {recorder.dispose();}
});

it("copies each raw container assignment independently and preserves explicit recorded-container identity", () => {
  const raw = [1, 2], first = new ColumnsConfig({colsSizes: raw, breakUpRows: false}), second = new ColumnsConfig({colsSizes: raw, breakUpRows: false});
  const a = new ChangeRecorder({inst: first, _instUtil: instUtil}), b = new ChangeRecorder({inst: second, _instUtil: instUtil});
  try {
    expect(first.colsSizes).not.toBe(second.colsSizes);
    a.withRecording(() => {first.colsSizes.push(3);}); expect(second.colsSizes).toEqual([1, 2]); expect(raw).toEqual([1, 2]);
    a.withRecording(() => {first.colsSizes = raw;}); expect(first.colsSizes).toEqual([1, 2]);
    a.withRecording(() => {first.colsSizes = second.colsSizes;}); expect(first.colsSizes).toBe(second.colsSizes);
  } finally {a.dispose(); b.dispose();}
});
