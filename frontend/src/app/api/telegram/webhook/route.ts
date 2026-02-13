import { NextRequest, NextResponse } from "next/server";

function buildPdfContent(name: string, summary: string, tax: string): string {
  const objects: string[] = [];
  const offsets: number[] = [0];
  const add = (s: string) => {
    const prev = offsets[offsets.length - 1];
    offsets.push(prev + s.length);
    objects.push(s);
  };
  const esc = (s: string) => s.replace(/[\(\)\\]/g, (c) => "\\" + c);
  const lines = [
    `BT /F1 18 Tf 50 800 Td (${esc("Ethiopian Tax Consultant")}) Tj ET\n`,
    `BT /F1 12 Tf 50 770 Td (${esc(`Taxpayer: ${name}`)}) Tj ET\n`,
    `BT /F1 12 Tf 50 740 Td (${esc("Income Summary:")}) Tj ET\n`,
    `BT /F1 10 Tf 50 720 Td (${esc(summary)}) Tj ET\n`,
    `BT /F1 12 Tf 50 690 Td (${esc("Calculated Tax:")}) Tj ET\n`,
    `BT /F1 10 Tf 50 670 Td (${esc(tax)}) Tj ET\n`,
    `BT /F1 9 Tf 50 630 Td (${esc("Disclaimer: Based on 2026 Proclamation rules.")}) Tj ET\n`,
  ].join("");
  const header = "%PDF-1.4\n";
  add("1 0 obj << /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  add("2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n");
  add(
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
  );
  add(`4 0 obj << /Length ${lines.length} >>\nstream\n${lines}endstream\nendobj\n`);
  add("5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");
  const xrefStart = header.length + objects.join("").length;
  const xrefEntries = ["0000000000 65535 f \n"];
  let cursor = header.length;
  for (const obj of objects) {
    const entry = String(cursor).padStart(10, "0") + " 00000 n \n";
    xrefEntries.push(entry);
    cursor += obj.length;
  }
  const xref = `xref\n0 ${objects.length + 1}\n${xrefEntries.join("")}`;
  const trailer = `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  const pdf = header + objects.join("") + xref + trailer;
  return pdf;
}

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
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: "env missing" }, { status: 500 });
  }
  const update = await req.json();
  const cb = update.callback_query;
  if (!cb) {
    return NextResponse.json({ ok: true });
  }
  const data = String(cb.data || "");
  const chatId = cb.message?.chat?.id ?? cb.from?.id;
  if (data.startsWith("approve_")) {
    const parts = data.split("_");
    const payment_id = parts[1];
    const user_id = parts[2];
    const selRes = await fetch(`${SUPABASE_URL}/rest/v1/payments?id=eq.${payment_id}`, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: "return=representation",
      },
    });
    const arr = await selRes.json();
    const rec = Array.isArray(arr) ? arr[0] : arr;
    const tax_data_raw = rec?.tax_data || "";
    let summary = "";
    let taxLine = "";
    try {
      const td = JSON.parse(tax_data_raw || "{}");
      summary = String(td.explanation || "");
      taxLine = `Estimated Tax: ${td.estimated_tax ?? ""} ETB`;
    } catch {}
    await fetch(`${SUPABASE_URL}/rest/v1/payments?id=eq.${payment_id}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "approved" }),
    });
    const pdf = buildPdfContent(String(user_id), summary.slice(0, 800), taxLine);
    await ensureBucket(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, "reports");
    const fname = `reports/Tax_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
    const blob = new Blob([pdf], { type: "application/pdf" });
    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${fname}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/pdf",
        "x-upsert": "true",
      },
      body: blob,
    });
    if (!uploadRes.ok) {
      return NextResponse.json({ error: "upload failed" }, { status: 500 });
    }
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${fname}`;
    await fetch(`${SUPABASE_URL}/rest/v1/payments?id=eq.${payment_id}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ report_file_id: fname }),
    });
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        document: publicUrl,
        caption: "Payment Verified! Here is your official Gibi-Guide Tax Report.",
      }),
    });
    return NextResponse.json({ ok: true });
  }
  if (data.startsWith("reject_")) {
    const parts = data.split("_");
    const payment_id = parts[1];
    await fetch(`${SUPABASE_URL}/rest/v1/payments?id=eq.${payment_id}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "rejected" }),
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: true });
}
