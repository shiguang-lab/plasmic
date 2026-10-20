const { randomUUID } = require("node:crypto");

// Budget the serialized MCP envelope, including JSON escaping, rather than
// character count. Images are separate MCP content blocks, outside this budget.
const MAX_JSON_BYTES = 64 * 1024;
const message = (value) => ({ content: [{ type: "text", text: JSON.stringify(value) }], isError: false });
const fits = (value) => Buffer.byteLength(JSON.stringify(message(value))) <= MAX_JSON_BYTES;
const describe = (value) => ({
  type: value === null ? "null" : Array.isArray(value) ? "array" : typeof value,
  ...(value !== null && typeof value === "object"
    ? { total: Object.keys(value).length }
    : typeof value === "string" ? { total: value.length, unit: "utf16" } : {}),
});

class McpResults {
  constructor() {
    this.results = new Map();
    this.bytes = 0;
  }
  retain(value) {
    const resultId = randomUUID();
    // RPC values are detached JSON snapshots. Never rerun a mutation to page it.
    const bytes = Buffer.byteLength(JSON.stringify(value));
    this.results.set(resultId, { value, bytes });
    this.bytes += bytes;
    while (this.results.size > 1 && (this.results.size > 16 || this.bytes > 64 * 1024 * 1024)) {
      const oldest = this.results.keys().next().value;
      this.bytes -= this.results.get(oldest).bytes;
      this.results.delete(oldest);
    }
    return { __type: "ResultReference", resultId, bytes, ...describe(value) };
  }
  output(value) {
    return message(fits(value) ? value : this.retain(value));
  }
  read({ resultId, path = [], offset = 0, limit = 16000 }) {
    if (!this.results.has(resultId)) throw new Error("Result expired or belongs to another MCP connection. Re-read source data; do not repeat a successful mutation.");
    let value = this.results.get(resultId).value;
    for (const key of path) {
      if (value === null || typeof value !== "object" || !Object.hasOwn(value, key)) throw new Error("Result path does not exist");
      value = value[key];
    }
    const base = { __type: "ResultPage", resultId, path, ...describe(value) };
    if (typeof value === "string") {
      if (offset > value.length) throw new Error("Offset exceeds string length");
      // UTF-16 offsets allow continuation without splitting surrogate pairs.
      if (offset > 0 && /[\uDC00-\uDFFF]/.test(value[offset] || "") && /[\uD800-\uDBFF]/.test(value[offset - 1])) throw new Error("Offset splits a Unicode character; use nextOffset");
      let end = Math.min(value.length, offset + limit);
      if (end < value.length && /[\uD800-\uDBFF]/.test(value[end - 1] || "") && /[\uDC00-\uDFFF]/.test(value[end])) end++;
      const page = (end) => ({ ...base, offset, text: value.slice(offset, end), ...(end < value.length ? { nextOffset: end } : {}) });
      while (!fits(page(end)) && end > offset + 2) {
        end = offset + Math.floor((end - offset) / 2);
        if (/[\uD800-\uDBFF]/.test(value[end - 1] || "") && /[\uDC00-\uDFFF]/.test(value[end] || "")) end--;
      }
      return this.checked(page(end));
    }
    if (value === null || typeof value !== "object") return this.checked({ ...base, value });
    const keys = Object.keys(value);
    if (offset > keys.length) throw new Error("Offset exceeds collection length");
    const entries = [];
    const page = () => ({ ...base, offset, entries, ...(offset + entries.length < keys.length ? { nextOffset: offset + entries.length } : {}) });
    for (const key of keys.slice(offset, offset + Math.min(limit, 50))) {
      const item = value[key];
      const entry = { key: Array.isArray(value) ? Number(key) : key, value: item };
      entries.push(entry);
      if (!fits(page())) {
        // A single large child remains addressable; never replace it with a
        // misleading truncated property value or an invalid JSON fragment.
        entries.pop();
        if (entries.length) break;
        entries.push({ key: entry.key, reference: describe(item) });
        break;
      }
    }
    return this.checked(page());
  }
  checked(value) {
    if (!fits(value)) throw new Error("Result path or key exceeds the response budget; request a shorter parent path");
    return value;
  }
}
module.exports = { McpResults, MAX_JSON_BYTES, message };
