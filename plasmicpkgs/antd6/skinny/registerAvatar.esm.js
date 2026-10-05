import { usePlasmicLink } from "@plasmicapp/host";
import "@plasmicapp/host/registerComponent";
import "@plasmicapp/host/registerGlobalContext";
import { Avatar } from "antd";
import React from "react";
import { r as registerComponentHelper } from "./utils-CSvRw6Za.esm.js";

function AntdAvatar({ letters, href, target, ...props }) {
  const avatar = /* @__PURE__ */ React.createElement(Avatar, {
    ...props,
    children: props.children === void 0 ? letters : props.children,
  });
  const PlasmicLink = usePlasmicLink();
  return href
    ? /* @__PURE__ */ React.createElement(
        PlasmicLink,
        { href, target: target ? "_blank" : void 0 },
        avatar,
      )
    : avatar;
}
function AntdAvatarGroup(props) {
  return /* @__PURE__ */ React.createElement(Avatar.Group, { ...props });
}
function registerAvatar(loader) {
  registerComponentHelper(loader, AntdAvatar, {
    name: "plasmic-antd6-avatar",
    displayName: "Avatar",
    props: {
      icon: { type: "slot", hidePlaceholder: true },
      href: {
        type: "href",
        displayName: "Link to",
        description: "Destination to link to",
      },
      target: {
        type: "boolean",
        displayName: "Open in new tab",
        hidden: (ps) => !ps.href,
      },
      letters: {
        type: "string",
        description: "Letters to show",
        defaultValue: "AB",
      },
      src: {
        type: "imageUrl",
        description: "Image to display",
      },
      size: {
        type: "choice",
        options: ["small", "medium", "large"],
        description: "Set the size of avatar",
        defaultValueHint: "medium",
      },
      shape: {
        type: "choice",
        options: ["circle", "square"],
        description: "Set the avatar shape",
        defaultValueHint: "circle",
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerAvatar",
    importName: "AntdAvatar",
  });
}
function registerAvatarGroup(loader) {
  registerComponentHelper(loader, AntdAvatarGroup, {
    name: "plasmic-antd6-avatar-group",
    displayName: "AvatarGroup",
    props: {
      children: {
        type: "slot",
        defaultValue: [1, 2, 3, 4].map((user) => ({
          type: "component",
          name: "plasmic-antd6-tooltip",
          props: {
            titleText: "User " + user,
            children: {
              type: "component",
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

export { AntdAvatar, AntdAvatarGroup, registerAvatar, registerAvatarGroup };
//# sourceMappingURL=registerAvatar.esm.js.map
