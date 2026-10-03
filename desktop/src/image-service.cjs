const fs = require("node:fs/promises");
const path = require("node:path");

async function readConfig(profile) {
  const filename = path.join(profile, "image-service.json");
  let config;
  try {
    config = JSON.parse(await fs.readFile(filename, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT")
      throw new Error(
        "Configure image-service.json in the desktop user-data directory before using image generation",
      );
    throw new Error("Invalid image-service.json");
  }
  return validateConfig(config);
}
function validateConfig(config) {
  const url = new URL(config.baseUrl);
  if (
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      )) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Image service requires an HTTPS baseUrl (HTTP is allowed only for local services)",
    );
  if (
    typeof config.model !== "string" ||
    !config.model.trim() ||
    typeof config.apiKey !== "string" ||
    !config.apiKey.trim()
  )
    throw new Error("Image service requires model and apiKey");
  return { ...config, baseUrl: url.href.replace(/\/$/, "") };
}
async function imageServiceSettings(profile) {
  try {
    const config = await readConfig(profile);
    return { configured: true, model: config.model, baseUrl: config.baseUrl };
  } catch {
    return { configured: false };
  }
}
async function saveImageConfig(profile, input) {
  const config = validateConfig({
    baseUrl: input.baseUrl,
    model: input.model,
    apiKey: input.apiKey,
  });
  const file = await fs.open(
    path.join(profile, "image-service.json"),
    "w",
    0o600,
  );
  try {
    await file.chmod(0o600);
    await file.writeFile(JSON.stringify(config, null, 2));
  } finally {
    await file.close();
  }
  return { configured: true, baseUrl: config.baseUrl, model: config.model };
}
async function imageServiceStatus(profile) {
  try {
    const config = await readConfig(profile);
    return { configured: true, model: config.model };
  } catch {
    return { configured: false };
  }
}
async function requestImage(profile, input, nativeImage) {
  if (
    !["generate", "edit", "remove_background", "replace_background"].includes(
      input.action,
    )
  )
    throw new Error("Unknown image action");
  if (input.action !== "remove_background" && !input.prompt?.trim())
    throw new Error("Provide an image prompt");
  const config = await readConfig(profile);
  if (
    !path.isAbsolute(input.outputPath) ||
    path.extname(input.outputPath).toLowerCase() !== ".png"
  )
    throw new Error("outputPath must be an absolute new .png file");
  const file = await fs.open(input.outputPath, "wx", 0o600);
  let completed = false;
  try {
    const editing = input.action !== "generate";
    const parameters = {
      model: config.model,
      prompt: input.prompt,
      n: 1,
      output_format: "png",
      ...(input.size ? { size: input.size } : {}),
    };
    let body,
      headers = { Authorization: "Bearer " + config.apiKey };
    if (editing) {
      if (!path.isAbsolute(input.path || ""))
        throw new Error("Input image path must be absolute");
      const stat = await fs.stat(input.path);
      if (!stat.isFile() || stat.size > 10 * 1024 * 1024)
        throw new Error("Input image must be a file of at most 10 MiB");
      const image = nativeImage.createFromBuffer(await fs.readFile(input.path));
      if (image.isEmpty()) throw new Error("Input image cannot be decoded");
      body = new FormData();
      if (input.action === "remove_background") {
        parameters.prompt =
          "Remove the background completely. Preserve the original subject, edges, proportions and colors. Return a transparent PNG with no replacement background.";
        parameters.background = "transparent";
      } else if (input.action === "replace_background") {
        if (!input.prompt)
          throw new Error("Provide the replacement background description");
        parameters.prompt =
          "Replace only the background. Preserve the original foreground subject, identity, proportions and details. New background: " +
          input.prompt;
      }
      for (const [key, value] of Object.entries(parameters))
        if (value !== undefined) body.append(key, String(value));
      body.append(
        "image",
        new Blob([image.toPNG()], { type: "image/png" }),
        "input.png",
      );
    } else {
      if (!input.prompt) throw new Error("Provide an image prompt");
      body = JSON.stringify(parameters);
      headers["Content-Type"] = "application/json";
    }
    const response = await fetch(
      config.baseUrl + (editing ? "/images/edits" : "/images/generations"),
      {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(120000),
        redirect: "error",
      },
    );
    if (!response.ok)
      throw new Error("Image service failed: HTTP " + response.status);
    const result = await response.json();
    const encoded = result.data?.[0]?.b64_json;
    if (
      typeof encoded !== "string" ||
      encoded.length > 14 * 1024 * 1024 ||
      !/^[A-Za-z0-9+/=]+$/.test(encoded)
    )
      throw new Error(
        "Image service must return a base64 image in data[0].b64_json",
      );
    const image = nativeImage.createFromBuffer(Buffer.from(encoded, "base64"));
    if (image.isEmpty())
      throw new Error("Image service returned an undecodable image");
    const png = image.toPNG();
    if (png.length > 10 * 1024 * 1024)
      throw new Error("Generated image exceeds 10 MiB");
    await file.writeFile(png);
    completed = true;
    return {
      path: input.outputPath,
      mimeType: "image/png",
      ...image.getSize(),
      data: png.toString("base64"),
      action: input.action,
    };
  } finally {
    await file.close();
    if (!completed) await fs.unlink(input.outputPath);
  }
}
module.exports = {
  requestImage,
  imageServiceStatus,
  imageServiceSettings,
  saveImageConfig,
};
