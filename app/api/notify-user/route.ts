import { createClient } from '@supabase/supabase-js';

// Server-side notification trigger — uses service_role key so the
// edge function receives a trusted caller and can log to notification_log.
export async function POST(request: Request) {
  try {
    const { type, proposal_id } = await request.json() as { type: string; proposal_id: string };
    if (!type || !proposal_id) return json({ error: 'Missing type or proposal_id' }, 400);

    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/notify-status-change`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ type, proposal_id }),
    });

    const data = await res.json().catch(() => ({}));
    return json({ ok: true, data }, 200);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
