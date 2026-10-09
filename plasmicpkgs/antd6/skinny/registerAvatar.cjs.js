'use strict';

var host = require('@plasmicapp/host');
var Ant = require('antd');
var React = require('react');
var utils = require('./utils-DlS9-CF8.cjs.js');
require('@plasmicapp/host/registerComponent');
require('@plasmicapp/host/registerGlobalContext');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var React__default = /*#__PURE__*/_interopDefault(React);

function AntdAvatar({
  letters,
  href,
  target,
  ...props
}) {
  const avatar = /* @__PURE__ */ React__default.default.createElement(
    Ant.Avatar,
    {
      ...props,
      children: props.children === void 0 ? letters : props.children
    }
  );
  const PlasmicLink = host.usePlasmicLink();
  return href ? /* @__PURE__ */ React__default.default.createElement(PlasmicLink, { href, target: target ? "_blank" : void 0 }, avatar) : avatar;
}
function AntdAvatarGroup(props) {
  return /* @__PURE__ */ React__default.default.createElement(Ant.Avatar.Group, { ...props });
}
function registerAvatar(loader) {
  utils.registerComponentHelper(loader, AntdAvatar, {
    name: "plasmic-antd6-avatar",
    displayName: "Avatar",
    props: {
      icon: { type: "slot", hidePlaceholder: true },
      href: {
        type: "href",
        displayName: "Link to",
        description: "Destination to link to"
      },
      target: {
        type: "boolean",
        displayName: "Open in new tab",
        hidden: (ps) => !ps.href
      },
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
