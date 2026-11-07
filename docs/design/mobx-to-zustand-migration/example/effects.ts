import { useStudioShell } from "./studio-stores";

/**
 * 副作用编排（替代 StudioCtx 构造器里的 reaction/autorun）。
 * 由 Studio 初始化时统一 start，卸载时统一 dispose。
 */
export function startShellEffects(onRightTabChanged: (key: string | undefined) => void): () => void {
  return useStudioShell.subscribe(
    (state) => state.rightTabKey,
    (key) => onRightTabChanged(key),
    { fireImmediately: true },
  );
}
