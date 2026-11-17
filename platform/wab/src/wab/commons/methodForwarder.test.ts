import { methodForwarder } from "@/wab/commons/methodForwarder";

interface ExampleLogger {
  log(message: string): void;
  error(message: string): void;
}

const logger1: ExampleLogger = {
  log: vi.fn(),
  error: vi.fn(),
};

const logger2: ExampleLogger = {
  log: vi.fn(),
  error: vi.fn(),
};

const logger3 = {
  log: "not a method", // invalid, log is not a method
  // invalid, error method missing
} as unknown as ExampleLogger;

describe("methodForwarder", () => {
  it("should forward method calls to all valid targets", () => {
    const composedLogger = methodForwarder(
      null,
      logger1,
      logger2,
      logger3,
      undefined,
    );

    composedLogger.log("foo");
    expect(logger1.log).toHaveBeenCalledWith("foo");
    expect(logger2.log).toHaveBeenCalledWith("foo");

    composedLogger.error("oops");
    expect(logger1.error).toHaveBeenCalledWith("oops");
    expect(logger2.error).toHaveBeenCalledWith("oops");
  });
});

// TypeScript tests

// OK
methodForwarder<{}>();
methodForwarder<{ prop(): void }>();
methodForwarder<{ prop: () => void }>();

// @ts-expect-error Every forwarded property must be a method.
methodForwarder<{ prop: void }>();
// @ts-expect-error Forwarding does not support asynchronous return values.
methodForwarder<{ prop: () => Promise<void> }>();
// @ts-expect-error Forwarded methods must return void, not a value.
methodForwarder<{ prop: () => boolean }>();
// @ts-expect-error An extra non-method property also violates the contract.
methodForwarder<{ prop: () => void; extraProp: string }>();
