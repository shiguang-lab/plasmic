// Account data is read outside MCP dispatch, so refreshes never expand the island.
class IslandAccount {
  constructor(readIdentity, request, changed, now = Date.now) {
    this.readIdentity = readIdentity;
    this.request = request;
    this.changed = changed;
    this.now = now;
    this.value = { status: "loading" };
    this.epoch = 0;
    this.until = 0;
    this.pending = null;
  }
  snapshot() { return this.value; }
  invalidate(clear = true) {
    this.epoch++;
    this.pending = null;
    this.until = 0;
    if (clear) { this.value = { status: "loading" }; this.changed(); }
  }
  clear(status) {
    if (this.value.status === status && !this.value.user && !this.pending) return;
    this.invalidate(false);
    this.value = { status };
    this.changed();
  }
  refresh(workspaceId = null, force = false) {
    if (workspaceId !== this.workspaceId) {
      this.workspaceId = workspaceId;
      this.invalidate(false);
    }
    if (this.pending) return this.pending;
    if (!force && this.now() < this.until) return Promise.resolve();
    const epoch = this.epoch;
    this.until = this.now() + 30_000;
    const commit = value => {
      if (epoch !== this.epoch) return;
      this.value = value;
      this.changed();
    };
    const load = async () => {
      try {
        const self = await this.readIdentity();
        if (epoch !== this.epoch) return;
        if (!self.user?.id) { commit({ status: "signed-out" }); return; }
        const user = { id: self.user.id, email: self.user.email || "",
          name: self.user.displayName || [self.user.firstName, self.user.lastName].filter(Boolean).join(" ").trim() || self.user.loginName || "" };
        if (user.id !== this.value.user?.id) commit({ status: "loading", user });
        const [app, projects] = await Promise.all([
          this.request("/api/v1/app-ctx"),
          this.request('/api/v1/projects?query=%22all%22'),
        ]);
        if (![app.teams, app.workspaces, projects.projects].every(Array.isArray)) throw new Error("Invalid account summary");
        const teams = app.teams.map(({ id, name }) => ({ id, name }));
        const workspaces = app.workspaces.map(({ id, name, team }) => ({ id, name, teamId: team?.id,
          projects: projects.projects.filter(project => project.workspaceId === id).length }));
        const selected = workspaces.find(workspace => workspace.id === workspaceId);
        if (selected) {
          try {
            const detail = await this.request(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}`);
            // Direct workspace access may omit inherited organization grants. In that
            // case the API cannot provide a complete effective user count.
            const teamIds = [detail.workspace?.team?.id, detail.workspace?.team?.parentTeamId].filter(Boolean);
            const complete = Array.isArray(detail.perms) && detail.perms.some(permission =>
              permission.userId === user.id && teamIds.includes(permission.teamId) && permission.accessLevel !== "blocked");
            if (complete) selected.members = new Set(detail.perms.filter(permission =>
              permission.userId && permission.accessLevel !== "blocked" &&
              (permission.workspaceId === workspaceId || teamIds.includes(permission.teamId))
            ).map(permission => permission.userId)).size;
          } catch { /* Missing permission details must not discard accessible resource totals. */ }
        }
        commit({ status: "ready", user, teams, workspaces,
          counts: { organizations: teams.length, workspaces: workspaces.length, projects: projects.projects.length } });
      } catch (error) {
        const signedOut = /\bHTTP (401|30\d)\b/.test(error.message);
        commit(signedOut ? { status: "signed-out" } : { status: "error", user: this.value.user });
      } finally { if (epoch === this.epoch) this.pending = null; }
    };
    this.pending = load();
    return this.pending;
  }
  dispose() { this.invalidate(false); }
}
module.exports = { IslandAccount };
