"use client";

import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { ImagePlus } from "lucide-react";

export function ImageUploadField({
  kind,
  label,
  value,
  onChange,
}: {
  kind: "logos" | "avatars";
  label: string;
  value: string;
  onChange: (filename: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      const data = new FormData();
      data.append("files", file);
      const response = await axios.post(`/api/uploads/${kind}`, data);
      onChange(response.data.files[0]);
      toast.success(`${label} uploaded`);
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? "Image upload failed");
    } finally {
      setUploading(false);
    }
  }
  const canPreview = value && !value.includes("default");
  return (
    <div>
      <label className="input-label">{label}</label>
      <div className="flex items-center gap-3">
        {canPreview && (
          <img
            src={`/uploads/${kind}/${value}`}
            alt={label}
            className="h-16 w-16 rounded-lg border object-cover"
          />
        )}
        <label className="flex h-16 cursor-pointer items-center gap-2 rounded-lg border border-dashed px-4 text-sm text-muted-foreground hover:border-primary hover:text-primary">
          <ImagePlus className="h-4 w-4" />
          {uploading ? "Uploading…" : `Choose ${label.toLowerCase()}`}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(event) => upload(event.target.files?.[0])}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
}
