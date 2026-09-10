"use client";

import { Smartphone } from "lucide-react";
import { useState } from "react";
import { calendarFeedPath } from "@/lib/calendar/path";

type IcalSubscribeButtonProps = {
  token: string;
};

export function IcalSubscribeButton({ token }: IcalSubscribeButtonProps) {
  const [subscribed, setSubscribed] = useState(false);

  function onClick() {
    const path = calendarFeedPath(token);
    const url = `webcal://${window.location.host}${path}`;
    setSubscribed(true);
    window.location.assign(url);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        subscribed
          ? "Odśwież kalendarz w iPhonie"
          : "Dodaj kalendarz do iPhone’a"
      }
      className="inline-flex min-h-9 shrink-0 items-center gap-1.5 bg-[#4A6FA5] px-3 text-[12px] text-cream hover:bg-[#5C84BC]"
    >
      <Smartphone strokeWidth={1.5} className="size-4" aria-hidden />
      {subscribed ? "Odśwież iPhone" : "iPhone"}
    </button>
  );
}
