import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { retry } from '../lib/error-handling';

interface UsePollResultsProps {
  activationId: string | null;
  refreshInterval?: number;
  initialPollState?: 'pending' | 'voting' | 'closed';
}

interface PollVotes {
  [optionId: string]: number;
}

interface PollVotesByText {
  [optionText: string]: number;
}

export function usePollResults({
  activationId,
  refreshInterval = 3000,
  initialPollState = 'pending'
}: UsePollResultsProps) {
  const [votes, setVotes] = useState<PollVotes>({});
  const [votesByText, setVotesByText] = useState<PollVotesByText>({});
  const [totalVotes, setTotalVotes] = useState(0);
  const [pollState, setPollState] = useState<'pending' | 'voting' | 'closed'>(initialPollState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch poll votes
  const fetchVotes = useCallback(async () => {
    if (!activationId) return;

    setIsLoading(true);
    setError(null);

    try {
      // First get the current poll state
      const { data: activation, error: activationError } = await retry(async () => {
        return await supabase
          .from('activations')
          .select('poll_state')
          .eq('id', activationId)
          .single();
      }, 2);

      if (activationError) throw activationError;
      
      if (activation?.poll_state) {
        setPollState(activation.poll_state);
      }

      // Then get the votes
      const { data: voteData, error: voteError } = await retry(async () => {
        return await supabase
          .from('poll_votes')
          .select('option_id, option_text')
          .eq('activation_id', activationId);
      }, 2);

      if (voteError) throw voteError;

      // Process votes
      const newVotes: PollVotes = {};
      const newVotesByText: PollVotesByText = {};
      let newTotalVotes = 0;

      voteData?.forEach(vote => {
        // Count by option ID
        if (vote.option_id) {
          newVotes[vote.option_id] = (newVotes[vote.option_id] || 0) + 1;
        }
        
        // Count by option text
        if (vote.option_text) {
          newVotesByText[vote.option_text] = (newVotesByText[vote.option_text] || 0) + 1;
        }
        
        newTotalVotes++;
      });

      setVotes(newVotes);
      setVotesByText(newVotesByText);
      setTotalVotes(newTotalVotes);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching poll votes:', err);
      setError('Failed to load poll results');
    } finally {
      setIsLoading(false);
    }
  }, [activationId]);

  // Initial fetch and setup polling
  useEffect(() => {
    if (!activationId) return;

    // Initial fetch
    fetchVotes();

    // Set up polling interval
    const intervalId = setInterval(fetchVotes, refreshInterval);

    // Set up real-time subscription
    const subscription = supabase
      .channel(`poll_votes_${activationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'poll_votes',
        filter: `activation_id=eq.${activationId}`
      }, () => {
        fetchVotes();
      })
      .subscribe();

    // Set up subscription for poll state changes
    const stateSubscription = supabase
      .channel(`activation_${activationId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'activations',
        filter: `id=eq.${activationId}`
      }, (payload) => {
        if (payload.new && payload.new.poll_state !== payload.old?.poll_state) {
          setPollState(payload.new.poll_state || 'pending');
          fetchVotes(); // Refresh votes when state changes
        }
      })
      .subscribe();

    return () => {
      clearInterval(intervalId);
      subscription.unsubscribe();
      stateSubscription.unsubscribe();
    };
  }, [activationId, fetchVotes, refreshInterval]);

  return {
    votes,
    votesByText,
    totalVotes,
    pollState,
    isLoading,
    error,
    lastUpdated,
    refreshVotes: fetchVotes
  };
}