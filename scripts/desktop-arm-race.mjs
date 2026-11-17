import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const candidateNames = new Set([
  "darwin-arm64-macos-15",
  "darwin-arm64-macos-26",
]);

export function firstInstaller(artifacts) {
  return artifacts
    .filter((artifact) => candidateNames.has(artifact.name) &&
      !artifact.expired && artifact.size_in_bytes > 0)
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id)[0];
}

export async function dispatchRace(api, { workflowRef, sourceRef, rendererRunId }) {
  if (!/^[a-f0-9]{40}$/.test(sourceRef) || !/^\d+$/.test(rendererRunId)) {
    throw new Error("ARM builds require an immutable source commit and renderer run ID");
  }
  const ref = workflowRef.split("@").at(-1).replace(/^refs\/(heads|tags)\//, "");
  const result = await api("POST", "/actions/workflows/build-desktop-arm.yml/dispatches", {
    ref,
    inputs: { "source-ref": sourceRef, "renderer-run-id": rendererRunId },
  });
  if (!Number.isSafeInteger(result.workflow_run_id) || result.workflow_run_id <= 0) {
    throw new Error("GitHub did not return the ARM workflow run ID");
  }
  return result.workflow_run_id;
}

export async function waitForInstaller(api, runId, workflowSha, {
  now = Date.now,
  pause = sleep,
  timeoutMs = 50 * 60 * 1000,
} = {}) {
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    const run = await api("GET", `/actions/runs/${runId}`);
    if (run.head_sha !== workflowSha) {
      throw new Error("ARM workflow revision differs from the parent release workflow");
    }
    // Only the final upload, after native acceptance and installer validation,
    // has a candidate name. Reports and intermediate artifacts cannot win.
    const { artifacts } = await api("GET", `/actions/runs/${runId}/artifacts?per_page=100`);
    const winner = firstInstaller(artifacts);
    if (winner) return winner;
    if (run.status === "completed") {
      throw new Error(`Neither ARM environment produced a verified installer (run ${runId}: ${run.conclusion})`);
    }
    await pause(20_000);
  }
  throw new Error(`Timed out waiting for a verified ARM installer (run ${runId})`);
}

export async function cancelRace(api, runId) {
  const run = await api("GET", `/actions/runs/${runId}`);
  if (run.status !== "completed") {
    // A run can finish between GET and POST; GitHub then returns 409.
    await api("POST", `/actions/runs/${runId}/cancel`, undefined, [409]);
  }
}

export function githubApi({ token, repository, apiUrl = "https://api.github.com" }, request = fetch) {
  return async (method, endpoint, body, allowedStatuses = []) => {
    const response = await request(`${apiUrl}/repos/${repository}${endpoint}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2026-03-10",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (allowedStatuses.includes(response.status)) return;
    if (!response.ok) throw new Error(`GitHub ${method} ${endpoint}: HTTP ${response.status}`);
    const text = await response.text();
    return text ? JSON.parse(text) : undefined;
  };
}

async function main(command, env) {
  const api = githubApi({
    token: env.GH_TOKEN,
    repository: env.GITHUB_REPOSITORY,
    apiUrl: env.GITHUB_API_URL,
  });
  if (command === "dispatch") {
    const runId = await dispatchRace(api, {
      workflowRef: env.GITHUB_WORKFLOW_REF,
      sourceRef: env.SOURCE_REF,
      rendererRunId: env.GITHUB_RUN_ID,
    });
    await appendFile(env.GITHUB_OUTPUT, `run-id=${runId}\n`);
    await appendFile(env.GITHUB_STEP_SUMMARY,
      `ARM candidates: ${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${runId}\n`);
  } else if (command === "wait") {
    const winner = await waitForInstaller(api, env.ARM_RUN_ID, env.GITHUB_WORKFLOW_SHA);
    await appendFile(env.GITHUB_OUTPUT, `artifact-id=${winner.id}\n`);
    await appendFile(env.GITHUB_STEP_SUMMARY, `Selected verified installer: **${winner.name}** (artifact ${winner.id}).\n`);
  } else if (command === "cancel") {
    await cancelRace(api, env.ARM_RUN_ID);
  } else {
    throw new Error("Expected dispatch, wait, or cancel");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(process.argv[2], process.env);
}
