'use strict';

var jsxRuntime = require('react/jsx-runtime');
var Ant = require('antd');
var utils = require('./utils-B1jTF3MA.cjs.js');
require('@plasmicapp/host/registerComponent');
require('@plasmicapp/host/registerGlobalContext');
require('react');
require('@shiguang-lab/plasmic-antd6/thumbnails');

function AntdAvatar({
  letters,
  ...props
}) {
  return /* @__PURE__ */ jsxRuntime.jsx(
    Ant.Avatar,
    {
      ...props,
      children: props.children === void 0 ? letters : props.children
    }
  );
}
function AntdAvatarGroup(props) {
  return /* @__PURE__ */ jsxRuntime.jsx(Ant.Avatar.Group, { ...props });
}
function registerAvatar(loader) {
  utils.registerComponentHelper(loader, AntdAvatar, {
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
  utils.registerComponentHelper(loader, AntdAvatarGroup, {
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

exports.AntdAvatar = AntdAvatar;
exports.AntdAvatarGroup = AntdAvatarGroup;
exports.registerAvatar = registerAvatar;
exports.registerAvatarGroup = registerAvatarGroup;
//# sourceMappingURL=registerAvatar.cjs.js.map
