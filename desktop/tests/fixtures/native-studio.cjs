// Studio is the first owned view; overlays are added above it. The native
// BrowserWindow's own blank WebContents is not a child of contentView.
function studioContents(window) {
  const contents = window.contentView.children[0]?.webContents;
  if (!contents) throw new Error("Studio WebContentsView is missing");
  return contents;
}
module.exports = { studioContents };
