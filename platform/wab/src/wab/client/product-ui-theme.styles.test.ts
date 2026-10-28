import { productPalette } from "@/wab/client/product-ui-theme.styles";
import { theme } from "antd";

it("themes antd inputs rendered inside property rows", () => {
  const token = theme.getDesignToken({
    algorithm: theme.darkAlgorithm,
    token: { colorBgContainer: "#202128", colorText: "#edeef5" },
  });
  const palette = productPalette(token) as Record<string, any>;
  const entry = (selectorPart: string, pseudo = "") =>
    Object.entries(palette).find(
      ([key]) =>
        key.includes(`& .labeled-item ${selectorPart}${pseudo}`) &&
        (pseudo || !key.includes(":")),
    )?.[1];

  // Host custom controls (table Pagination/Scroll) use plain antd inputs that
  // antd-overrides.scss would otherwise paint with a fixed light fill.
  expect(entry(".ant-input")).toEqual({
    background: "#202128",
    color: "#edeef5",
  });
  expect(entry(".ant-input-number")).toMatchObject({ background: "#202128" });
  expect(entry(".ant-input", ":hover")).toEqual({
    background: token.colorFillTertiary,
  });
  expect(entry(".ant-input", "::placeholder")).toEqual({
    color: token.colorTextPlaceholder,
  });
});
