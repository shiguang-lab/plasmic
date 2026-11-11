// Scoped CSS compiled from the six Intl components' LESS modules.
const styles = {
  intlUserSelect: "react-ui-intl-user-select",
  intlDepartmentSelect: "react-ui-intl-department-select",
  intlUserView: "react-ui-intl-user-view",
  intlDepartmentView: "react-ui-intl-department-view",
  loadingIcon: "react-ui-intl-loading-icon",
  dictTreePopup: "react-ui-intl-dict-tree-popup",
  treeNodeTitle: "react-ui-intl-tree-node-title",
  dictView: "react-ui-intl-dict-view",
  dictViewLoading: "react-ui-intl-dict-view-loading",
};

if (typeof document !== "undefined" && !document.getElementById("react-ui-intl-style")) {
  const style = document.createElement("style");
  style.id = "react-ui-intl-style";
  style.textContent = `
    .${styles.intlUserSelect}, .${styles.intlDepartmentSelect} { width: 100%; }
    .${styles.intlUserView}, .${styles.intlDepartmentView} {
      display: inline-flex; align-items: center; flex-wrap: wrap; gap: 4px;
    }
    .${styles.loadingIcon} {
      display: inline-flex; align-items: center; color: rgba(0, 0, 0, 0.45); margin-left: 4px;
    }
    .${styles.dictTreePopup} [class*="-select-tree-list-holder-inner"] { width: 100%; }
    .${styles.dictTreePopup} [class*="-select-tree-treenode"] { width: 100%; max-width: 100%; }
    .${styles.dictTreePopup} [class*="-select-tree-node-content-wrapper"] {
      min-width: 0; overflow: hidden; flex: auto;
    }
    .${styles.dictTreePopup} [class*="-select-tree-title"] {
      display: block; min-width: 0; overflow: hidden;
    }
    .${styles.treeNodeTitle} {
      display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .${styles.dictView} { display: inline; }
    .${styles.dictViewLoading} {
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 12px; color: var(--ant-color-text-secondary, #999); vertical-align: -0.125em;
    }
  `;
  document.head.appendChild(style);
}

export default styles;
