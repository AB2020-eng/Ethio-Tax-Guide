import { NextRequest, NextResponse } from "next/server";

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
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_ADMIN_GROUP_ID = process.env.TELEGRAM_ADMIN_GROUP_ID;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
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
  await ensureBucket(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, "screenshots");
  const path = `screenshots/${user_id}-${Date.now()}-${screenshot.name}`;
  const ab = Buffer.from(await screenshot.arrayBuffer());
  const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${path}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": screenshot.type || "application/octet-stream",
      "x-upsert": "true",
    },
    body: ab,
  });
  if (!uploadRes.ok) {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${path}`;
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/payments`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      user_id,
      screenshot_file_id: path,
      status: "pending",
      amount,
      tax_data: tax_data_raw || null,
    }),
  });
  if (!insertRes.ok) {
    return NextResponse.json({ error: "DB insert failed" }, { status: 500 });
  }
  const inserted = await insertRes.json();
  const payment = Array.isArray(inserted) ? inserted[0] : inserted;
  const payment_id = payment.id;
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_ADMIN_GROUP_ID) {
    const caption = `New Payment Received!\nUser: ${user_id}\nAmount: ${amount} ETB`;
    const reply_markup = {
      inline_keyboard: [
        [{ text: "✅ Approve & Send Report", callback_data: `approve_${payment_id}_${user_id}` }],
        [{ text: "❌ Reject", callback_data: `reject_${payment_id}_${user_id}` }],
      ],
    };
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_ADMIN_GROUP_ID,
        photo: publicUrl,
        caption,
        reply_markup,
      }),
    });
  }
  return NextResponse.json({ ok: true, payment_id });
}
