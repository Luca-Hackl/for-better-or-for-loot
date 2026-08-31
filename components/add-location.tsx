"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLocation } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Loader2, MapPinPlus } from "lucide-react";

export function AddLocation() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [hot, setHot] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <MapPinPlus className="h-4 w-4" /> Add drop zone
      </Button>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Refinery"
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Notes (optional)</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Loot density, rotations, when to drop here…"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={hot} onChange={(e) => setHot(e.target.checked)} />
          Hot drop (contested / high loot)
        </label>
        {error ? <p className="text-xs text-loss">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={pending || !name.trim()}
            onClick={() =>
              start(async () => {
                setError(null);
                try {
                  await createLocation({ name: name.trim(), description: description || null, is_hot_drop: hot });
                  setName("");
                  setDescription("");
                  setHot(false);
                  setOpen(false);
                  router.refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed to add");
                }
              })
            }
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </Button>
        </div>
      </div>
    </Card>
  );
}
