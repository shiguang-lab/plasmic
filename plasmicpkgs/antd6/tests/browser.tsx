import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AntdCard,
  AntdInputSearch,
  AntdMultipleDatePicker,
  AntdSpaceCompact,
  AntdSplitter,
  AntdSplitterPanel,
  AntdTimePicker,
} from "../src/registerAdditional";
import { AntdButton } from "../src/registerButton";
import { AntdConfigProvider } from "../src/registerConfigProvider";
import { AntdDatePicker } from "../src/registerDatePicker";
import { AntdPopover } from "../src/registerPopover";
import { AntdDropdown } from "../src/registerDropdown";
import { AntdDrawer } from "../src/registerDrawer";
import { AntdMenu, AntdMenuItem, AntdSubMenu } from "../src/registerMenu";
import { AntdModal } from "../src/registerModal";
import { AntdSelect } from "../src/registerSelect";
import { AntdSteps } from "../src/registerSteps";
import { AntdTabItem, AntdTabs } from "../src/registerTabs";

import { FormWrapper } from "../src/form/Form";
import { FormItemWrapper } from "../src/form/FormItem";
import { FormListWrapper } from "../src/form/FormList";
import { AntdInput, AntdInputNumber } from "../src/registerInput";

function App() {
  const [submitted, setSubmitted] = useState("");
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [choice, setChoice] = useState("one");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState<string | null>("2026-10-02T10:20:00Z");
  return (
    <AntdConfigProvider themeStyles={{}} colorPrimary="#1677ff">
      <div style={{ padding: 24 }}>
        <h1>Ant Design 6 verification</h1>
        <AntdButton
          onClick={() => setModal(true)}
          variant="solid"
          color="primary"
        >
          Open modal
        </AntdButton>
        <AntdButton onClick={() => setDrawer(true)}>Open drawer</AntdButton>
        <AntdSelect
          options={[
            { label: "One", value: "one" },
            { label: "Two", value: "two" },
          ]}
          value={choice}
          onChange={setChoice}
          variant="filled"
        />
        <output id="choice">{choice}</output>
        <AntdSpaceCompact>
          <AntdInput placeholder="Compact input" />
          <AntdButton>Compact action</AntdButton>
        </AntdSpaceCompact>
        <AntdInputNumber
          defaultValue={123}
          prefix="$"
          suffix="USD"
          variant="filled"
        />
        <AntdInputSearch
          value={search}
          onChange={setSearch}
          placeholder="Search value"
        />
        <output id="search">{search}</output>
        <AntdDatePicker value={date} onChange={setDate} variant="outlined" />
        <AntdMultipleDatePicker
          value={["2026-10-02T10:20:00Z", "2026-10-03T10:20:00Z"]}
        />
        <AntdTimePicker value="2026-10-02T10:20:00Z" />
        <AntdPopover open content="Popover content">
          <AntdButton>Popover trigger</AntdButton>
        </AntdPopover>
        <AntdDropdown
          open
          menuItemsJson={[{ key: "action", label: "Dropdown action" }]}
        >
          <AntdButton>Dropdown trigger</AntdButton>
        </AntdDropdown>
        <AntdMenu mode="inline">
          <AntdMenuItem key="one">Menu one</AntdMenuItem>
          <AntdSubMenu key="sub" title="Submenu">
            <AntdMenuItem key="two">Menu two</AntdMenuItem>
          </AntdSubMenu>
        </AntdMenu>
        <AntdCard
          title="Card"
          variant="borderless"
          actions={<AntdButton>Card action</AntdButton>}
        >
          Card content
        </AntdCard>
        <AntdSteps
          orientation="vertical"
          items={[{ title: "First", content: "Step content" }]}
        />
        <AntdTabs
          items={
            <>
              <AntdTabItem key="one" label="First">
                First content
              </AntdTabItem>
              <AntdTabItem key="two" label="Second">
                Second content
              </AntdTabItem>
            </>
          }
          tabPlacement="top"
          animated={false}
          animateTabBar={false}
          animateTabContent={false}
          sticky={false}
          stickyOffset={0}
          tabBarBackground=""
          tabBarExtraContentLeft={null}
          tabBarExtraContentRight={null}
        />
        <FormWrapper
          initialValues={{
            people: [{ name: "Alice", hidden: "unregistered" }],
          }}
          onFinish={(values) => setSubmitted(JSON.stringify(values))}
        >
          <FormListWrapper name="people">
            <FormItemWrapper name="name">
              <AntdInput />
            </FormItemWrapper>
          </FormListWrapper>
          <AntdButton submitsForm>Submit form</AntdButton>
        </FormWrapper>
        <output id="form-output">{submitted}</output>
        <AntdSplitter style={{ height: 200 }} orientation="horizontal">
          <AntdSplitterPanel>Left pane</AntdSplitterPanel>
          <AntdSplitterPanel>Right pane</AntdSplitterPanel>
        </AntdSplitter>
        <AntdModal
          open={modal}
          onOpenChange={setModal}
          title="Verification modal"
          modalScopeClassName="verify-modal"
          wrapClassName="verify-modal-wrap"
          closeOnOutsideClick
        >
          Modal content
        </AntdModal>
        <AntdDrawer
          open={drawer}
          onOpenChange={setDrawer}
          title="Verification drawer"
          size={378}
        >
          Drawer content
        </AntdDrawer>
      </div>
    </AntdConfigProvider>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
