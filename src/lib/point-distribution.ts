// Add this function to the existing file
export const hasPlayerVotedInPollVotes = async (
  activationId: string, 
  playerId: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('poll_votes')
      .select('id')
      .eq('activation_id', activationId)
      .eq('player_id', playerId)
      .single();
    
    return !!data && !error;
  } catch (error) {
    console.error('Error checking poll vote in poll_votes table:', error);
    return false;
  }
};

// Update the recordPollVote function to check poll_votes table first
export const recordPollVote = async (
  activationId: string,
  playerId: string,
  answer: string
): Promise<boolean> => {
  try {
    // First check if player has already voted in poll_votes table
    const hasVotedInPollVotes = await hasPlayerVotedInPollVotes(activationId, playerId);
    if (hasVotedInPollVotes) {
      console.log('Player has already voted in poll_votes table');
      return false;
    }
    
    // Check if player has already voted in player_answers table
    const hasVoted = await hasPlayerVoted(activationId, playerId);
    if (hasVoted) {
      console.log('Player has already voted in this poll');
      return false;
    }
    
    // Record vote in poll_votes table
    const { error: pollVoteError } = await supabase
      .from('poll_votes')
      .insert({
        activation_id: activationId,
        player_id: playerId,
        vote_option: answer
      });
    
    if (pollVoteError) {
      console.error('Error recording poll vote:', pollVoteError);
      return false;
    }
    
    // Also record in player_answers for consistency
    const { error: answerError } = await supabase
      .from('player_answers')
      .insert({
        activation_id: activationId,
        player_id: playerId,
        answer: answer,
        is_correct: false,
        points_awarded: 0
      });
    
    if (answerError) {
      console.error('Error recording player answer:', answerError);
      // Don't fail if this errors, the vote is already recorded
    }
    
    return true;
  } catch (error) {
    console.error('Error in recordPollVote:', error);
    return false;
  }
};

// Update the hasPlayerVoted function to check both tables
export const hasPlayerVoted = async (
  activationId: string,
  playerId: string
): Promise<boolean> => {
  try {
    // Check poll_votes table first
    const hasVotedInPollVotes = await hasPlayerVotedInPollVotes(activationId, playerId);
    if (hasVotedInPollVotes) {
      return true;
    }
    
    // Then check player_answers table
    const hasAnswered = await hasPlayerAnswered(activationId, playerId);
    return hasAnswered;
  } catch (error) {
    console.error('Error checking if player voted:', error);
    return false;
  }
};

// Update getPlayerPollVote to check both tables
export const getPlayerPollVote = async (
  activationId: string,
  playerId: string
): Promise<string | null> => {
  try {
    // First check poll_votes table
    const { data: pollVoteData, error: pollVoteError } = await supabase
      .from('poll_votes')
      .select('vote_option')
      .eq('activation_id', activationId)
      .eq('player_id', playerId)
      .single();
    
    if (pollVoteData && !pollVoteError) {
      return pollVoteData.vote_option;
    }
    
    // Fall back to player_answers table
    const { data, error } = await supabase
      .from('player_answers')
      .select('answer')
      .eq('activation_id', activationId)
      .eq('player_id', playerId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data.answer;
  } catch (error) {
    console.error('Error getting player poll vote:', error);
    return null;
  }
};