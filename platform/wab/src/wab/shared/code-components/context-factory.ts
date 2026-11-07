import { getProjectFlags } from "@/wab/shared/devflags";
import { arrayEq, assert, ensure, removeWhere } from "@/wab/shared/common";
import { clone as cloneExpr, asCode, ExprCtx } from "@/wab/shared/core/exprs";
import type { ModelChange } from "@/wab/shared/core/observable-model";
import { clone, cloneArgs } from "@/wab/shared/core/tpls";
import { Arg, ObjInst, RenderExpr, Site, TplComponent, TplNode, isKnownRenderExpr } from "@/wab/shared/model/classes";
import { isSlot } from "@/wab/shared/SlotUtils";

export interface ContextFactoryUpdate {
  readonly root: TplComponent;
  readonly changes: readonly ModelChange[];
}

/** Owns transient provider clones and reports every committed clone field change. */
export class ContextFactory {
  private readonly contexts = new Map<string, TplComponent>();
  private readonly changes = new Map<ObjInst, Map<string, ModelChange>>();
  private disposed = false;

  constructor(private readonly site: Site) {}

  wrap(root: TplComponent, sources: readonly TplComponent[]): ContextFactoryUpdate {
    assert(!this.disposed, "Cannot update a disposed context factory");
    const contexts = sources.map((source) => this.cached(source));
    for (let index = 0; index < contexts.length; index++) {
      const context = contexts[index];
      const parent = index > 0 ? contexts[index - 1] : null;
      if (context.parent !== parent) {
        const previous = context.parent;
        context.parent = parent;
        this.record(context, "parent", previous, parent);
      }
      this.setChild(context, contexts[index + 1] ?? root);
    }
    const changes = [...this.changes.values()].flatMap((fields) => [...fields.values()]);
    this.changes.clear();
    return { root: contexts[0] ?? root, changes };
  }

  private cached(source: TplComponent): TplComponent {
    const target = this.contexts.get(source.uuid);
    const params = new Set(source.component.params);
    if (!target || target.component !== source.component || target.vsettings[0].args.some((arg) => !params.has(arg.param))) {
      const copy = clone(source, true);
      this.contexts.set(source.uuid, copy);
      return copy;
    }
    const targetSetting = target.vsettings[0];
    const targetArgs = targetSetting.args;
    const before = [...targetArgs];
    const targetByParam = new Map(targetArgs.map((arg) => [arg.param, arg]));
    const sourceArgs = source.vsettings[0].args;
    const sourceParams = new Set(sourceArgs.map((arg) => arg.param));
    removeWhere(targetArgs, (arg) => arg.param.variable.name !== "children" && !sourceParams.has(arg.param));
    const exprCtx: ExprCtx = { projectFlags: getProjectFlags(this.site), component: null, inStudio: true };
    for (const arg of sourceArgs) {
      if (isSlot(arg.param)) {
        continue;
      }
      const targetArg = targetByParam.get(arg.param);
      if (!targetArg) {
        targetArgs.push(...cloneArgs([arg]));
      } else if (asCode(targetArg.expr, exprCtx).code !== asCode(arg.expr, exprCtx).code) {
        const previous = targetArg.expr;
        targetArg.expr = cloneExpr(arg.expr);
        this.record(targetArg, "expr", previous, targetArg.expr);
      }
    }
    if (!arrayEq(before, targetArgs)) {
      this.record(targetSetting, "args", before, targetArgs);
    }
    return target;
  }

  private setChild(context: TplComponent, child: TplNode) {
    const param = ensure(context.component.params.find((candidate) => candidate.variable.name === "children"), "Global contexts must have a children parameter");
    const setting = context.vsettings[0];
    const existing = setting.args.find((arg) => arg.param === param);
    if (existing) {
      if (isKnownRenderExpr(existing.expr) && arrayEq(existing.expr.tpl, [child])) {
        return;
      }
      const previous = existing.expr;
      existing.expr = new RenderExpr({ tpl: [child] });
      this.record(existing, "expr", previous, existing.expr);
    } else {
      const before = [...setting.args];
      setting.args.push(new Arg({ param, expr: new RenderExpr({ tpl: [child] }) }));
      this.record(setting, "args", before, setting.args);
    }
  }

  private record(inst: ObjInst, field: string, oldValue: unknown, newValue: unknown) {
    let fields = this.changes.get(inst);
    if (!fields) {
      fields = new Map(); this.changes.set(inst, fields);
    }
    const first = fields.get(field);
    fields.set(field, { type: "update", oldValue: first?.type === "update" ? first.oldValue : oldValue, newValue, changeNode: { inst, field } });
  }

  dispose() {
    this.disposed = true;
    this.contexts.clear(); this.changes.clear();
  }
}
