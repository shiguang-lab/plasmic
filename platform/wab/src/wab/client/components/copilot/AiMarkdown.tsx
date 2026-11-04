import type { AiMarkdownProps } from "@/wab/client/components/copilot/AiMarkdownContent";
import { Loadable } from "@/wab/client/components/widgets";
import React from "react";

let Content: React.ComponentType<AiMarkdownProps> | undefined;
let pending: Promise<React.ComponentType<AiMarkdownProps>> | undefined;

export function preloadAiMarkdown() {
  return (pending ??= import("./AiMarkdownContent")
    .then((module) => {
      Content = module.AiMarkdown;
      return Content;
    })
    .catch((error) => {
      pending = undefined;
      throw error;
    }));
}

export function AiMarkdown(props: AiMarkdownProps) {
  const [ReadyContent] = React.useState(() => Content);
  if (ReadyContent) {
    return <ReadyContent {...props} />;
  }
  return (
    <Loadable
      loader={preloadAiMarkdown}
      contents={(Loaded) => <Loaded {...props} />}
      loadingContents={() => (
        <div aria-busy="true" style={{ whiteSpace: "pre-wrap" }}>
          {props.children}
        </div>
      )}
    />
  );
}
