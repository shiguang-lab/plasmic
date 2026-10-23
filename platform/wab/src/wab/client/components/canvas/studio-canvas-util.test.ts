import { message, notification } from "antd";
import { mock } from "vitest-mock-extended";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { InteractionLoc } from "@/wab/shared/core/exprs";
import { absorbLinkClick, trapInteractionError } from "@/wab/client/components/canvas/studio-canvas-util";

describe("absorbLinkClick", () => {
  const onAnchorClick = vi.fn();
  const onClick = vi.fn();
  const absorb = (e: Event) => absorbLinkClick(e, onAnchorClick);

  // Mirrors the live frame's capture-phase listener on body.
  const clickLink = (href?: string) => {
    const link = document.createElement("a");
    if (href) {
      link.setAttribute("href", href);
    }
    const label = document.createElement("span");
    link.append(label);
    document.body.replaceChildren(link);
    link.addEventListener("click", onClick);
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    label.dispatchEvent(event);
    return event;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.addEventListener("click", absorb, true);
  });

  afterEach(() => {
    document.body.removeEventListener("click", absorb, true);
  });

  it("absorbs a click on a link to a page", () => {
    const event = clickLink("/pricing");

    expect(onAnchorClick).toHaveBeenCalledWith("/pricing");
    expect(event.defaultPrevented).toBe(true);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("absorbs a click on a link to an anchor", () => {
    const event = clickLink("#faq");

    expect(onAnchorClick).toHaveBeenCalledWith("#faq");
    expect(event.defaultPrevented).toBe(true);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('lets a click on a href="#" link through to its onClick', () => {
    const event = clickLink("#");

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onAnchorClick).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it("ignores a link without a href", () => {
    const event = clickLink();

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onAnchorClick).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});

it("shows a brief expiring interaction message while retaining diagnostic context", () => {
  const notificationSpy = vi.spyOn(notification, "error");
  const messageSpy = vi.spyOn(message, "error").mockImplementation(() => (() => {}) as any);
  const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  const error = new Error("Cannot read properties of null (reading 'startsWith')");
  const loc = { type: "InteractionLoc", interactionUuid: "step" } as InteractionLoc;
  const studio = mock<StudioCtx>();
  studio.tplMgr.mockReturnValue({ findInteractionByUuid: () => ({ interaction: { interactionName: "openTarget" } }) } as any);
  trapInteractionError(studio, loc, error);
  expect(messageSpy).toHaveBeenCalledWith({
    key: "interaction-error", content: 'Could not run step "openTarget".', duration: 4,
  });
  expect(notificationSpy).not.toHaveBeenCalled();
  expect(consoleSpy).toHaveBeenCalledWith("Interaction failed", { location: loc, error });
  vi.restoreAllMocks();
});
