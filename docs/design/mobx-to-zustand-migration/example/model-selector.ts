import * as React from "react";
import { getRevision, subscribeModelKeys, type ModelKey } from "./revisions";

/**
 * 非 Hook 版本的按修订号记忆化（用于 store 层 / 命令式代码）。
 * 依赖键不变 => 返回同一个引用，下游不需要任何 equality 函数。
 */
export function createModelSelector<T>(
  keys: () => readonly ModelKey[],
  compute: () => T,
  equals: (a: T, b: T) => boolean = Object.is,
): () => T {
  let lastRev = "";
  let hasValue = false;
  let value!: T;
  return () => {
    const rev = keys().map(getRevision).join(".");
    if (!hasValue || rev !== lastRev) {
      const next = compute();
      if (!hasValue || !equals(value, next)) {
        value = next;
        hasValue = true;
      }
      lastRev = rev;
    }
    return value;
  };
}

/**
 * 组件侧：订阅一组模型的修订号，并按修订号记忆化计算结果。
 *
 * 这是替代 `observer` + `computedFn` 的最小组合：
 * - 订阅粒度：实体/元素级（不是整棵树）
 * - 返回值引用稳定：React 边界不需要 useShallow / 自定义 equality
 */
export function useModelSelector<T>(
  keys: readonly ModelKey[],
  compute: () => T,
  equals: (a: T, b: T) => boolean = Object.is,
): T {
  // keys 通常是行内数组（每次渲染都是新引用）；
  // 用内容做依赖，保证 subscribe / getSnapshot 的引用稳定。
  const keysJoined = keys.join("|");
  const subscribe = React.useCallback(
    (listener: () => void) =>
      subscribeModelKeys(keysJoined ? keysJoined.split("|") : [], listener),
    [keysJoined],
  );
  const getSnapshot = React.useCallback(
    () =>
      (keysJoined ? keysJoined.split("|") : [])
        .map((key) => getRevision(key))
        .join("."),
    [keysJoined],
  );

  const rev = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const ref = React.useRef<{ rev: string; value: T } | undefined>(undefined);
  if (!ref.current || ref.current.rev !== rev) {
    const next = compute();
    if (ref.current && equals(ref.current.value, next)) {
      // 值没变：只更新失效标记，保住引用
      ref.current.rev = rev;
    } else {
      ref.current = { rev, value: next };
    }
  }
  return ref.current.value;
}
