import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.8";
import { AnswerRequest, AnswerResponse } from "../_shared/types.ts";
import { calculatePoints } from "../_shared/utils.ts";
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
    const requestData: AnswerRequest = await req.json();
    const { activationId, playerId, playerName, answer, timeTakenMs, roomId } = requestData;

    if (!activationId || !playerId || !roomId) {
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

    // Convert time taken to seconds
    const timeTakenSeconds = timeTakenMs / 1000;
    
    // Calculate points based on correctness and time taken
    const pointsAwarded = isCorrect ? calculatePoints(timeTakenSeconds) : 0;

    // Get current player data
    const { data: playerData, error: playerError } = await supabase
      .from("players")
      .select("score, stats")
      .eq("id", playerId)
      .single();
      
    if (playerError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch player data" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    // Calculate new score
    const currentScore = playerData.score || 0;
    const newScore = currentScore + pointsAwarded;
    
    // Get current stats or create default stats object
    let stats = playerData.stats || {
      totalPoints: 0,
      correctAnswers: 0, 
      totalAnswers: 0,
      averageResponseTimeMs: 0
    };
    
    // Calculate new stats
    const totalAnswers = stats.totalAnswers + 1;
    const correctAnswers = stats.correctAnswers + (isCorrect ? 1 : 0);
    const totalPoints = stats.totalPoints + pointsAwarded;
    
    // Calculate new average response time (weighted average)
    const prevTotalTime = stats.averageResponseTimeMs * stats.totalAnswers;
    const newTotalTime = prevTotalTime + timeTakenMs;
    const averageResponseTimeMs = totalAnswers > 0 ? newTotalTime / totalAnswers : 0;
    
    // Update player score and stats in database
    const { error: updateError } = await supabase
      .from("players")
      .update({ 
        score: newScore,
        stats: {
          totalPoints,
          correctAnswers,
          totalAnswers,
          averageResponseTimeMs
        }
      })
      .eq("id", playerId);
      
    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to update player score" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    // Prepare response
    const response: AnswerResponse = {
      success: true,
      isCorrect,
      pointsAwarded,
      newScore,
      stats: {
        totalPoints,
        correctAnswers,
        totalAnswers,
        averageResponseTimeMs
      }
    };

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error calculating points:", error);
    
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});