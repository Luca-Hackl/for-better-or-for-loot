"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMatch } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";

export function DeleteMatchButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);

  if (!confirm) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>
        <Trash2 className="h-4 w-4" /> Delete
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted">Sure?</span>
      <Button variant="ghost" size="sm" onClick={() => setConfirm(false)} disabled={pending}>
        No
      </Button>
      <Button
        variant="danger"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await deleteMatch(id);
            router.push("/matches");
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        Delete
      </Button>
    </div>
  );
}
