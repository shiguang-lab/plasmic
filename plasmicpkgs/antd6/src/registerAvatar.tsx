import { Avatar } from "antd";
import React from "react";
import { Registerable, registerComponentHelper } from "./utils";

// letters is the editable text children; navigation composes a link around the Avatar.
export function AntdAvatar({
  letters,
  ...props
}: React.ComponentProps<typeof Avatar> & { letters?: string }) {
  return (
    <Avatar
      {...props}
      children={props.children === undefined ? letters : props.children}
    />
  );
}

export function AntdAvatarGroup(
  props: React.ComponentProps<typeof Avatar.Group>,
) {
  return <Avatar.Group {...props} />;
}

export function registerAvatar(loader?: Registerable) {
  registerComponentHelper(loader, AntdAvatar, {
    name: "plasmic-antd6-avatar",
    displayName: "Avatar",
    props: {
      icon: { type: "slot", hidePlaceholder: true },
      letters: {
        type: "string",
        description: "Letters to show",
        defaultValue: "AB",
      },
      src: {
        type: "imageUrl",
        description: "Image to display",
      },
      alt: {
        type: "string",
        description: "Alternative text for the avatar image",
      },
      size: {
        type: "choice",
        options: (ps: React.ComponentProps<typeof Avatar>) => [
          "small",
          "medium",
          "large",
          ...(typeof ps.size === "number" ? [ps.size] : []),
        ],
        description: "Set the size of avatar",
        defaultValueHint: "medium",
      },
      shape: {
        type: "choice",
        options: ["circle", "square"],
        description: "Set the avatar shape",
        defaultValueHint: "circle",
      },
      onClick: {
        type: "eventHandler",
        argTypes: [],
        description:
          "Native Avatar onClick. For a link, place the Avatar inside a link element instead.",
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerAvatar",
    importName: "AntdAvatar",
  });
}

export function registerAvatarGroup(loader?: Registerable) {
  registerComponentHelper(loader, AntdAvatarGroup, {
    name: "plasmic-antd6-avatar-group",
    displayName: "AvatarGroup",
    props: {
      children: {
        type: "slot",
        defaultValue: [1, 2, 3, 4].map((user) => ({
          type: "component" as const,
          name: "plasmic-antd6-tooltip",
          props: {
            titleText: "User " + user,
            children: {
              type: "component" as const,
              name: "plasmic-antd6-avatar",
              props: {
                letters: `U${user}`,
              },
            },
          },
        })),
      },
      max: { type: "object" },
      size: {
        type: "choice",
        options: ["small", "medium", "large"],
        description: "Default size of avatars",
        defaultValueHint: "medium",
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerAvatar",
    importName: "AntdAvatarGroup",
  });
}
