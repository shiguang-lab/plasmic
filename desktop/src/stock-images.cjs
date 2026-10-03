const { net } = require("electron");
async function searchStockImages(input) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  const params = {
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: input.query + " filetype:bitmap",
    gsrnamespace: "6",
    gsrlimit: String(input.limit || 8),
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "1024",
  };
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, value);
  const response = await net.fetch(url.href, {
    headers: {
      "User-Agent": "PlasmicDesktop/0.0.1 (prototype design asset search)",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new Error("Stock search failed: HTTP " + response.status);
  const data = await response.json();
  if (data.error) throw new Error("Stock search failed: " + data.error.code);
  return {
    provider: "Wikimedia Commons",
    query: input.query,
    images: Object.values(data.query?.pages || {})
      .map((page) => {
        const info = page.imageinfo?.[0];
        if (!info) return null;
        const meta = info.extmetadata || {};
        return {
          title: page.title,
          url: info.thumburl || info.url,
          originalUrl: info.url,
          sourcePage: info.descriptionurl,
          width: info.thumbwidth || info.width,
          height: info.thumbheight || info.height,
          license: meta.LicenseShortName?.value,
          licenseUrl: meta.LicenseUrl?.value,
          attributionHtml: meta.Artist?.value,
          creditHtml: meta.Credit?.value,
          attributionRequired: meta.AttributionRequired?.value,
        };
      })
      .filter(Boolean),
  };
}
module.exports = { searchStockImages };
