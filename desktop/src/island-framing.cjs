const meaningful = new Set(["read", "write", "view"]);

/** Presentation scope follows tool intent; metadata and result expiry never move it. */
class IslandFraming {
  context = null;
  group = "";
  targets = null;
  select(scene, context, operation, operations) {
    const key = JSON.stringify([context.projectId, context.sessionId, context.arenaId, context.mode]);
    const changed = key !== this.context;
    if (changed) { this.context = key; this.targets = null; }
    const matches = op => meaningful.has(op.kind) && op.projectId === context.projectId && op.sessionId === context.sessionId &&
      op.mode === context.mode && (op.kind === "view" || op.arenaId === context.arenaId);
    const running = operations.filter(op => op.phase === "running" && matches(op));
    const completed = operations.findLast(op => op.phase === "completed" && matches(op)) ||
      (operation?.phase === "completed" && matches(operation) ? operation : null);
    const candidates = running.length ? running : completed ? [completed] : [];
    const group = candidates.map(op => op.id).sort().join("/");
    if (group && (group !== this.group || changed && candidates.some(op => op.kind === "view"))) {
      this.group = group;
      this.targets = candidates.flatMap(op => op.targets);
    }
    if (!this.targets?.length || this.targets.some(target => target.viewport)) return { ...scene, view: "overview" };
    const selected = new Set();
    for (const target of this.targets) {
      const matches = scene.boards.filter(board => (!target.frameUuid || board.frameUuid === target.frameUuid) &&
        (!target.componentUuid || board.componentUuid === target.componentUuid) && (target.frameUuid || target.componentUuid));
      const board = matches.length === 1 ? matches[0] : matches.find(board => board.frameUuid === context.frameUuid);
      if (!board) return { ...scene, view: "overview" };
      selected.add(board);
    }
    if (selected.size !== 1) return { ...scene, view: "overview" };
    const board = [...selected][0];
    return { ...scene, view: "page", width: board.width, height: board.height, boards: [{ ...board, x: 0, y: 0 }] };
  }
}
module.exports = { IslandFraming };
