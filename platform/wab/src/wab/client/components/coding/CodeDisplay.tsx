import sty from "@/wab/client/components/coding/CodeDisplay.module.css";
import { Loadable } from "@/wab/client/components/widgets";
import { cx } from "@/wab/shared/common";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import type { Language } from "prism-react-renderer";
import * as React from "react";

export interface CodeDisplayProps {
  children: string;
  language: Language;
  className?: string;
  style?: React.CSSProperties;
}

const loadCodeDisplay = () =>
  import("./CodeDisplayContent").then((module) => module.CodeDisplayContent);

export function CodeDisplay(props: CodeDisplayProps) {
  return (
    <Loadable
      loader={loadCodeDisplay}
      contents={(Content) => <Content {...props} />}
      loadingContents={() => (
        <Scrollbar
          className={cx(sty.root, props.className)}
          style={props.style}
        >
          <pre aria-busy="true">{props.children.trim()}</pre>
        </Scrollbar>
      )}
    />
  );
}

export function CodeSnippet(props: CodeDisplayProps) {
  return (
    <CodeDisplay {...props} className={cx(props.className, sty.snippet)} />
  );
}
