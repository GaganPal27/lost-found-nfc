// Supabase Edge Function: delete-account
// Securely deletes all user data from Supabase + RevenueCat.
// Must use SERVICE_ROLE key (never in the client app).
// DPDP Act 2023 Section 12 — Right to Erasure.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Verify the caller is authenticated (JWT must be valid)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Create a user-scoped client to verify who is calling
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    console.log(`[delete-account] Starting erasure for user: ${userId}`);

    // 3. Create admin client for privileged operations
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 4. Erase all user data in dependency order
    const erasureSteps = [
      // Messages first (they reference conversations and groups)
      adminClient.from("group_messages").delete().eq("sender_id", userId),
      adminClient.from("messages").delete().eq("sender_id", userId),
    ];
    await Promise.all(erasureSteps);

    // Group memberships and conversations
    await adminClient.from("group_members").delete().eq("user_id", userId);
    
    // Find conversations the user is part of
    const { data: convos } = await adminClient
      .from("conversations")
      .select("id")
      .or(`finder_id.eq.${userId},owner_id.eq.${userId}`);
    
    if (convos && convos.length > 0) {
      const convoIds = convos.map((c: any) => c.id);
      await adminClient.from("messages").delete().in("conversation_id", convoIds);
      await adminClient.from("conversations").delete().in("id", convoIds);
    }

    // Community content
    await adminClient.from("community_items").delete().eq("finder_id", userId);
    await adminClient.from("lost_item_posts").delete().eq("poster_id", userId);

    // Registered items (this cascades to scan history via FK if set up)
    await adminClient.from("items").delete().eq("user_id", userId);

    // Push tokens
    await adminClient.from("push_tokens").delete().eq("user_id", userId);

    // The users profile row itself
    await adminClient.from("users").delete().eq("id", userId);

    // 5. Delete from Supabase Auth (this is the hard delete — irreversible)
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      console.error("[delete-account] Auth delete failed:", deleteAuthError.message);
      throw new Error(`Auth deletion failed: ${deleteAuthError.message}`);
    }

    // 6. Delete from RevenueCat (optional — only if REVENUECAT_SECRET_KEY is set)
    const rcKey = Deno.env.get("REVENUECAT_SECRET_KEY");
    if (rcKey) {
      try {
        const rcRes = await fetch(`https://api.revenuecat.com/v1/subscribers/${userId}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${rcKey}` },
        });
        if (!rcRes.ok) {
          console.warn("[delete-account] RevenueCat delete returned:", rcRes.status);
        } else {
          console.log("[delete-account] RevenueCat customer deleted.");
        }
      } catch (rcErr) {
        // Non-fatal — log and continue
        console.warn("[delete-account] RevenueCat delete failed (non-fatal):", rcErr);
      }
    }

    console.log(`[delete-account] Erasure complete for user: ${userId}`);
    return new Response(JSON.stringify({ success: true, message: "Account permanently deleted." }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[delete-account] Unhandled error:", err.message);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
