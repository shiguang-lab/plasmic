const labels = {
  manifest: ["版本检查", "正在检查版本", "版本检查完成"],
  download: ["资源下载", "正在下载资源", "下载完成"],
  verify: ["资源校验", "正在校验资源", "校验通过"],
};

export async function withProgress(options, stage, action, details = {}) {
  const started = Date.now();
  let state = details;
  let lastUpdate = 0;
  const emit = (status) =>
    options.onProgress?.({
      type: "resource-progress",
      stage,
      ...state,
      status,
      elapsedMs: Date.now() - started,
    });
  emit("running");
  const timer = options.onProgress
    ? setInterval(() => emit("running"), 2000)
    : undefined;
  timer?.unref();
  try {
    const result = await action((update) => {
      state = { ...state, ...update };
      if (
        ("bytes" in update || "completedFiles" in update) &&
        Date.now() - lastUpdate >= 500
      ) {
        lastUpdate = Date.now();
        emit("running");
      }
    });
    emit("completed");
    return result;
  } catch (error) {
    error.stage ??= stage;
    state = {
      ...state,
      error: error.message,
      timedOut:
        error.name === "TimeoutError" || error.cause?.name === "TimeoutError",
    };
    emit("failed");
    throw error;
  } finally {
    clearInterval(timer);
  }
}

function size(bytes) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MiB`
    : bytes >= 1024
      ? `${(bytes / 1024).toFixed(1)} KiB`
      : `${bytes} B`;
}

export function formatProgress(event) {
  if (event.status !== "failed") {
    if (
      event.stage === "cache" &&
      event.status === "completed" &&
      event.upToDate !== undefined
    ) {
      return event.upToDate
        ? "✓ 当前资源已是最新版本\n"
        : "… 正在准备加载资源\n";
    }
    if (
      event.stage === "activate" &&
      event.status === "completed" &&
      event.updated
    ) {
      return "✓ 资源加载完成\n";
    }
    if (!labels[event.stage]) {
      return event.status === "running" && event.elapsedMs >= 2000
        ? `… 正在加载资源，已等待 ${Math.floor(event.elapsedMs / 1000)} 秒\n`
        : "";
    }
  }
  const [label, running, completed] = labels[event.stage] ?? ["资源加载"];
  const icon =
    event.status === "completed" ? "✓" : event.status === "failed" ? "✗" : "…";
  let message = event.status === "completed" ? completed : running;
  if (event.status === "failed") {
    message = event.timedOut
      ? "请求超过 30 秒，请检查网络和资源服务后重试"
      : `未完成：${event.error}`;
    if (event.error === "fetch failed") {
      message = "无法连接资源服务，请检查网络或资源地址后重试";
    }
    if (event.error?.startsWith("Resource update already in progress:")) {
      message = "已有资源更新任务正在进行，请等待该任务完成后重试";
    }
    const http = /HTTP (\d+)/.exec(event.error ?? "");
    if (http) {
      message = `资源服务返回 HTTP ${http[1]}，请检查服务状态或资源地址后重试`;
    }
  }
  const details = [];
  if (event.stage === "manifest" && event.version) {
    message =
      event.versionKind === "cli"
        ? `当前版本 ${event.currentCliVersion}，最新版本 ${event.cliVersion}`
        : `当前版本 ${event.currentVersion ?? "尚未加载"}，最新版本 ${event.version}`;
  }
  if (event.stage === "download" && event.bytes !== undefined) {
    details.push(
      `${size(event.bytes)}${event.totalBytes ? ` / ${size(event.totalBytes)}` : ""}`,
    );
    if (event.totalBytes && event.bytes <= event.totalBytes) {
      details.push(`${Math.floor((event.bytes / event.totalBytes) * 100)}%`);
    }
  }
  if (event.status === "running" && event.elapsedMs >= 2000) {
    details.push(`仍在处理，已等待 ${Math.floor(event.elapsedMs / 1000)} 秒`);
  }
  return `${icon} [${label}] ${message}${details.length ? ` · ${details.join(" · ")}` : ""}\n`;
}
