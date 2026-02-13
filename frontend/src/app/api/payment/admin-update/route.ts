import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

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

export async function POST(req: NextRequest) {
  const admin = supabaseAdmin();
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!admin || !TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: "env missing" }, { status: 500 });
  }
  const body = await req.json();
  const payment_id = String(body.payment_id || "");
  const status = String(body.status || "");
  if (!payment_id || !status) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const { data: rec, error: selErr } = await admin
    .from("payments")
    .select("*")
    .eq("id", payment_id)
    .single();
  if (selErr || !rec) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const upd = await admin.from("payments").update({ status }).eq("id", payment_id);
  if (upd.error) {
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
  if (status === "approved") {
    const tax_data_raw = rec.tax_data || "";
    let summary = "";
    let taxLine = "";
    try {
      const td = JSON.parse(tax_data_raw || "{}");
      summary = String(td.explanation || "");
      taxLine = `Estimated Tax: ${td.estimated_tax ?? ""} ETB`;
    } catch {}
    const pdf = buildPdfContent(String(rec.user_id), summary.slice(0, 800), taxLine);
    try {
      await admin.storage.createBucket("reports", { public: true });
    } catch {}
    const fname = `Tax_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
    const bucket = admin.storage.from("reports");
    const up = await bucket.upload(fname, new Blob([pdf], { type: "application/pdf" }), {
      contentType: "application/pdf",
      upsert: true,
    });
    if (up.error) {
      return NextResponse.json({ error: "upload failed" }, { status: 500 });
    }
    const { data: pub } = bucket.getPublicUrl(fname);
    await admin.from("payments").update({ report_file_id: `reports/${fname}` }).eq("id", payment_id);
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: rec.user_id,
        document: pub.publicUrl,
        caption: "Payment Verified! Here is your official Gibi-Guide Tax Report.",
      }),
    });
  }
  return NextResponse.json({ ok: true });
}
