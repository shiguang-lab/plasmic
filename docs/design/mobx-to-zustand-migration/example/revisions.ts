/**
 * 文档模型修订索引（最小可编译实现，对应设计文档 5.2 / 5.3）。
 *
 * 设计前提：模型对象保持可变（不改编辑逻辑），只把「字段级自动追踪」
 * 换成「按实体/元素打脏键」。组件订阅键的版本号，而不是订阅字段。
 */
export type ModelKey = string;

const revisions = new Map<ModelKey, number>();
const listeners = new Map<ModelKey, Set<() => void>>();

export function getRevision(key: ModelKey): number {
  return revisions.get(key) ?? 0;
}

export function subscribeModelKeys(
  keys: readonly ModelKey[],
  listener: () => void,
): () => void {
  for (const key of keys) {
    let set = listeners.get(key);
    if (!set) {
      set = new Set();
      listeners.set(key, set);
    }
    set.add(listener);
  }
  return () => {
    for (const key of keys) {
      listeners.get(key)?.delete(listener);
    }
  };
}

/**
 * 事务结束时调用一次（由 studioCtx.change 的收尾处驱动）。
 * 同一批次内重复的键只推进一次，避免一次编辑触发多次重渲染。
 */
export function bumpModelKeys(keys: readonly ModelKey[]): void {
  for (const key of new Set(keys)) {
    revisions.set(key, getRevision(key) + 1);
    listeners.get(key)?.forEach((listener) => listener());
  }
}

/** 键的构造器，统一命名，避免各处手写字符串。 */
export const modelKeys = {
  site: "site",
  tpl: (uuid: string) => `tpl:${uuid}`,
  component: (uuid: string) => `component:${uuid}`,
} as const;
