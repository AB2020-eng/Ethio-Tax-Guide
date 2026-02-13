import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const admin = supabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "env missing" }, { status: 500 });
  }
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get("user_id") || "";
  if (!user_id) return NextResponse.json({ error: "user_id missing" }, { status: 400 });
  const { data: arr, error } = await admin
    .from("payments")
    .select("*")
    .eq("user_id", Number(user_id));
  if (error) {
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
  arr.sort((a: any, b: any) => (a.id > b.id ? -1 : 1));
  const latest = arr[0] || null;
  let file_url = null;
  if (latest?.status === "approved") {
    const { data } = admin.storage.from("reports").getPublicUrl(`${latest.id}.pdf`);
    file_url = data.publicUrl;
  }
  return NextResponse.json({ latest_status: latest?.status || null, file_url });
}
