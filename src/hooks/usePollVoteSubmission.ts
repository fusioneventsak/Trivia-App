import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { logError } from '../lib/error-handling';

interface UsePollVoteSubmissionProps {
  activationId: string | null;
  playerId: string | null;
}

interface SubmitVoteResult {
  success: boolean;
  error?: string;
}

export function usePollVoteSubmission({ activationId, playerId }: UsePollVoteSubmissionProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastSubmittedVote, setLastSubmittedVote] = useState<{
    optionId: string;
    optionText: string;
  } | null>(null);

  const submitVote = useCallback(
    async (optionId: string, optionText: string): Promise<SubmitVoteResult> => {
      if (!activationId || !playerId) {
        return { success: false, error: 'Missing activation or player ID' };
      }

      setIsSubmitting(true);
      setLastError(null);

      try {
        // Check if player has already voted
        const { data: existingVote, error: checkError } = await supabase
          .from('poll_votes')
          .select('id')
          .eq('activation_id', activationId)
          .eq('player_id', playerId)
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
            activation_id: activationId,
            player_id: playerId,
            option_id: optionId,
            option_text: optionText
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
          activation_id: activationId,
          player_id: playerId,
          event_data: {
            option_id: optionId,
            option_text: optionText
          }
        });

        // Store the last submitted vote
        setLastSubmittedVote({ optionId, optionText });
        
        return { success: true };
      } catch (error) {
        console.error('Error submitting poll vote:', error);
        logError(error, 'usePollVoteSubmission.submitVote', playerId || undefined);
        
        const errorMessage = error instanceof Error ? error.message : 'Failed to submit vote';
        setLastError(errorMessage);
        
        // Try to store the failed vote in the error table
        try {
          await supabase.from('poll_vote_errors').insert({
            activation_id: activationId,
            player_id: playerId,
            option_id: optionId,
            option_text: optionText,
            error_message: errorMessage
          });
        } catch (storeError) {
          console.error('Failed to store error vote:', storeError);
        }
        
        return { success: false, error: errorMessage };
      } finally {
        setIsSubmitting(false);
      }
    },
    [activationId, playerId]
  );

  return {
    submitVote,
    isSubmitting,
    lastError,
    lastSubmittedVote
  };
}