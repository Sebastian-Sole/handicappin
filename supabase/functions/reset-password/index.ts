import { createClient } from "jsr:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import ResetPasswordEmail from "./email.tsx";
import { render } from "https://esm.sh/@react-email/components@0.0.22";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.4/mod.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);
const JWT_SECRET = Deno.env.get("RESET_TOKEN_SECRET")!;

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const { email, resetLinkBase } = await req.json();
    if (!email) throw new Error("Email is required");

    const { data: user, error } = await supabase
      .from("Profile")
      .select("id")
      .eq("email", email)
      .single();

    if (error || !user) {
      console.error(error);
      throw new Error("User not found");
    }

    let token = "";

    const key = await crypto.subtle.importKey(
      "raw", // Key format
      new TextEncoder().encode(JWT_SECRET), // Convert JWT_SECRET to Uint8Array
      { name: "HMAC", hash: "SHA-256" }, // Algorithm settings
      false, // Whether the key is extractable
      ["sign", "verify"] // Key usage
    );

    try {
      const payload = {
        user_id: user.id,
        exp: getNumericDate(60 * 60), // 1 hour expiration
      };

      token = await create({ alg: "HS256", typ: "JWT" }, payload, key);
    } catch (error) {
      console.error("Error creating token:", error);
      throw new Error("Error creating token");
    }

    const resetLink = `${resetLinkBase}?token=${token}`;

    const emailHtml = render(
      ResetPasswordEmail({ resetLink, username: email })
    );

    await resend.emails.send({
      from: "Handicappin' <sebastiansole@handicappin.com>",
      to: email,
      subject: "Reset Password Request",
      html: emailHtml,
    });

    return new Response("Password reset email sent", {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: corsHeaders,
    });
  }
});
