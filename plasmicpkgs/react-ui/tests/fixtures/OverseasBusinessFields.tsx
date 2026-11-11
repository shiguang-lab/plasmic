import { FormWrapper } from "@shiguang-lab/plasmic-antd6/skinny/Form";
import {
  AntdDescriptions,
  AntdDescriptionsItem,
  AntdFlex,
} from "@shiguang-lab/plasmic-antd6/skinny/registerAdditional";
import { AntdButton } from "@shiguang-lab/plasmic-antd6/skinny/registerButton";
import { FormItemWrapper } from "@shiguang-lab/plasmic-antd6/skinny/registerForm";
import {
  AntdColumn,
  AntdTable,
} from "@shiguang-lab/plasmic-antd6/skinny/registerTable";
import { useState } from "react";
import {
  IntlDepartmentSelect,
  IntlDepartmentView,
  IntlDictSelect,
  IntlDictView,
  IntlUserSelect,
  IntlUserView,
} from "../../src";
import { demoDictCode } from "../../src/intlDemoData";

export interface OverseasBusinessFieldValues {
  ownerId: string;
  departmentId: string;
  regionCode: string;
}

export function OverseasBusinessFields({
  onSave,
}: {
  onSave?: (values: OverseasBusinessFieldValues) => void;
}) {
  const [record, setRecord] = useState<OverseasBusinessFieldValues>();
  return (
    <AntdFlex vertical gap={24}>
      <FormWrapper
        layout="vertical"
        onFinish={(values: OverseasBusinessFieldValues) => {
          setRecord(values);
          onSave?.(values);
        }}
      >
        <FormItemWrapper
          name="ownerId"
          label="负责人"
          rules={[{ ruleType: "required" }]}
        >
          <IntlUserSelect aria-label="负责人" />
        </FormItemWrapper>
        <FormItemWrapper
          name="departmentId"
          label="所属部门"
          rules={[{ ruleType: "required" }]}
        >
          <IntlDepartmentSelect aria-label="所属部门" treeDefaultExpandAll />
        </FormItemWrapper>
        <FormItemWrapper
          name="regionCode"
          label="业务地区"
          rules={[{ ruleType: "required" }]}
        >
          <IntlDictSelect aria-label="业务地区" dictCode={demoDictCode} />
        </FormItemWrapper>
        <AntdButton type="primary" htmlType="submit" aria-label="保存">
          保存
        </AntdButton>
      </FormWrapper>
      <section aria-label="记录列表">
        <AntdTable
          data={{ data: record ? [{ ...record, id: "demo-record" }] : [] }}
          rowKey="id"
          pagination={false}
        >
          <AntdColumn
            title="负责人"
            dataIndex="ownerId"
            render={(id) => <IntlUserView value={id} />}
          />
          <AntdColumn
            title="所属部门"
            dataIndex="departmentId"
            render={(id) => <IntlDepartmentView value={id} />}
          />
          <AntdColumn
            title="业务地区"
            dataIndex="regionCode"
            render={(code) => (
              <IntlDictView value={code} dictCode={demoDictCode} />
            )}
          />
        </AntdTable>
      </section>
      {record && (
        <section aria-label="记录详情">
          <AntdDescriptions title="记录详情" column={3}>
            <AntdDescriptionsItem label="负责人">
              <IntlUserView value={record.ownerId} />
            </AntdDescriptionsItem>
            <AntdDescriptionsItem label="所属部门">
              <IntlDepartmentView value={record.departmentId} />
            </AntdDescriptionsItem>
            <AntdDescriptionsItem label="业务地区">
              <IntlDictView value={record.regionCode} dictCode={demoDictCode} />
            </AntdDescriptionsItem>
          </AntdDescriptions>
        </section>
      )}
    </AntdFlex>
  );
}
