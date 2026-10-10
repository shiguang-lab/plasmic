(() => {
  const api = window.mcpSettings;
  const apply = (appearance) => {
    if (appearance === "dark" || appearance === "light") {
      document.documentElement.dataset.uiAppearance = appearance;
    }
  };
  apply(api.initialUiAppearance);
  let receivedAppearance = false;
  api.onUiAppearance((value) => {
    receivedAppearance = true;
    apply(value);
  });
  void api.getUiAppearance().then((value) => {
    if (!receivedAppearance) {
      apply(value);
    }
  });
})();
