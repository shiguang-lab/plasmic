import {
  DataProvider,
  repeatedElement,
  usePlasmicCanvasContext,
} from "@plasmicapp/host";
import TiptapMention, { MentionOptions } from "@tiptap/extension-mention";
import { ReactRenderer } from "@tiptap/react";
import React, { useEffect, useEffectEvent, useMemo } from "react";
import tippy, { GetReferenceClientRect, Instance, Props } from "tippy.js";
import MentionList from "./components/MentionList";
import { useTiptapContext } from "./contexts";
import { TIPTAP_COMPONENT_NAME } from "./registerTiptap";
import { Registerable, registerComponentHelper } from "./utils";

export type QueryResult = {
  data?: { response: any[] };
  error?: Error;
  isLoading?: boolean;
};

export type MentionProps = Omit<MentionOptions, "HTMLAttributes"> & {
  className: string;
  dataStatic?: any[];
  hasDataDynamic?: boolean;
  dataDynamic?: QueryResult;
  suggestionItem: React.ReactNode;
  searchField?: string;
  popupClassName?: string;
  itemClassName?: string;
  selectedItemClassName?: string;
  mentionClassName?: string;
  maxSuggestionCount?: number;
};

export function Mention(props: MentionProps) {
  const {
    dataStatic = [],
    dataDynamic,
    hasDataDynamic,
    suggestionItem,
    searchField = "id",
    popupClassName,
    itemClassName,
    selectedItemClassName,
    mentionClassName,
    maxSuggestionCount = 5,
  } = props;

  const { setMention } = useTiptapContext();
  const getItems = useEffectEvent((query: string) => {
    if (!query) return [];
    if (!hasDataDynamic) {
      return dataStatic?.filter((item) =>
        item[searchField].toLowerCase?.()?.includes(query.toLowerCase())
      ).slice(0, maxSuggestionCount) || [];
    }
    if (!dataDynamic) return [];
    if (dataDynamic.isLoading === false) {
      const data = dataDynamic.data?.response;
      if (!Array.isArray(data)) return [];
      return data?.filter((item) =>
        item[searchField].toLowerCase?.()?.includes(query.toLowerCase())
      ).slice(0, maxSuggestionCount) || [];
    }
    return [];
  });
  const getPresentation = useEffectEvent(() => ({ suggestionItem, searchField, popupClassName, itemClassName, selectedItemClassName }));
  useEffect(() => {
    setMention(
      TiptapMention.configure({
        HTMLAttributes: {
          class: mentionClassName,
        },
        renderLabel: ({ options, node }) => {
          return `${options.suggestion.char}${node.attrs.id}`;
        },
        suggestion: {
          items: ({ query }: { query: string }) => getItems(query),
          render: () => {
            let component: ReactRenderer<
              { onKeyDown: (e: KeyboardEvent) => boolean },
              typeof MentionList
            >;
            let popup: Instance<Props>[];
            return {
              // eslint-disable-next-line no-shadow
              onStart: (props) => {
                component = new ReactRenderer<any, any>(MentionList, {
                  props: {
                    ...props,
                    ...getPresentation(),
                  },
                  editor: props.editor,
                });

                if (!props.clientRect) {
                  return;
                }

                popup = tippy("body", {
                  getReferenceClientRect:
                    props.clientRect as GetReferenceClientRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: "manual",
                  placement: "bottom-start",
                });
              },

              // eslint-disable-next-line no-shadow
              onUpdate(props) {
                component.updateProps({
                  ...props,
                  ...getPresentation(),
                });

                if (!props.clientRect) {
                  return;
                }

                popup?.[0]?.setProps({
                  getReferenceClientRect:
                    props.clientRect as GetReferenceClientRect,
                });
              },

              // eslint-disable-next-line no-shadow
              onKeyDown(props) {
                if (props.event.key === "Escape") {
                  popup?.[0]?.hide();

                  return true;
                }

                return component.ref?.onKeyDown(props.event) || false;
              },

              onExit() {
                popup?.[0]?.destroy();
                component.destroy();
              },
            };
          },
        },
      })
    );
    return () => {
      setMention(undefined);
    };
  }, [
    searchField,
    mentionClassName,
    popupClassName,
    itemClassName,
    selectedItemClassName,
  ]);

  const inCanvas = !!usePlasmicCanvasContext();

  const providerData = useMemo(() => {
    const noData = [{ [searchField]: "No data" }];
    let data = inCanvas ? noData : [];
    if (!hasDataDynamic) {
      if (dataStatic?.length && Array.isArray(dataStatic)) {
        data = [...dataStatic];
      }
      return data;
    }

    if (!dataDynamic || dataDynamic.isLoading) return noData;
    data = dataDynamic.data?.response ?? noData;
    if (!Array.isArray(data)) return noData;
    return data.slice(0, maxSuggestionCount);
  }, [
    inCanvas,
    dataDynamic,
    searchField,
    hasDataDynamic,
    maxSuggestionCount,
    dataStatic,
  ]);

  return (
    <div
      style={{
        // ...(showSuggestionItem ? {} : { display: "none" }),
        ...{
          // bare minimum styles (that need not be overridden)
          // We just want to make the dataProvider data available to the MentionList component (<DataProvider> is needed to be returned from the returned JSX). It should not be shown in the UI, hence the display: none
          display: "none",
          position: "absolute",
          top: 0,
          background: "white",
        },
      }}
    >
      {providerData?.slice(0, maxSuggestionCount).map((item, index) => (
        // Data provider needs to be in the returned JSX (the actual use of the "suggestionItem" data is in the MentionList component.)
        <DataProvider key={item.id} name={"suggestionItem"} data={item}>
          {repeatedElement(index === 0, suggestionItem) ?? item[searchField]}
        </DataProvider>
      ))}
    </div>
  );
  // return null;
}
Mention.displayName = "Mention";

