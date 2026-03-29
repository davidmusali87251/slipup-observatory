/**
 * Edge Function: resonancia textual (PR3a stub).
 * Deploy: npx supabase functions deploy text-resonance
 *
 * CORS: el cliente envía apikey, Authorization, x-slipup-fp, x-slipup-geo.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-slipup-fp, x-slipup-geo",
  "Access-Control-Max-Age": "86400",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // PR3a stub — PR3b: embeddings + scores por id.
  const payload = {
    modelVersion: "stub-0",
    computeVersion: 1,
    scores: null as null | Record<string, number>,
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
