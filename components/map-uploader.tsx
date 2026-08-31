"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setMapImage, clearMapImage } from "@/lib/actions";
import { compressImage } from "@/lib/image";
import { Button } from "@/components/ui/button";
import { ImageUp, Loader2, Trash2 } from "lucide-react";

const MAP_PATH = "map/background";
const MAX_BYTES = 15 * 1024 * 1024; // pre-compression cap on the source file

export function MapUploader({ hasMap }: { hasMap: boolean }) {
  const router = useRouter();
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image is too large — please use a smaller screenshot.");
      return;
    }
    setBusy(true);
    try {
      // compress + measure from the local file (aspect ratio is preserved)
      const { file: img, width, height } = await compressImage(file, {
        maxDim: 2400,
        quality: 0.85,
      });
      if (!width || !height) throw new Error("Could not read that image");
      const { error: upErr } = await supabase.storage
        .from("screenshots")
        .upload(MAP_PATH, img, { upsert: true, contentType: img.type });
      if (upErr) throw new Error(upErr.message);
      const base = supabase.storage.from("screenshots").getPublicUrl(MAP_PATH).data.publicUrl;
      const url = `${base}?v=${Date.now()}`; // cache-bust the overwrite
      await setMapImage({ url, width, height });
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? `Upload failed: ${e.message}${e.message.includes("bucket") ? " — open the Storage tab in Supabase and run 0003_storage.sql." : ""}`
          : "Upload failed",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border-strong bg-surface/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
          {hasMap ? "Replace map image" : "Upload map image"}
        </Button>
        {hasMap ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await clearMapImage();
                router.refresh();
              } finally {
                setBusy(false);
              }
            }}
          >
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </div>
      {error ? <p className="text-xs text-loss">{error}</p> : null}
      <p className="text-[11px] text-muted-foreground">
        Drop in your own screenshot of the in-game Fort Lyndon map. It’s compressed
        automatically before upload. Then use “Arrange pins” to drag each drop zone onto its real
        spot — pins stay aligned at any size.
      </p>
    </div>
  );
}
