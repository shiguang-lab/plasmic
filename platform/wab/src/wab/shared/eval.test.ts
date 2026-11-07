import { evalExprInSandbox, tryEvalExpr } from "@/wab/shared/eval";

describe("evalExprInSandbox", () => {
  it("evaluates expressions using variables from the sandbox env", () => {
    expect(evalExprInSandbox("$props.name", { $props: { name: "foo" } })).toBe(
      "foo",
    );
  });

  it("allows URI globals", () => {
    expect(evalExprInSandbox(`encodeURIComponent("a&b")`, {})).toBe("a%26b");
    expect(evalExprInSandbox(`decodeURIComponent("a%26b")`, {})).toBe("a&b");
    expect(evalExprInSandbox(`encodeURI("http://x.com/a b")`, {})).toBe(
      "http://x.com/a%20b",
    );
    expect(evalExprInSandbox(`decodeURI("http://x.com/a%20b")`, {})).toBe(
      "http://x.com/a b",
    );
  });

  it("allows number parsing/checking globals", () => {
    expect(evalExprInSandbox(`parseFloat("3.14")`, {})).toBe(3.14);
    expect(evalExprInSandbox(`parseInt("42", 10)`, {})).toBe(42);
    expect(evalExprInSandbox(`isNaN(NaN)`, {})).toBe(true);
    expect(evalExprInSandbox(`isFinite(42)`, {})).toBe(true);
  });

  it("combines enabled globals with sandbox env", () => {
    expect(
      evalExprInSandbox(`encodeURIComponent($props.q)`, {
        $props: { q: "a&b" },
      }),
    ).toBe("a%26b");
  });

  it("throws ReferenceError for unknown identifiers", () => {
    expect(() =>
      evalExprInSandbox("someGlobalThatDoesNotExist", {}),
    ).toThrowError(ReferenceError);
    expect(() =>
      evalExprInSandbox("someGlobalThatDoesNotExist", {}),
    ).toThrowError("someGlobalThatDoesNotExist is not defined");
  });

  it("resolves enabled globals to the real global, even if the env has the same key", () => {
    expect(
      evalExprInSandbox("encodeURIComponent", {
        encodeURIComponent: "shadowed",
      }),
    ).toBe(encodeURIComponent);
  });

  it("binds thisObj as this and defaults to an empty object", () => {
    expect(evalExprInSandbox("this.value", {}, { value: 7 })).toBe(7);
    expect(evalExprInSandbox("typeof this", {})).toBe("object");
  });

  it("reuses the compiled evaluator for the same code and realm", () => {
    let constructions = 0;
    const realm = {
      Function: function (...args: any[]) {
        constructions++;
        return new Function(...args);
      },
    } as unknown as typeof globalThis;

    expect(
      evalExprInSandbox(
        "$props.value",
        { $props: { value: 1 } },
        undefined,
        realm,
      ),
    ).toBe(1);
    expect(
      evalExprInSandbox(
        "$props.value",
        { $props: { value: 2 } },
        undefined,
        realm,
      ),
    ).toBe(2);
    expect(constructions).toBe(1);
  });

  it("keeps compiled evaluators isolated per realm", () => {
    const realmA = { Function } as unknown as typeof globalThis;
    const realmB = { Function } as unknown as typeof globalThis;

    expect(evalExprInSandbox("globalThis", {}, undefined, realmA)).toBe(realmA);
    expect(evalExprInSandbox("globalThis", {}, undefined, realmB)).toBe(realmB);
  });
});

describe("tryEvalExpr", () => {
  it("evaluates newly enabled globals", () => {
    expect(tryEvalExpr(`encodeURIComponent("a&b")`, {})).toEqual({
      val: "a%26b",
      err: undefined,
    });
  });

  it("returns err for unknown identifiers", () => {
    const { val, err } = tryEvalExpr("someGlobalThatDoesNotExist", {});
    expect(val).toBeUndefined();
    expect(err).toBeInstanceOf(ReferenceError);
  });
});
