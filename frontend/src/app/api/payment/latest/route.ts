import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "env missing" }, { status: 500 });
  }
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get("user_id") || "";
  if (!user_id) return NextResponse.json({ error: "user_id missing" }, { status: 400 });
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/payments?user_id=eq.${encodeURIComponent(user_id)}&select=*`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: "return=representation",
      },
    }
  );
  const arr = await res.json();
  arr.sort((a: any, b: any) => (a.id > b.id ? -1 : 1));
  const latest = arr[0] || null;
  let file_url = null;
  if (latest?.report_file_id) {
    file_url = `${SUPABASE_URL}/storage/v1/object/public/${latest.report_file_id}`;
  }
  return NextResponse.json({ latest_status: latest?.status || null, file_url });
}
