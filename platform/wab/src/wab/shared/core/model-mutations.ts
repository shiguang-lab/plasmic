import type { ObjInst } from "@/wab/shared/model/classes";
import type { Class, Field } from "@/wab/shared/model/model-meta";
import { ensure, isLiteralObject } from "@/wab/shared/common";

type Listener = (event: Mutation) => void;
type Mutation = { type: "update"; name?: PropertyKey; object: any; oldValue: any; newValue: any; index?: number }
  | { type: "splice"; object: any[]; index: number; added: any[]; removed: any[] }
  | { type: "add"; object: any; name: PropertyKey; newValue: any }
  | { type: "remove"; object: any; name: PropertyKey; oldValue: any };
interface Administration { listeners: Set<Listener>; values?: Record<string, any>; }
const administrations = new WeakMap<object, Administration>();
const descriptors = new WeakMap<Class, PropertyDescriptorMap>();
let mutationVersion = 0;
/** Imperative query caches invalidate synchronously, including within a command. */
export const getModelMutationVersion = () => mutationVersion;
function publish(object: object, event: Mutation) {
  mutationVersion++;
  for (const listener of [...(administrations.get(object)?.listeners ?? [])]) { listener(event); }
}
export function observeMutations(object: object, listener: Listener) {
  const admin = administrations.get(object);
  if (!admin) { throw new Error("Model mutation source has not been instrumented"); }
  admin.listeners.add(listener);
  return () => { admin.listeners.delete(listener); };
}
export function isInstrumentedModel(object: unknown): boolean {
  return typeof object === "object" && object !== null && administrations.has(object);
}
export function isRecordedModel(object: object): boolean {
  return !!administrations.get(object)?.listeners.size;
}
/** Containers report writes only. No getter records dependencies or schedules UI. */
function prepare(value: any, prepared = new WeakMap<object, any>()): any {
  if (!value || typeof value !== "object" || isInstrumentedModel(value)) { return value; }
  const existing = prepared.get(value);
  if (existing) { return existing; }
  if (!Array.isArray(value) && !isLiteralObject(value)) { return value; }
  const target: any = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value));
  const splice = (start: number, count: number, items: any[]) => {
    const length = target.length;
    const integer = (number: number) => Number.isNaN(number) ? 0 : Math.trunc(number);
    const offset = integer(Number(start));
    const index = offset < 0 ? Math.max(length + offset, 0) : Math.min(offset, length);
    const removeCount = Math.min(Math.max(integer(Number(count)), 0), length - index);
    const added = items.map(item => prepare(item));
    const removed = Array.prototype.splice.call(target, index, removeCount, ...added);
    if (added.length || removed.length) { publish(proxy, { type: "splice", object: proxy, index, added, removed }); }
    return removed;
  };
  const methods: Record<string, (...args: any[]) => any> = Array.isArray(value) ? {
    splice: (...args) => splice(args[0] ?? 0, args.length < 2 ? args.length ? target.length : 0 : args[1], args.slice(2)),
    push: (...items) => { splice(target.length, 0, items); return target.length; },
    pop: () => splice(target.length - 1, 1, [])[0],
    shift: () => splice(0, 1, [])[0],
    unshift: (...items) => { splice(0, 0, items); return target.length; },
    reverse: () => { const next = target.slice().reverse(); splice(0, target.length, next); return proxy; },
    sort: (compare) => { const next = target.slice().sort(compare); splice(0, target.length, next); return proxy; },
    copyWithin: (...args) => { const next = target.slice(); Array.prototype.copyWithin.apply(next, args); splice(0, target.length, next); return proxy; },
    fill: (...args) => { const next = target.slice(); Array.prototype.fill.apply(next, args); splice(0, target.length, next); return proxy; },
  } : {};
  const proxy: any = new Proxy(target, {
    get: (object, key, receiver) => typeof key === "string" && Object.prototype.hasOwnProperty.call(methods, key) ? methods[key] : Reflect.get(object, key, receiver),
    set(object, key, next) {
      if (Array.isArray(object) && key === "length") {
        const length = Number(next);
        if (!Number.isInteger(length) || length < 0 || length > 4294967295) { throw new RangeError("Invalid array length"); }
        if (length < object.length) { splice(length, object.length - length, []); }
        else if (length > object.length) { splice(object.length, 0, Array.from({length: length - object.length}, () => undefined)); }
        return true;
      }
      const exists = Object.prototype.hasOwnProperty.call(object, key), oldValue = object[key];
      const newValue = prepare(next);
      if (exists && Object.is(oldValue, newValue)) { return true; }
      if (Array.isArray(object) && typeof key === "string" && /^(0|[1-9]\d*)$/.test(key) && Number(key) < 4294967295) {
        const index = Number(key);
        if (index >= object.length) { splice(object.length, 0, [...Array(index - object.length), newValue]); }
        else { object[index] = newValue; publish(proxy, { type: "update", object: proxy, index, oldValue, newValue }); }
      } else {
        object[key] = newValue;
        publish(proxy, exists ? { type: "update", object: proxy, name: key, oldValue, newValue } : { type: "add", object: proxy, name: key, newValue });
      }
      return true;
    },
    deleteProperty(object, key) {
      if (!Object.prototype.hasOwnProperty.call(object, key)) { return true; }
      const oldValue = object[key]; delete object[key];
      publish(proxy, { type: "remove", object: proxy, name: key, oldValue }); return true;
    },
  });
  prepared.set(value, proxy);
  administrations.set(proxy, { listeners: new Set() });
  for (const key of Object.keys(value)) { target[key] = prepare(value[key], prepared); }
  if (Array.isArray(value)) { target.length = value.length; }
  return proxy;
}
export function instrumentModel(inst: ObjInst, clazz: Class, fields: Field[]) {
  if (administrations.has(inst)) { return; }
  const values: Record<string, any> = {};
  for (const field of fields) { values[field.name] = prepare(inst[field.name]); }
  administrations.set(inst, { values, listeners: new Set() });
  mutationVersion++;
  // A shared descriptor pair per schema field keeps large model trees from
  // allocating getter/setter closures for every instance and field.
  let properties = descriptors.get(clazz);
  if (!properties) {
    properties = Object.fromEntries(fields.map(({name}) => [name, {
      enumerable: true,
      get(this: ObjInst) { return ensure(administrations.get(this)?.values, "Instrumented model values")[name]; },
      set(this: ObjInst, value: any) {
        const record = ensure(administrations.get(this)?.values, "Instrumented model values");
        const oldValue = record[name], newValue = prepare(value);
        if (oldValue !== newValue) { record[name] = newValue; publish(this, { type: "update", name, object: this, oldValue, newValue }); }
      },
    }]));
    descriptors.set(clazz, properties);
  }
  Object.defineProperties(inst, properties);
}
