import { showConfetti } from "@/wab/client/components/SimpleConfetti";
import { act, fireEvent, screen } from "@testing-library/react";
import React from "react";

const fixture = vi.hoisted(() => ({ unmount: vi.fn(), options: undefined as Record<string, unknown> | undefined }));
vi.mock("react-confetti", () => ({ default: (props: { onConfettiComplete?: () => void }) => {
  fixture.options = props;
  React.useEffect(() => () => fixture.unmount(), []);
  return <button onClick={props.onConfettiComplete}>Finish celebration</button>;
} }));

it("releases the temporary root and container when the publish celebration finishes", () => {
  const containers = document.body.childElementCount;
  act(() => showConfetti());
  expect(document.body.childElementCount).toBe(containers + 1);
  expect(fixture.options).toMatchObject({ numberOfPieces: 32, recycle: false });
  fireEvent.click(screen.getByRole("button", { name: "Finish celebration" }));
  expect(document.body.childElementCount).toBe(containers);
  expect(fixture.unmount).toHaveBeenCalledTimes(1);
});
