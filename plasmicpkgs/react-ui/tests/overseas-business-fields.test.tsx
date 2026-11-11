import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { OverseasBusinessFields } from "./fixtures/OverseasBusinessFields";

afterEach(() => vi.unstubAllGlobals());

test(
  "submits only business keys and resolves the same saved record in list and detail",
  { timeout: 15000 },
  async () => {
    const save = vi.fn();
    const get = vi.fn();
    vi.stubGlobal("$$request", { get });
    render(<OverseasBusinessFields onSave={save} />);

    const pick = async (field: string, text: string) => {
      fireEvent.mouseDown(screen.getByRole("combobox", { name: field }));
      const choices = await screen.findAllByText(text);
      fireEvent.click(choices[choices.length - 1]);
    };
    const submit = () =>
      fireEvent.click(screen.getByRole("button", { name: "保存" }));
    const showsSavedLabels = (labels: string[]) => {
      for (const name of ["记录列表", "记录详情"]) {
        const area = within(screen.getByRole("region", { name }));
        for (const label of labels) expect(area.getByText(label)).toBeTruthy();
      }
    };

    await pick("负责人", "林晓 (lin.xiao)");
    await pick("所属部门", "运营组");
    await pick("业务地区", "新加坡");
    submit();

    await waitFor(() =>
      expect(save).toHaveBeenNthCalledWith(1, {
        ownerId: "demo-user-1",
        departmentId: "demo-operations",
        regionCode: "SG",
      }),
    );
    showsSavedLabels(["林晓 (lin.xiao)", "运营组", "新加坡"]);

    await pick("负责人", "陈宇 (chen.yu)");
    await pick("所属部门", "风控组");
    await pick("业务地区", "印度尼西亚");
    expect(save).toHaveBeenCalledTimes(1);
    showsSavedLabels(["林晓 (lin.xiao)", "运营组", "新加坡"]);
    submit();

    await waitFor(() =>
      expect(save).toHaveBeenNthCalledWith(2, {
        ownerId: "demo-user-2",
        departmentId: "demo-risk",
        regionCode: "ID",
      }),
    );
    showsSavedLabels(["陈宇 (chen.yu)", "风控组", "印度尼西亚"]);

    const input = screen.getByRole("combobox", { name: "业务地区" });
    const field = input.closest<HTMLElement>(".ant-form-item");
    if (!field)
      throw new Error("Expected the region control to belong to Form.Item");
    const clear = within(field).getByRole("button", { name: "Clear" });
    fireEvent.mouseDown(clear);
    fireEvent.click(clear);
    submit();
    await waitFor(() =>
      expect(input.getAttribute("aria-invalid")).toBe("true"),
    );
    expect(save).toHaveBeenCalledTimes(2);
    showsSavedLabels(["陈宇 (chen.yu)", "风控组", "印度尼西亚"]);
    expect(get).not.toHaveBeenCalled();
  },
);
