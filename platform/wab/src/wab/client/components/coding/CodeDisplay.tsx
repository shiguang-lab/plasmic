import sty from "@/wab/client/components/coding/CodeDisplay.module.css";
import { useUiAppearance } from "@/wab/client/ui-theme";
import { cx } from "@/wab/shared/common";
import Highlight, { defaultProps, Language } from "prism-react-renderer";
import lightTheme from "prism-react-renderer/themes/github";
import darkTheme from "prism-react-renderer/themes/vsDark";
import React from "react";

export function CodeDisplay(props: {
  children: string;
  language: Language;
  className?: string;
  style?: React.CSSProperties;
}) {
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
        <pre
          className={`${className} ${sty.root} ${props.className}`}
          style={{ ...style, ...props.style }}
        >
          {tokens.map((line, i) => (
            <div {...getLineProps({ line, key: i })}>
              {line.map((token, key) => (
                <span {...getTokenProps({ token, key })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  );
}

export function CodeSnippet(props: React.ComponentProps<typeof CodeDisplay>) {
  return (
    <CodeDisplay {...props} className={cx(props.className, sty.snippet)} />
  );
}
