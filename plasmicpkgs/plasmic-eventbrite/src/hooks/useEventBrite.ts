import React from "react";
import { v4 as uuid } from "uuid";

const SCRIPT_URL = "https://www.eventbrite.com/static/widgets/eb_widgets.js";

interface Props {
  eventId?: string;
  modal?: boolean;
  onOrderComplete: () => void;
  promoCode?: string;
  iFrameHeight?: string;
  iFrameAutoAdapt?: string;
}

interface Widget {
  widgetType: "checkout";
  eventId: string;
  onOrderComplete: () => void;
  modal?: boolean;
  modalTriggerElementId?: string;
  iframeContainerId?: string;
  promoCode?: string;
}

declare global {
  interface Window {
    EBWidgets?: { createWidget: (config: Widget) => void };
  }
}

export default function useEventbrite({ eventId, modal, onOrderComplete, promoCode }: Props) {
  const [id] = React.useState(() => `EB_${uuid()}`);
  const [isLoaded, setLoaded] = React.useState(false);
  const orderComplete = React.useEffectEvent(onOrderComplete);

  React.useEffect(() => {
    if (window.EBWidgets) {
      setLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.id = `EB_SCRIPT_${id}`;
    script.async = true;
    script.src = SCRIPT_URL;
    const onLoad = () => setLoaded(true);
    const onError = (event: Event) => {
      console.error(`Failed to load Eventbrite script from ${SCRIPT_URL}`, event);
    };
    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);
    script.addEventListener("abort", onError);
    document.head.appendChild(script);
    return () => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
      script.removeEventListener("abort", onError);
      script.remove();
    };
  }, [id]);

  React.useEffect(() => {
    if (!isLoaded || !eventId) {
      return;
    }
    let active = true;
    window.EBWidgets?.createWidget({
      widgetType: "checkout",
      eventId,
      modal,
      ...(modal ? { modalTriggerElementId: id } : { iframeContainerId: id }),
      ...(promoCode ? { promoCode } : {}),
      onOrderComplete: () => { if (active) { orderComplete(); } },
    });
    return () => { active = false; };
  }, [isLoaded, eventId, modal, id, promoCode]);

  return isLoaded ? { id } : null;
}
