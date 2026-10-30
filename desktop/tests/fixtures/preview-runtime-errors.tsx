import React from "react";
import { createRoot } from "react-dom/client";
import { createRenderer } from "../../../platform/live-frame/src/render";
import { installErrorHandlers } from "../../../platform/live-frame/src/diagnostics";

const root = createRoot(document.getElementById("error-region")!);
const renderer = createRenderer({ React, hostUtils: {
  setPlasmicRootNode: (node: React.ReactNode) => root.render(node),
  registerRenderErrorListener: () => () => {},
} });
(window as any).__plasmicLive = renderer;
installErrorHandlers(window, renderer.reportError);

function App() {
  const [broken, setBroken] = React.useState(false);
  const [visible, setVisible] = React.useState(true);
  return <div>
    <button onClick={() => setBroken(true)}>Render failure</button>
    <button onClick={() => setBroken(false)}>Recover data</button>
    <button onClick={() => setVisible(false)}>Hide records</button>
    <button onClick={() => { void Promise.reject(new Error("async request failed")); }}>Async failure</button>
    {renderer.renderBoundary(() => {
      if (!visible) { return null; }
      const rows = broken ? null : ["Record"];
      return <div>{rows!.map((row) => <span key={row}>{row}</span>)}</div>;
    }, { componentUuid: "page", elementUuid: "records", nodeName: "Records" })}
  </div>;
}

(window as any).resetPreview = async (fatal = false) => {
  renderer.beginRender("page");
  function BrokenPage() { throw new Error("page initialization failed"); }
  await renderer.renderRoot(fatal ? <BrokenPage /> : <App />);
};
void (window as any).resetPreview();
