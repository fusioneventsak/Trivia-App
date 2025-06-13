/*
  # Enhance Room Reset Functionality
  
  1. Changes
     - Add function for resetting player scores and stats
     - Add function for completely resetting a room (removing players)
     - Add analytics event tracking for room resets
     
  2. Description
    This migration adds two functions for proper room reset functionality
    while preserving player accounts in the room when needed.
*/

-- Create function to reset scores for a room but keep players
CREATE OR REPLACE FUNCTION reset_room_scores(p_room_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE players
  SET 
    score = 0,
    stats = jsonb_build_object(
      'totalPoints', 0, 
      'correctAnswers', 0,
      'totalAnswers', 0,
      'averageResponseTimeMs', 0
    )
  WHERE room_id = p_room_id;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Also clear current activation in game_sessions
  UPDATE game_sessions
  SET current_activation = null
  WHERE room_id = p_room_id;
  
  -- Log analytics event
  INSERT INTO analytics_events (
    event_type,
    room_id,
    event_data
  ) VALUES (
    'room_reset',
    p_room_id,
    jsonb_build_object(
      'type', 'scores_only',
      'players_affected', v_count,
      'timestamp', CURRENT_TIMESTAMP
    )
  );
  
  RETURN v_count;
END;
$$;

-- Create function for completely resetting a room
CREATE OR REPLACE FUNCTION reset_room_complete(p_room_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Count players before deletion
  SELECT COUNT(*) INTO v_count FROM players WHERE room_id = p_room_id;
  
  -- Delete all players
  DELETE FROM players
  WHERE room_id = p_room_id;
  
  -- Clear current activation in game_sessions
  UPDATE game_sessions
  SET current_activation = null
  WHERE room_id = p_room_id;
  
  -- Log analytics event
  INSERT INTO analytics_events (
    event_type,
    room_id,
    event_data
  ) VALUES (
    'room_reset',
    p_room_id,
    jsonb_build_object(
      'type', 'complete_reset',
      'players_removed', v_count,
      'timestamp', CURRENT_TIMESTAMP
    )
  );
  
  RETURN v_count;
END;
$$;