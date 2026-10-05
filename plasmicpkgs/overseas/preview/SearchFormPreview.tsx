import { Button, ConfigProvider, Input, InputNumber, Space } from "antd";
import React, { useRef, useState } from "react";
import { AntdCheckbox } from "../../antd6/src/registerCheckbox";
import { AntdDatePicker } from "../../antd6/src/registerDatePicker";
import { AntdSelect } from "../../antd6/src/registerSelect";
import {
  SearchForm,
  SearchFormActions,
  SearchFormItem,
  SearchValues,
} from "../src/SearchForm";

function RegionControl({
  selectedKey,
  onSelectKey,
  id,
}: {
  selectedKey?: string;
  onSelectKey?: (value: string) => void;
  id?: string;
}) {
  return (
    <Input
      id={id}
      value={selectedKey}
      onChange={(event) => onSelectKey?.(event.target.value)}
      placeholder="请输入地区"
    />
  );
}
RegionControl.__plasmicFormFieldMeta = {
  valueProp: "selectedKey",
  onChangeProp: "onSelectKey",
};

export function SearchFormPreview() {
  const ref = useRef<SearchFormActions>(null);
  const [draft, setDraft] = useState<SearchValues>({});
  const [applied, setApplied] = useState<SearchValues>({});
  const [resets, setResets] = useState(0);
  const [controlEvents, setControlEvents] = useState(0);
  const [exports, setExports] = useState(0);
  const [includeRegion, setIncludeRegion] = useState(false);
  const [regionLabel, setRegionLabel] = useState("地区");
  const [required, setRequired] = useState(false);
  const [labelWidth, setLabelWidth] = useState<number>();
  return (
    <ConfigProvider>
      <main style={{ padding: 32, maxWidth: 1280, margin: "auto" }}>
        <h1>SearchForm · 可编辑查询区</h1>
        <label>
          标签宽度（留空跟随内容）：
          <InputNumber
            aria-label="标签宽度"
            min={0}
            value={labelWidth}
            onChange={(value) => setLabelWidth(value ?? undefined)}
          />
        </label>
        <SearchForm
          ref={ref}
          colSpan={6}
          labelWidth={labelWidth}
          onValuesChange={setDraft}
          onSearch={setApplied}
          onReset={(values) => {
            setApplied(values);
            setResets((value) => value + 1);
          }}
          extraActions={
            <Button onClick={() => setExports((value) => value + 1)}>
              导出
            </Button>
          }
        >
          <SearchFormItem
            name="keyword"
            label="关键词"
            initialValue="initial"
            required={required}
            requiredMessage="请填写关键词"
          >
            <Input
              allowClear
              placeholder="请输入关键词"
              onChange={() => setControlEvents((value) => value + 1)}
            />
          </SearchFormItem>
          <SearchFormItem name="status" label="状态" clearValue="all">
            <AntdSelect
              allowClear
              options={[
                { value: "all", label: "全部" },
                { value: "active", label: "启用" },
              ]}
            />
          </SearchFormItem>
          <SearchFormItem name="enabled" label="启用" initialValue={false}>
            <AntdCheckbox>仅启用</AntdCheckbox>
          </SearchFormItem>
          <SearchFormItem
            name="day"
            label="日期"
            initialValue="2026-10-04"
            required={required}
            requiredMessage="请填写日期"
          >
            <AntdDatePicker />
          </SearchFormItem>
          {includeRegion && (
            <SearchFormItem name="region" label={regionLabel} initialValue="MX">
              <RegionControl />
            </SearchFormItem>
          )}
        </SearchForm>
        <Space wrap>
          <Button
            onClick={() =>
              ref.current?.setFieldsValue({
                keyword: "via-action",
                enabled: true,
              })
            }
          >
            设置草稿
          </Button>
          <Button onClick={() => ref.current?.submit()}>触发查询</Button>
          <Button onClick={() => ref.current?.reset()}>触发重置</Button>
          <Button onClick={() => setIncludeRegion((value) => !value)}>
            插入/删除地区
          </Button>
          <Button onClick={() => setRegionLabel("市场")}>修改字段标签</Button>
          <Button onClick={() => setRegionLabel("客户所属市场")}>
            使用长标签
          </Button>
          <Button onClick={() => setRequired((value) => !value)}>
            切换必填
          </Button>
        </Space>
        <p>当前草稿</p>
        <pre data-testid="draft">{JSON.stringify(draft)}</pre>
        <p>已应用条件</p>
        <pre data-testid="applied">{JSON.stringify(applied)}</pre>
        <p data-testid="counts">
          {JSON.stringify({ resets, controlEvents, exports })}
        </p>
      </main>
    </ConfigProvider>
  );
}
