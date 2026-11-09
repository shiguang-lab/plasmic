import {
  Button,
  Column,
  Container,
  Heading,
  Hr,
  Img,
  Link,
  Markdown,
  Row,
  Section,
  Text,
  type LinkProps,
  type MarkdownProps,
} from "@react-email/components";
import React from "react";

const COMMON_STYLES = {
  boxSizing: "border-box",
};

function applyCommonStyles({ style, ...rest }: any) {
  return {
    style: {
      ...(style ?? {}),
      ...COMMON_STYLES,
    },
    ...rest,
  };
}

export function EmailButton(props: React.ComponentProps<typeof Button>) {
  return <Button {...applyCommonStyles(props)} />;
}
export function EmailContainer(props: React.ComponentProps<typeof Container>) {
  return <Container {...applyCommonStyles(props)} />;
}
export function EmailText(props: React.ComponentProps<typeof Text>) {
  return <Text {...applyCommonStyles(props)} />;
}
export function EmailImage(props: React.ComponentProps<typeof Img>) {
  return <Img {...applyCommonStyles(props)} />;
}
export function EmailHr(props: React.ComponentProps<typeof Hr>) {
  return <Hr {...applyCommonStyles(props)} />;
}
export function EmailHeading(props: React.ComponentProps<typeof Heading>) {
  return <Heading {...applyCommonStyles(props)} />;
}
export function EmailRow(props: React.ComponentProps<typeof Row>) {
  return <Row {...applyCommonStyles(props)} />;
}
export function EmailColumn(props: React.ComponentProps<typeof Column>) {
  return <Column {...applyCommonStyles(props)} />;
}
export function EmailSection(props: React.ComponentProps<typeof Section>) {
  return <Section {...applyCommonStyles(props)} />;
}

export const EmailMarkdown = ({ children, ...props }: MarkdownProps) => {
  return <Markdown {...applyCommonStyles(props)}>{children ?? ""}</Markdown>;
};

export const EmailLink = (
  props: LinkProps & {
    type: "text" | "image";
    text?: string;
    image?: React.ReactNode;
  },
) => {
  const children = props.type === "image" ? props.image : props.text;
  // eslint-disable-next-line react/forbid-elements
  return <Link {...applyCommonStyles(props)}>{children}</Link>;
};
