import { supabase } from './supabase';
import { retry, isNetworkError, logError } from './error-handling';

interface PollVoteRequest {
  activationId: string;
  playerId: string;
  optionId: string;
  optionText: string;
}

interface PollVoteResponse {
  success: boolean;
  error?: string;
}

interface PollVotes {
  [optionId: string]: number;
}

interface PollVotesByText {
  [optionText: string]: number;
}

interface PollResults {
  votes: PollVotes;
  votesByText: PollVotesByText;
  totalVotes: number;
}

/**
 * Submit a vote for a poll
 */
export async function submitPollVote(request: PollVoteRequest): Promise<PollVoteResponse> {
  try {
    // Check if player has already voted
    const { data: existingVote, error: checkError } = await supabase
      .from('poll_votes')
      .select('id')
      .eq('activation_id', request.activationId)
      .eq('player_id', request.playerId)
      .maybeSingle();

    if (checkError) {
      throw checkError;
    }

    if (existingVote) {
      return { success: false, error: 'You have already voted in this poll' };
    }

    // Submit the vote
    const { error: insertError } = await supabase
      .from('poll_votes')
      .insert({
        activation_id: request.activationId,
        player_id: request.playerId,
        option_id: request.optionId,
        option_text: request.optionText
      });

    if (insertError) {
      // Check for unique constraint violation
      if (insertError.code === '23505') {
        return { success: false, error: 'You have already voted in this poll' };
      }
      throw insertError;
    }

    // Log analytics event
    await supabase.from('analytics_events').insert({
      event_type: 'poll_vote',
      activation_id: request.activationId,
      player_id: request.playerId,
      event_data: {
        option_id: request.optionId,
        option_text: request.optionText
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Error submitting poll vote:', error);
    logError(error, 'poll-service.submitPollVote', request.playerId);
    
    // If it's a network error, store the vote for later retry
    if (isNetworkError(error)) {
      try {
        // Store in local storage for later retry
        const pendingVotes = JSON.parse(localStorage.getItem('pendingPollVotes') || '[]');
        pendingVotes.push({
          activation_id: request.activationId,
          player_id: request.playerId,
          option_id: request.optionId,
          option_text: request.optionText,
          created_at: new Date().toISOString()
        });
        localStorage.setItem('pendingPollVotes', JSON.stringify(pendingVotes));
        
        return { 
          success: true, 
          error: 'Your vote was saved locally and will be submitted when connection is restored.' 
        };
      } catch (storageError) {
        console.error('Error saving vote to local storage:', storageError);
      }
      
      return { 
        success: false, 
        error: 'Network error. Please check your connection and try again.' 
      };
    }
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to submit vote' 
    };
  }
}

/**
 * Get poll results for an activation
 */
export async function getPollResults(activationId: string): Promise<PollResults> {
  try {
    // Use retry for better error handling
    const { data, error } = await retry(async () => {
      return await supabase
        .from('poll_votes')
        .select('option_id, option_text')
        .eq('activation_id', activationId);
    }, 2);

    if (error) throw error;

    // Process votes
    const votes: PollVotes = {};
    const votesByText: PollVotesByText = {};
    let totalVotes = 0;

    data?.forEach(vote => {
      // Count by option ID
      if (vote.option_id) {
        votes[vote.option_id] = (votes[vote.option_id] || 0) + 1;
      }
      
      // Count by option text
      if (vote.option_text) {
        votesByText[vote.option_text] = (votesByText[vote.option_text] || 0) + 1;
      }
      
      totalVotes++;
    });

    return { votes, votesByText, totalVotes };
  } catch (error) {
    console.error('Error fetching poll results:', error);
    logError(error, 'poll-service.getPollResults');
    return { votes: {}, votesByText: {}, totalVotes: 0 };
  }
}

/**
 * Check if a player has already voted in a poll
 */
export async function hasPlayerVoted(activationId: string, playerId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('poll_votes')
      .select('id')
      .eq('activation_id', activationId)
      .eq('player_id', playerId)
      .maybeSingle();

    if (error) throw error;
    
    return !!data;
  } catch (error) {
    console.error('Error checking if player voted:', error);
    return false;
  }
}

/**
 * Get the current poll state
 */
export async function getPollState(activationId: string): Promise<'pending' | 'voting' | 'closed'> {
  try {
    const { data, error } = await supabase
      .from('activations')
      .select('poll_state')
      .eq('id', activationId)
      .single();

    if (error) throw error;
    
    return data.poll_state || 'pending';
  } catch (error) {
    console.error('Error getting poll state:', error);
    return 'pending';
  }
}

/**
 * Process any pending votes stored in local storage
 */
export async function processPendingVotes(): Promise<number> {
  try {
    const pendingVotesJson = localStorage.getItem('pendingPollVotes');
    if (!pendingVotesJson) return 0;
    
    const pendingVotes = JSON.parse(pendingVotesJson);
    if (!Array.isArray(pendingVotes) || pendingVotes.length === 0) return 0;
    
    let successCount = 0;
    const remainingVotes = [];
    
    for (const vote of pendingVotes) {
      try {
        const { error } = await supabase
          .from('poll_votes')
          .insert({
            activation_id: vote.activation_id,
            player_id: vote.player_id,
            option_id: vote.option_id,
            option_text: vote.option_text
          });
          
        if (!error) {
          successCount++;
        } else {
          // If it's not a duplicate vote error, keep it for retry
          if (error.code !== '23505') {
            remainingVotes.push(vote);
          } else {
            // Duplicate votes still count as "processed"
            successCount++;
          }
        }
      } catch (error) {
        console.error('Error processing pending vote:', error);
        remainingVotes.push(vote);
      }
    }
    
    // Update local storage with remaining votes
    localStorage.setItem('pendingPollVotes', JSON.stringify(remainingVotes));
    
    return successCount;
  } catch (error) {
    console.error('Error processing pending votes:', error);
    return 0;
  }
}