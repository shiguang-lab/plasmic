import { appendFile } from "node:fs/promises";
import { createInterface } from "node:readline";

const steps = new Map();
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of lines) {
  if (!line.startsWith("{")) {
    console.log(line);
    continue;
  }

  const event = JSON.parse(line);
  for (const log of event.logs ?? []) {
    const message = Buffer.from(log.data, "base64").toString();
    for (const part of message.trimEnd().split("\n")) {
      if (part) console.log(`BuildKit: ${part}`);
    }
  }
  for (const vertex of event.vertexes ?? []) {
    const { name, digest, started, completed, cached, error } = vertex;
    if (error) console.error(`BuildKit: ${name}: ${error}`);
    if (!started || !completed) continue;

    // Bake prefixes a shared step with each target name. Count its digest
    // once per stage so shared work is not multiplied by the image count.
    const stage = name.match(/^\[(?:server |web |preview )?([\w-]+) \d+\/\d+\]/)?.[1];
    if (!stage) continue;
    const key = `${stage}:${digest}`;
    const previous = steps.get(key);
    steps.set(key, {
      stage,
      name: name.replace(/^\[[^\]]+\] /, ""),
      start: Math.min(previous?.start ?? Infinity, Date.parse(started)),
      end: Math.max(previous?.end ?? -Infinity, Date.parse(completed)),
      cached: (previous?.cached ?? true) && Boolean(cached),
    });
  }
}

if (steps.size) {
  const stages = new Map();
  for (const step of steps.values()) {
    const stage = stages.get(step.stage) ?? {
      start: Infinity,
      end: -Infinity,
      cached: 0,
      total: 0,
    };
    stage.start = Math.min(stage.start, step.start);
    stage.end = Math.max(stage.end, step.end);
    stage.cached += Number(step.cached);
    stage.total++;
    stages.set(step.stage, stage);
  }

  const seconds = (milliseconds) => (milliseconds / 1000).toFixed(1);
  const summary = [
    "### Studio BuildKit timing",
    "",
    "Stage spans run from the first step start to the last step finish. Stages can overlap.",
    "",
    "| Stage | Span (s) | Cached steps |",
    "| --- | ---: | ---: |",
  ];
  const notices = [];
  for (const [name, stage] of [...stages].sort(([, a], [, b]) => a.start - b.start)) {
    const duration = seconds(stage.end - stage.start);
    summary.push(`| ${name} | ${duration} | ${stage.cached}/${stage.total} |`);
    notices.push(`${name} ${duration}s (${stage.cached}/${stage.total} cached)`);
  }

  summary.push("", "| Longest uncached step | Duration (s) |", "| --- | ---: |");
  const longest = [...steps.values()]
    .filter((step) => !step.cached)
    .sort((a, b) => (b.end - b.start) - (a.end - a.start))
    .slice(0, 10);
  const details = [];
  for (const step of longest) {
    const duration = seconds(step.end - step.start);
    const label = `${step.stage} / ${step.name.replace(/\s+/g, " ")}`;
    summary.push(`| ${label.replaceAll("|", "\\|")} | ${duration} |`);
    details.push(`${duration}s ${label}`);
  }

  console.log(summary.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary.join("\n") + "\n");
    console.log(`::notice title=Studio BuildKit stages::${notices.join(" | ")}`);
    console.log(`::notice title=Slowest Studio BuildKit steps::${details.join(" | ").replaceAll("%", "%25")}`);
  }
}
