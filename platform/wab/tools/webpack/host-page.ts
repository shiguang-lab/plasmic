import { createHash } from "crypto";
import template from "lodash/template";

export function buildHostPage(
  source: string,
  parameters: Record<string, unknown>,
) {
  const html = template(source)(parameters);
  const hash = createHash("sha256").update(html).digest("hex");
  return { html, path: `/static/host.${hash}.html` };
}
