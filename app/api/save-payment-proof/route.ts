import { createClient } from '@supabase/supabase-js';

// Server-side route — runs with service_role key so RLS can't block it.
// Called by PaymentProofModal after a successful R2 upload.
export async function POST(request: Request) {
  try {
    const { proposal_id, url, plan, proof_type } = await request.json() as {
      proposal_id: string;
      url: string;
      plan: string;
      proof_type: string;
    };

    if (!proposal_id || !url) {
      return json({ error: 'Missing proposal_id or url' }, 400);
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { error } = await supabase.from('proposals').update({
      payment_proof_url:    url,
      payment_proof_status: 'pending',
      payment_proof_plan:   plan ?? 'Rishta Profile',
      payment_proof_type:   proof_type ?? 'new',
    }).eq('id', proposal_id);

    if (error) return json({ error: error.message }, 500);

    // Fire notification (non-blocking)
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/notify-status-change`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ type: 'payment_proof_submitted', proposal_id }),
    }).catch(() => {});

    return json({ ok: true }, 200);
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
