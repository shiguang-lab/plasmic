const pick = (value, fields) => Object.fromEntries(fields
  .filter((key) => Object.hasOwn(value, key))
  .map((key) => [key, value[key]]));

function managementResult(result) {
  const project = (value) => pick(value, ["id", "name", "workspaceId", "workspaceName", "teamId", "teamName"]);
  const team = (value) => pick(value, ["id", "name"]);
  const workspace = (value) => ({
    ...pick(value, ["id", "name"]),
    ...(value.team ? { team: team(value.team) } : {}),
  });
  return {
    ...Object.fromEntries([
      ["team", team], ["workspace", workspace], ["project", project],
      ["teams", (items) => items.map(team)],
      ["workspaces", (items) => items.map(workspace)],
      ["projects", (items) => items.map(project)],
    ].filter(([key]) => Object.hasOwn(result, key)).map(([key, select]) => [key, select(result[key])])),
  };
}

module.exports = { managementResult };
