"use client";

import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string;
  amount?: number;
  taxData?: { explanation?: string; estimated_tax?: number; calcFor?: string };
  onUploaded?: (paymentId: string) => void;
};

export default function PremiumOverlay({
  open,
  onClose,
  userId,
  amount,
  taxData,
  onUploaded,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!file || uploading) return;
    setUploading(true);
    setStatus(null);
    const fd = new FormData();
    fd.append("user_id", userId);
    if (amount !== undefined) fd.append("amount", String(amount));
    fd.append("screenshot", file);
    if (taxData) {
      fd.append("tax_data", JSON.stringify(taxData));
    }
    try {
      const res = await fetch("/api/verify-payment", { method: "POST", body: fd });
      if (!res.ok) {
        setStatus("Upload failed. Please try again.");
        setUploading(false);
        return;
      }
      const j = await res.json();
      const pid = j.payment_id ?? "";
      setStatus("Uploaded. Awaiting admin approval.");
      setUploading(false);
      onUploaded && onUploaded(pid);
    } catch {
      setStatus("Upload error. Please try again.");
      setUploading(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[92%] max-w-md rounded-2xl bg-white border border-gray-200 p-4">
        <div className="text-sm font-semibold mb-2">Premium Report</div>
        <div className="text-[12px] text-gray-600">
          Transfer 100 ETB to Telebirr: 0947356031. Upload the payment screenshot below.
        </div>
        <div className="mt-3">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        {status && <div className="mt-2 text-[12px] text-gray-600">{status}</div>}
        <div className="mt-3 flex gap-2">
          <button
            onClick={onClose}
            className="rounded-full bg-gray-100 text-gray-800 px-3 py-1 text-xs"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={!file || uploading}
            className="rounded-full bg-ethi-green text-white px-4 py-1 text-xs disabled:opacity-60"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}
