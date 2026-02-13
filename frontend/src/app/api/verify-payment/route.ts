import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

async function ensureBucket(url: string, key: string, bucket: string) {
  try {
    await fetch(`${url}/storage/v1/bucket`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: bucket, public: true }),
    });
  } catch {}
}

export async function POST(req: NextRequest) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_ADMIN_GROUP_ID = process.env.TELEGRAM_ADMIN_GROUP_ID;
  const admin = supabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 500 });
  }
  const form = await req.formData();
  const user_id = String(form.get("user_id") || "");
  const amount = String(form.get("amount") || "100");
  const tax_data_raw = String(form.get("tax_data") || "");
  const screenshot = form.get("screenshot") as File | null;
  if (!user_id || !screenshot) {
    return NextResponse.json({ error: "user_id or screenshot missing" }, { status: 400 });
  }
  try {
    await admin.storage.createBucket("screenshots", { public: true });
  } catch {}
  const path = `${user_id}-${Date.now()}-${screenshot.name}`;
  const bucket = admin.storage.from("screenshots");
  const ab = await screenshot.arrayBuffer();
  const blob = new Blob([ab], { type: screenshot.type || "application/octet-stream" });
  const up = await bucket.upload(path, blob, {
    contentType: screenshot.type || "application/octet-stream",
    upsert: true,
  });
  if (up.error) {
    return NextResponse.json({ error: "Upload failed", details: up.error.message }, { status: 500 });
  }
  const { data: pub } = bucket.getPublicUrl(path);
  const publicUrl = pub.publicUrl;
  const ins = await admin
    .from("payments")
    .insert({
      user_id: Number(user_id),
      screenshot_file_id: "", // will fill with Telegram file_id below
      status: "pending",
      amount: Number(amount),
    })
    .select()
    .single();
  if (ins.error || !ins.data) {
    return NextResponse.json({ error: "DB insert failed" }, { status: 500 });
  }
  const payment_id = ins.data.id;
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_ADMIN_GROUP_ID) {
    const caption = `New Payment from User ID: ${user_id}. Amount: ${amount} ETB. Verify in Telebirr.`;
    const reply_markup = {
      inline_keyboard: [
        [{ text: "✅ Approve", callback_data: `approve_${payment_id}` }],
        [{ text: "❌ Reject", callback_data: `reject_${payment_id}` }],
      ],
    };
    const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_ADMIN_GROUP_ID,
        photo: publicUrl,
        caption,
        reply_markup,
      }),
    });
    const tgJson = await tgRes.json().catch(() => ({}));
    const fileId =
      tgJson?.result?.photo?.[tgJson?.result?.photo?.length - 1]?.file_id ||
      tgJson?.result?.photo?.[0]?.file_id ||
      "";
    if (fileId) {
      await admin.from("payments").update({ screenshot_file_id: fileId }).eq("id", payment_id);
    }
  }
  return NextResponse.json({ ok: true, payment_id });
}
