import { Icon } from "@/wab/client/components/widgets/Icon";
import InfoIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Info";
import { fireEvent, render } from "@testing-library/react";
import * as React from "react";
import { ensure } from "@/wab/shared/common";

it("puts a requested ref on the icon's own svg without extra DOM", () => {
  const plain = render(<Icon icon={InfoIcon} className="dimfg" />);
  expect(plain.container.innerHTML).toMatch(/^<svg /);

  const ref = React.createRef<SVGSVGElement>();
  const withRef = render(<Icon ref={ref} icon={InfoIcon} className="dimfg" />);
  // Same markup as without a ref, and the ref is that svg.
  expect(withRef.container.innerHTML).toBe(plain.container.innerHTML);
  expect(ref.current).toBe(withRef.container.firstElementChild);
  expect(ref.current?.classList.contains("dimfg")).toBe(true);
});

it("forwards ref through composed SVG components", () => {
  const Composite = (props: React.ComponentProps<"svg">) => (
    <InfoIcon {...props} />
  );
  const ref = React.createRef<SVGSVGElement>();
  render(<Icon ref={ref} icon={Composite} className="dimfg" />);
  expect(ref.current?.tagName.toLowerCase()).toBe("svg");
  expect(ref.current?.classList.contains("dimfg")).toBe(true);
});

it("keeps a composed icon's Hooks in its own fiber", () => {
  const StatefulIcon = (props: React.ComponentProps<"svg">) => {
    const [count, setCount] = React.useState(0);
    return <InfoIcon {...props} data-count={count} onClick={() => setCount((value) => value + 1)} />;
  };
  const ref = React.createRef<SVGSVGElement>();
  const view = render(<React.StrictMode><Icon icon={StatefulIcon} ref={ref} /></React.StrictMode>);
  expect(ref.current?.dataset.count).toBe("0");
  fireEvent.click(ensure(view.container.querySelector("svg"), "Rendered icon"));
  expect(ref.current?.dataset.count).toBe("1");
  view.rerender(<React.StrictMode><Icon icon={InfoIcon} ref={ref} /></React.StrictMode>);
  expect(ref.current).toBe(view.container.querySelector("svg"));
  expect(ref.current?.dataset.count).toBeUndefined();
});
