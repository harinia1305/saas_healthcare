import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface RefundCalculationResult {
  calculated_amount: number;
  processing_fee: number;
  net_amount: number;
}

async function calculateRefund(
  originalPayment: number,
  refundType: string,
  billId?: string
): Promise<RefundCalculationResult> {
  const { data, error } = await supabase
    .rpc("calculate_refund_amount", {
      p_original_payment: originalPayment,
      p_refund_type: refundType,
      p_bill_id: billId ?? null,
    });

  if (error) throw new Error(`Refund calculation failed: ${error.message}`);
  if (!data || data.length === 0) throw new Error("No calculation result returned");

  return {
    calculated_amount: Number(data[0].calculated_amount),
    processing_fee: Number(data[0].processing_fee),
    net_amount: Number(data[0].net_amount),
  };
}

function isValidTransition(from: string, to: string): boolean {
  const transitions: Record<string, string[]> = {
    pending: ["calculated", "cancelled"],
    calculated: ["approved", "denied", "cancelled"],
    approved: ["processing", "denied", "cancelled"],
    processing: ["completed", "denied"],
    completed: [],
    denied: [],
    cancelled: [],
  };
  return transitions[from]?.includes(to) ?? false;
}

async function logAudit(
  action: string,
  tableName: string,
  recordId: string,
  context: string
): Promise<void> {
  await supabase.from("audit_logs").insert({
    actor_name: "Refund Pipeline Worker",
    actor_role: "system",
    action,
    table_name: tableName,
    record_id: recordId,
    phi_accessed: true,
    access_context: context,
  });
}

async function processAdvance(refundId: string) {
  const { data: refund, error } = await supabase
    .from("refunds")
    .select("*")
    .eq("id", refundId)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch refund: ${error.message}`);
  if (!refund) throw new Error(`Refund ${refundId} not found`);

  // Auto-calculate pending refunds
  if (refund.status === "pending") {
    const calc = await calculateRefund(
      Number(refund.original_payment_amount),
      refund.refund_type,
      refund.bill_id
    );

    const { error: updateErr } = await supabase
      .from("refunds")
      .update({
        status: "calculated",
        calculated_refund_amount: calc.calculated_amount,
        processing_fee: calc.processing_fee,
        net_refund_amount: calc.net_amount,
        calculated_at: new Date().toISOString(),
      })
      .eq("id", refundId);

    if (updateErr) throw new Error(`Failed to advance to calculated: ${updateErr.message}`);

    await logAudit("UPDATE", "refunds", refundId, `Auto-calculated refund: ${calc.net_amount}`);
    return { status: "calculated", calculation: calc };
  }

  // Auto-approve small refunds under $50
  if (refund.status === "calculated" && Number(refund.calculated_refund_amount) <= 50) {
    const { error: updateErr } = await supabase
      .from("refunds")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: "Auto-approval (under $50 threshold)",
      })
      .eq("id", refundId);

    if (updateErr) throw new Error(`Failed to auto-approve: ${updateErr.message}`);

    await logAudit("UPDATE", "refunds", refundId, "Auto-approved refund (under $50)");
    return { status: "approved", auto_approved: true };
  }

  return { status: refund.status, message: "No automatic action taken — manual action required" };
}

async function processBatch() {
  const { data: pendingRefunds, error } = await supabase
    .from("refunds")
    .select("id, status, refund_number")
    .in("status", ["pending", "calculated"])
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to fetch pending refunds: ${error.message}`);

  const results: Array<{ refund_number: string; result: any }> = [];
  for (const r of pendingRefunds ?? []) {
    try {
      const result = await processAdvance(r.id);
      results.push({ refund_number: r.refund_number, result });
    } catch (err) {
      results.push({ refund_number: r.refund_number, result: { error: err.message } });
    }
  }

  return { processed: results.length, results };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // POST /refund-pipeline — process a single refund advance
    // POST /refund-pipeline?batch=true — process all pending/calculated refunds
    if (req.method === "POST") {
      const isBatch = url.searchParams.get("batch") === "true";

      if (isBatch) {
        const result = await processBatch();
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { refund_id, action } = body;

      if (!refund_id) {
        return new Response(
          JSON.stringify({ error: "refund_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (action === "advance") {
        const result = await processAdvance(refund_id);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "approve") {
        const { approved_by } = body;
        const { data: refund } = await supabase
          .from("refunds")
          .select("status, refund_number")
          .eq("id", refund_id)
          .maybeSingle();

        if (!refund) {
          return new Response(JSON.stringify({ error: "Refund not found" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (!isValidTransition(refund.status, "approved")) {
          return new Response(
            JSON.stringify({ error: `Cannot approve from status: ${refund.status}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: updateErr } = await supabase
          .from("refunds")
          .update({
            status: "approved",
            approved_at: new Date().toISOString(),
            approved_by: approved_by || "Billing Admin",
          })
          .eq("id", refund_id);

        if (updateErr) throw new Error(updateErr.message);

        await logAudit("UPDATE", "refunds", refund_id, `Manually approved by ${approved_by}`);
        return new Response(JSON.stringify({ status: "approved" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "deny") {
        const { denied_reason } = body;
        const { data: refund } = await supabase
          .from("refunds")
          .select("status")
          .eq("id", refund_id)
          .maybeSingle();

        if (!refund) {
          return new Response(JSON.stringify({ error: "Refund not found" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (!isValidTransition(refund.status, "denied")) {
          return new Response(
            JSON.stringify({ error: `Cannot deny from status: ${refund.status}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: updateErr } = await supabase
          .from("refunds")
          .update({
            status: "denied",
            denied_at: new Date().toISOString(),
            denied_reason: denied_reason || "Denied by administrator",
          })
          .eq("id", refund_id);

        if (updateErr) throw new Error(updateErr.message);

        await logAudit("UPDATE", "refunds", refund_id, `Refund denied: ${denied_reason}`);
        return new Response(JSON.stringify({ status: "denied" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "process") {
        const { data: refund } = await supabase
          .from("refunds")
          .select("status")
          .eq("id", refund_id)
          .maybeSingle();

        if (!refund) {
          return new Response(JSON.stringify({ error: "Refund not found" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (!isValidTransition(refund.status, "processing")) {
          return new Response(
            JSON.stringify({ error: `Cannot process from status: ${refund.status}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: updateErr } = await supabase
          .from("refunds")
          .update({
            status: "processing",
            processed_at: new Date().toISOString(),
          })
          .eq("id", refund_id);

        if (updateErr) throw new Error(updateErr.message);

        // Simulate payment processing, then mark completed
        const { error: completeErr } = await supabase
          .from("refunds")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            processing_notes: "Payment sent via original payment method",
          })
          .eq("id", refund_id);

        if (completeErr) throw new Error(completeErr.message);

        await logAudit("UPDATE", "refunds", refund_id, "Refund processed and completed");
        return new Response(JSON.stringify({ status: "completed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /refund-pipeline — return pipeline status summary
    if (req.method === "GET") {
      const { data: refunds, error } = await supabase
        .from("refunds")
        .select("id, status, refund_number, net_refund_amount, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw new Error(error.message);

      const summary: Record<string, { count: number; total: number }> = {};
      for (const r of refunds ?? []) {
        const s = r.status;
        if (!summary[s]) summary[s] = { count: 0, total: 0 };
        summary[s].count++;
        summary[s].total += Number(r.net_refund_amount);
      }

      return new Response(JSON.stringify({ summary, refunds }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
