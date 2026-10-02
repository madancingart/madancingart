"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { classSignupHref } from "@/lib/account/redirect";
import { createClient } from "@/lib/supabase/client";

const accountsOn = process.env.NEXT_PUBLIC_ACCOUNTS_ENABLED === "true";

export function GroupSignupLink({ classId }: { classId: string }) {
  const [href, setHref] = useState(classSignupHref(classId, false));

  useEffect(() => {
    if (!accountsOn) {
      return;
    }
    let active = true;
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) {
        return;
      }
      setHref(classSignupHref(classId, Boolean(data.session)));
    });
    return () => {
      active = false;
    };
  }, [classId]);

  return (
    <Button href={href} size="sm" className="min-h-11 w-full">
      Zapisz się
    </Button>
  );
}
