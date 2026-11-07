import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type LeftPanel = "outline" | "pages";

interface ShellState {
  leftPanel: LeftPanel | undefined;
  rightTabKey: string | undefined;
  setLeftPanel: (value: LeftPanel | undefined) => void;
  setRightTabKey: (value: string | undefined) => void;
}

/**
 * 全局单例 store。
 *
 * 注意两点：
 * 1. `subscribeWithSelector` 让命令式代码可以按 selector 订阅（替代 reaction）。
 * 2. setter 内先判等再 set（替代 observable.box 的 `{ equals }` 通知抑制）。
 */
export const useStudioShell = create<ShellState>()(
  subscribeWithSelector((set, get) => ({
    leftPanel: undefined,
    rightTabKey: undefined,
    setLeftPanel: (value) => {
      if (get().leftPanel === value) {
        return; // 值没变：不通知
      }
      set({ leftPanel: value });
    },
    setRightTabKey: (value) => {
      if (get().rightTabKey === value) {
        return;
      }
      set({ rightTabKey: value });
    },
  })),
);
