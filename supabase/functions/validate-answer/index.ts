import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.8";
import { corsHeaders } from "../_shared/cors.ts";

// Create a Supabase client with the service role key
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  try {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders,
        status: 204,
      });
    }

    // Parse request body
    const requestData = await req.json();
    const { activationId, answer } = requestData;

    if (!activationId || answer === undefined) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Get activation details to determine correct answer
    const { data: activation, error: activationError } = await supabase
      .from("activations")
      .select("type, correct_answer, exact_answer")
      .eq("id", activationId)
      .single();
      
    if (activationError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch activation details" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    // Validate answer based on activation type
    let isCorrect = false;
    
    if (activation.type === "multiple_choice" && activation.correct_answer) {
      isCorrect = answer === activation.correct_answer;
    } else if (activation.type === "text_answer" && activation.exact_answer) {
      // Case-insensitive comparison for text answers
      isCorrect = answer.toLowerCase().trim() === activation.exact_answer.toLowerCase().trim();
    }

    // Prepare response
    const response = {
      isCorrect,
      activationType: activation.type
    };

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error validating answer:", error);
    
    return new Response(
      JSON.stringify({ isValid: false, error: "Internal server error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});