export function registerMention(loader?: Registerable) {
  registerComponentHelper(loader, Mention, {
    name: `${TIPTAP_COMPONENT_NAME}-extension-mention`,
    displayName: "Tiptap Mention",
    providesData: true,
    props: {
      dataDynamic: {
        type: "dataSourceOpData" as any,
        description: "Filtered suggestions",
        disableDynamicValue: true, // we don't want the users to temper with the Plasmic's default query type.
        hidden: (ps) => !ps.hasDataDynamic,
      },
      searchField: {
        type: "string",
        defaultValueHint: "id",
      },
      maxSuggestionCount: {
        type: "number",
        defaultValueHint: 5,
        description:
          "Limits the number of suggestions that appear in the suggestions popup",
      },
      dataStatic: {
        type: "array",
        hidden: (ps) => Boolean(ps.hasDataDynamic),
        itemType: {
          type: "object",
          nameFunc: (item) => item.label,
          fields: {
            id: "string",
            label: "string",
          },
        },
        defaultValue: [
          {
            id: "thomasEd1",
            label: "Thomas Edison",
          },
          {
            id: "sherlock221b",
            label: "Sherlock Holmes",
          },
          {
            id: "eliot_thomas",
            label: "T.S Eliot",
          },
          {
            id: "shakespeare74",
            label: "William Shakespeare",
          },
        ],
      },
      hasDataDynamic: {
        type: "boolean",
      },
      mentionClassName: {
        type: "class",
        displayName: "Mention label",
      },
      popupClassName: {
        type: "class",
        displayName: "Suggestion Popup",
      },
      itemClassName: {
        type: "class",
        displayName: "Suggestion Item",
      },
      selectedItemClassName: {
        type: "class",
        displayName: "Selected Item",
      },
      suggestionItem: {
        type: "slot",
      },
      currentMention: {
        type: "string",
        hidden: () => true,
      },
    },
    importName: "Mention",
    importPath: "@plasmicpkgs/tiptap/skinny/registerMention",
    parentComponentName: TIPTAP_COMPONENT_NAME,
  });
}
