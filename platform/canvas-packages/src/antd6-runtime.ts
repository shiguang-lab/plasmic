import {
  nativeAntd6,
  nativeAntd6EnUS,
  nativeAntd6ZhCN,
} from "@shiguang-lab/plasmic-antd6/native";

// Custom hosts without the native library receive their own frame-local runtime.
(window as any).__CanvasPkgs.Antd6 = {
  ...nativeAntd6,
  localeZhCN: nativeAntd6ZhCN,
  localeEnUS: nativeAntd6EnUS,
};
