import type { CodeDisplayProps } from "@/wab/client/components/coding/CodeDisplay";
import sty from "@/wab/client/components/coding/CodeDisplay.module.css";
import { useUiAppearance } from "@/wab/client/ui-theme";
import { cx } from "@/wab/shared/common";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import Highlight, { defaultProps } from "prism-react-renderer";
import lightTheme from "prism-react-renderer/themes/github";
import darkTheme from "prism-react-renderer/themes/vsDark";
import React from "react";

export function CodeDisplayContent(props: CodeDisplayProps) {
  "use memo";
  const { children, language } = props;
  const { appearance } = useUiAppearance();
  return (
    <Highlight
      {...defaultProps}
      code={children.trim()}
      language={language}
      theme={appearance === "dark" ? darkTheme : lightTheme}
    >
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <Scrollbar
          className={cx(sty.root, props.className)}
          style={{ ...style, ...props.style }}
        >
          <pre className={className} style={style}>
            {tokens.map((line, i) => {
              const { key: lineKey, ...lineProps } = getLineProps({ line, key: i });
              return <div key={lineKey} {...lineProps}>
                {line.map((token, key) => {
                  const { key: tokenKey, ...tokenProps } = getTokenProps({ token, key });
                  return <span key={tokenKey} {...tokenProps} />;
                })}
              </div>;
            })}
          </pre>
        </Scrollbar>
      )}
    </Highlight>
  );
}
