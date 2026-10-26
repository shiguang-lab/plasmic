import { Avatar } from 'antd';
import React from 'react';
import { r as registerComponentHelper } from './utils-Cmdig6Yl.esm.js';
import '@plasmicapp/host/registerComponent';
import '@plasmicapp/host/registerGlobalContext';

function AntdAvatar({
  letters,
  ...props
}) {
  return /* @__PURE__ */ React.createElement(
    Avatar,
    {
      ...props,
      children: props.children === void 0 ? letters : props.children
    }
  );
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
      letters: {
        type: "string",
        description: "Letters to show",
        defaultValue: "AB"
      },
      src: {
        type: "imageUrl",
        description: "Image to display"
      },
      alt: {
        type: "string",
        description: "Alternative text for the avatar image"
      },
      size: {
        type: "choice",
        options: (ps) => [
          "small",
          "medium",
          "large",
          ...typeof ps.size === "number" ? [ps.size] : []
        ],
        description: "Set the size of avatar",
        defaultValueHint: "medium"
      },
      shape: {
        type: "choice",
        options: ["circle", "square"],
        description: "Set the avatar shape",
        defaultValueHint: "circle"
      },
      onClick: {
        type: "eventHandler",
        argTypes: [],
        description: "Native Avatar onClick. For a link, place the Avatar inside a link element instead."
      }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerAvatar",
    importName: "AntdAvatar"
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
                letters: `U${user}`
              }
            }
          }
        }))
      },
      max: { type: "object" },
      size: {
        type: "choice",
        options: ["small", "medium", "large"],
        description: "Default size of avatars",
        defaultValueHint: "medium"
      }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerAvatar",
    importName: "AntdAvatarGroup"
  });
}

export { AntdAvatar, AntdAvatarGroup, registerAvatar, registerAvatarGroup };
//# sourceMappingURL=registerAvatar.esm.js.map
