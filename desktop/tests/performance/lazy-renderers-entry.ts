// The renderer implementations are requested only by an explicit first-use probe.
(window as any).__rendererFirstUse = () =>
  import("./lazy-renderers-probe").then((module) => module.createProbe());
