import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { retry, isNetworkError, logError } from '../lib/error-handling';
import { submitPollVote, hasPlayerVoted, getPollState } from '../lib/poll-service';

interface PollOption {
  id?: string;
  text: string;
  media_type?: 'none' | 'image' | 'gif';
  media_url?: string;
}

interface PollVote {
  id: string;
  activation_id: string;
  player_id: string;
  option_id: string;
  option_text: string;
  created_at?: string;
}

interface PollVoteCount {
  [optionId: string]: number;
}

interface UsePollManagerProps {
  activationId: string | null;
  options?: PollOption[];
  playerId?: string | null;
}

interface UsePollManagerReturn {
  votes: PollVoteCount;
  votesByText: { [text: string]: number };
  totalVotes: number;
  hasVoted: boolean;
  selectedOptionId: string | null;
  pollState: 'pending' | 'voting' | 'closed';
  isLoading: boolean;
  submitVote: (optionId: string) => Promise<{ success: boolean; error?: string }>;
  resetPoll: () => void;
}

export function usePollManager({ 
  activationId, 
  options = [], 
  playerId 
}: UsePollManagerProps): UsePollManagerReturn {
  const [votes, setVotes] = useState<PollVoteCount>({});
  const [votesByText, setVotesByText] = useState<{ [text: string]: number }>({});
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [pollState, setPollState] = useState<'pending' | 'voting' | 'closed'>('pending');
  const [isLoading, setIsLoading] = useState(false);
  
  const currentActivationIdRef = useRef<string | null>(null);
  const debugIdRef = useRef<string>(`poll-${Math.random().toString(36).substring(2, 7)}`);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const errorCountRef = useRef<number>(0);
  const voteCountRef = useRef<number>(0);

  // Initialize poll data
  const initializePoll = useCallback(async () => {
    if (!activationId) return;
    
    console.log(`[${debugIdRef.current}] Initializing poll for activation: ${activationId}, player: ${playerId || 'none'}`);
    
    // Don't fetch too frequently (throttle to once per second)
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 1000) {
      console.log(`[${debugIdRef.current}] Skipping poll fetch - throttled`);
      return;
    }
    lastFetchTimeRef.current = now;
    
    setIsLoading(true);
    try {
      // Use retry for better error handling
      const { data: activation, error: activationError } = await retry(async () => {
        return await supabase
          .from('activations')
          .select('poll_state, options')
          .eq('id', activationId)
          .single();
      }, 2);
      
      if (activationError) {
        console.error(`[${debugIdRef.current}] Error fetching activation:`, activationError);
        errorCountRef.current++;
        return;
      } else if (activation) {
        console.log(`[${debugIdRef.current}] Activation fetched successfully. Poll state: ${activation.poll_state}`);
        setPollState(activation.poll_state || 'pending');
        
        // Initialize vote counts
        const voteCounts: PollVoteCount = {};
        const textVoteCounts: { [text: string]: number } = {};
        
        // Use options from activation or props
        const pollOptions = activation.options || options;
        
        // Initialize all options to 0
        pollOptions.forEach((option: PollOption) => {
          if (option.id) {
            voteCounts[option.id] = 0;
          }
          textVoteCounts[option.text] = 0;
        });

        // Get all votes for this poll
        const { data: voteData, error: voteError } = await retry(async () => {
          return await supabase
            .from('poll_votes')
            .select('*')
            .eq('activation_id', activationId);
        }, 2);

        if (voteError) {
          console.error(`[${debugIdRef.current}] Error fetching votes:`, voteError);
          errorCountRef.current++;
          return;
        } else if (voteData) {
          console.log(`[${debugIdRef.current}] Fetched ${voteData.length} votes for activation ${activationId}`);
          
          // Count votes
          voteData.forEach((vote: PollVote) => {
            // Count by option ID if available
            if (vote.option_id && voteCounts[vote.option_id] !== undefined) {
              voteCounts[vote.option_id]++;
            }
            
            // Always count by option text
            if (vote.option_text && textVoteCounts[vote.option_text] !== undefined) {
              textVoteCounts[vote.option_text]++;
            }
            
            // Check if current player has voted
            if (playerId && vote.player_id === playerId) {
              setHasVoted(true);
              setSelectedOptionId(vote.option_id);
            }
          });
          
          // Store the vote count for comparison
          voteCountRef.current = voteData.length;
        }

        setVotes(voteCounts);
        setVotesByText(textVoteCounts);
        
        console.log(`[${debugIdRef.current}] Poll initialized with ${Object.values(textVoteCounts).reduce((sum, count) => sum + count, 0)} total votes`);
        console.log(`[${debugIdRef.current}] Vote counts by text:`, textVoteCounts);
        
        // Reset error count on successful fetch
        errorCountRef.current = 0;
      }
    } catch (error) {
      console.error(`[${debugIdRef.current}] Error initializing poll:`, error);
      logError(error, 'usePollManager.initializePoll', playerId || undefined);
      errorCountRef.current++;
    } finally {
      setIsLoading(false);
    }
  }, [activationId, options, playerId]);

  // Reset poll state
  const resetPoll = useCallback(() => {
    console.log(`[${debugIdRef.current}] Resetting poll state`);
    setVotes({});
    setVotesByText({});
    setHasVoted(false);
    setSelectedOptionId(null);
    setPollState('pending');

    // Clear polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    // Reset error count
    errorCountRef.current = 0;
  }, []);

  // Effect to handle activation changes
  useEffect(() => {
    if (activationId !== currentActivationIdRef.current) {
      console.log(`[${debugIdRef.current}] Activation changed from ${currentActivationIdRef.current} to ${activationId}`);
      currentActivationIdRef.current = activationId;
      resetPoll();
    }
  }, [activationId, resetPoll]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!activationId) return;
    console.log(`[${debugIdRef.current}] Setting up poll for activation ${activationId}`);
    
    // Initial fetch
    initializePoll();
    
    // Set up polling interval - more reliable than subscriptions in some cases
    const pollInterval = setInterval(() => {
      initializePoll();
    }, 2000); // Poll every 2 seconds
    
    pollingIntervalRef.current = pollInterval;
    
    // Cleanup
    return () => {
      console.log(`[${debugIdRef.current}] Cleaning up poll for activation ${activationId}`);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [activationId, playerId, initializePoll]);

  // Submit vote
  const submitVote = useCallback(async (optionId: string): Promise<{ success: boolean; error?: string }> => {
    console.log(`[${debugIdRef.current}] Submitting vote for option ${optionId}`);
    if (!activationId || !playerId) {
      return { success: false, error: 'Missing activation or player ID' };
    }

    if (hasVoted) {
      return { success: false, error: 'You have already voted' };
    }

    if (pollState !== 'voting') {
      return { success: false, error: 'Voting is not open' };
    }

    try {
      // Use retry for better error handling
      return await retry(async () => {
        // Find the option
        const option = options.find(opt => opt.id === optionId);
        if (!option) {
          return { success: false, error: 'Invalid option' };
        }

        console.log(`[${debugIdRef.current}] Submitting vote:`, { activationId, playerId, optionId, optionText: option.text });

        // Submit the vote
        const { error } = await supabase
          .from('poll_votes')
          .insert({
            activation_id: activationId,
            player_id: playerId,
            option_id: optionId,
            option_text: option.text
          });

        if (error) {
          // Check for duplicate vote
          if (error.code === '23505') {
            console.log(`[${debugIdRef.current}] Duplicate vote detected`);
            return { success: false, error: 'You have already voted in this poll' };
          }
          throw error;
        }

        // Update local state immediately for optimistic UI
        setHasVoted(true);
        setSelectedOptionId(optionId);
        
        // Update vote counts immediately
        setVotes(prev => ({
          ...prev,
          [optionId]: (prev[optionId] || 0) + 1
        }));
        
        setVotesByText(prev => ({
          ...prev,
          [option.text]: (prev[option.text] || 0) + 1
        }));

        console.log(`[${debugIdRef.current}] Vote submitted successfully`);
        
        // Force a refresh to get the latest data
        setTimeout(initializePoll, 500);
        
        return { success: true };
      }, 3);
    } catch (error: any) {
      console.error(`[${debugIdRef.current}] Error submitting vote:`, error);
      logError(error, 'usePollManager.submitVote', playerId);
      
      // Check if it's a network error
      if (isNetworkError(error)) {
        // Store the vote in local storage for later retry
        try {
          const pendingVotes = JSON.parse(localStorage.getItem('pendingPollVotes') || '[]');
          pendingVotes.push({
            activation_id: activationId,
            player_id: playerId,
            option_id: optionId,
            option_text: options.find(opt => opt.id === optionId)?.text || '',
            created_at: new Date().toISOString()
          });
          localStorage.setItem('pendingPollVotes', JSON.stringify(pendingVotes));
          
          // Update UI optimistically
          console.log(`[${debugIdRef.current}] Vote saved locally due to network error`);
          setHasVoted(true);
          setSelectedOptionId(optionId);
          
          return { 
            success: true, 
            error: 'Your vote was saved locally and will be submitted when connection is restored.' 
          };
        } catch (storageError) {
          console.error('Error saving vote to local storage:', storageError);
        }
        
        return { 
          success: false, 
          error: 'Network error. Your vote will be saved when connection is restored.' 
        };
      }
      
      return { 
        success: false, 
        error: error.message || 'Failed to submit vote. Please try again.' 
      };
    }
  }, [activationId, playerId, hasVoted, pollState, options, initializePoll]);

  // Calculate total votes
  const getTotalVotes = useCallback((): number => {
    // Use votesByText as the source of truth
    console.log(`[${debugIdRef.current}] Calculating total votes from:`, votesByText);
    return Object.values(votesByText).reduce((sum, count) => sum + count, 0);
  }, [votesByText]);

  return {
    votes,
    votesByText,
    totalVotes: getTotalVotes(),
    hasVoted,
    selectedOptionId,
    pollState,
    isLoading,
    submitVote,
    resetPoll
  };
}