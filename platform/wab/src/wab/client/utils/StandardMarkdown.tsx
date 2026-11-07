import { UserMentionDisplay } from "@/wab/client/components/user-mentions/UserMentionDisplay";
import { MENTION_EMAIL_REGEX } from "@/wab/shared/comments-utils";
import React, { ComponentProps } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

export function StandardMarkdown(props: ComponentProps<typeof ReactMarkdown> & { className?: string }) {
  const { className = "markdown-body", ...markdownProps } = props;
  const processedChildren =
    typeof props.children === "string"
      ? processUserMentions(props.children)
      : props.children;

  function processUserMentions(content: string) {
    return content.replace(MENTION_EMAIL_REGEX, (_match, email) => {
      return `<mention:${email}>`;
    });
  }

  return (
    <div className={className}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      urlTransform={(url) => url.startsWith("mention:") ? url : defaultUrlTransform(url)}
      components={{
        a: ({ href, children, node, ...restProps }) => {
          const defaultLinkNode = (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              {...restProps}
            >
              {children}
            </a>
          );

          const hrefProperty =
            node?.properties?.href?.toString() || "";
          if (hrefProperty.startsWith("mention:")) {
            return (
              <UserMentionDisplay
                email={hrefProperty.slice(8)}
                defaultEmailDisplay={defaultLinkNode}
              />
            );
          }

          return defaultLinkNode;
        },
      }}
      {...markdownProps}
      children={processedChildren}
    />
    </div>
  );
}
