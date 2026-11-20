import { InspectorReadOnly } from "@/wab/client/components/studio/inspector-access";
import CardPickerItem from "@/wab/client/components/sidebar-tabs/ComponentProps/CardPickerItem";
import CardPickerModal from "@/wab/client/components/sidebar-tabs/ComponentProps/CardPickerModal";
import { BareModal } from "@/wab/client/components/studio/BareModal";
import Chip from "@/wab/client/components/widgets/Chip";
import { UiText } from "@/wab/client/i18n/UiText";
import React from "react";

export function CardPickerEditor(props: {
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  value: string | null | undefined;
  title?: React.ReactNode;
  showInput?: boolean;
  options: {
    value: string;
    label?: string;
    imgUrl: string;
    footer?: React.ReactNode;
  }[];
}) {
  const { onChange, onSearch, value, title, options, showInput } = props;
  const [show, setShow] = React.useState(false);
  const inspecting = React.useContext(InspectorReadOnly);
  const [search, setSearch] = React.useState("");

  const onCancel = () => {
    setShow(false);
    setSearch("");
  };
  const onSave = () => {
    setShow(false);
    onChange(search);
  };
  React.useEffect(() => {
    onSearch?.(search);
  }, [search]);

  return (
    <>
      <div className="flex-fill flex-left text-ellipsis">
        <Chip onClick={() => setShow(true)}>
          <span className="line-clamp-12">
            {value ? (
              (options.find((option) => option.value === value)?.label ?? value)
            ) : (
              <UiText message="unset" />
            )}
          </span>
        </Chip>
      </div>
      {show && (
        <BareModal onClose={onCancel} width={1200}>
          <CardPickerModal
            showInput={!inspecting && showInput}
            searchValue={search}
            title={title}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (!inspecting && e.key === "Enter") {
                onSave();
              }
            }}
            onCancel={onCancel}
          >
            {options.filter((option) => !inspecting || option.value === value).map((option) => inspecting ? (
              <div key={option.value}><img src={option.imgUrl} alt={option.label ?? option.value} /><span>{option.label ?? option.value}</span></div>
            ) : (
              <CardPickerItem
                imgUrl={option.imgUrl}
                title={option.footer}
                onClick={() => {
                  onChange(option.value);
                  onCancel();
                }}
              />
            ))}
          </CardPickerModal>
        </BareModal>
      )}
    </>
  );
}
