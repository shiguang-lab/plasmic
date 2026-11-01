import { AntdConfigProvider } from "@/wab/client/antd-theme";
import {
  CodeDisplay,
  CodeSnippet,
} from "@/wab/client/components/coding/CodeDisplay";
import { AiMarkdown } from "@/wab/client/components/copilot/AiMarkdown";
import type { AiNode } from "@/wab/client/components/copilot/AiNodeReference";
import { getUiAppearance, setUiAppearance } from "@/wab/client/ui-theme";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import * as React from "react";
import { createRoot } from "react-dom/client";

export function createProbe() {
  const host = document.createElement("div");
  host.dataset.rendererProbe = "true";
  Object.assign(host.style, {
    position: "fixed",
    inset: "20px",
    zIndex: "100000",
    background: "var(--token-color-bg-container)",
    display: "flex",
    flexDirection: "column",
  });
  document.body.appendChild(host);
  const root = createRoot(host);
  const appearance = getUiAppearance();
  const located: AiNode[] = [];
  return {
    located,
    theme: setUiAppearance,
    render({
      markdown,
      code,
      running = false,
      snippet = false,
    }: {
      markdown?: string;
      code?: string;
      running?: boolean;
      snippet?: boolean;
    }) {
      root.render(
        <AntdConfigProvider productUI>
          <Scrollbar style={{ height: "100%", minHeight: 0 }}>
            {markdown !== undefined && (
              <AiMarkdown
                running={running}
                nodes={[
                  {
                    uuid: "probe-node",
                    name: "StatusFilter",
                    page: null,
                    branch: null,
                  },
                ]}
                onLocate={(node) => located.push(node)}
              >
                {markdown}
              </AiMarkdown>
            )}
            {code !== undefined && (
              <div data-probe-code="true">
                {snippet ? (
                  <CodeSnippet language="tsx">{code}</CodeSnippet>
                ) : (
                  <CodeDisplay language="tsx">{code}</CodeDisplay>
                )}
              </div>
            )}
          </Scrollbar>
        </AntdConfigProvider>,
      );
    },
    close() {
      root.unmount();
      host.remove();
      setUiAppearance(appearance);
    },
  };
}
