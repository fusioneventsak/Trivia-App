import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { retry, isNetworkError, logError } from '../lib/error-handling';

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
  roomId?: string | null;
  debugMode?: boolean;
}

interface UsePollManagerReturn {
  votes: PollVoteCount;
  votesByText: { [text: string]: number };
  totalVotes: number;
  hasVoted: boolean;
  selectedOptionId: string | null;
  pollState: 'pending' | 'voting' | 'closed';
  isLoading: boolean;
  lastUpdated: number;
  pollingInterval: number;
  submitVote: (optionId: string) => Promise<{ success: boolean; error?: string }>;
  resetPoll: () => void;
}

export function usePollManager({ 
  activationId, 
  options = [], 
  playerId,
  roomId,
  debugMode = false
}: UsePollManagerProps): UsePollManagerReturn {
  const [votes, setVotes] = useState<PollVoteCount>({});
  const [votesByText, setVotesByText] = useState<{ [text: string]: number }>({});
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [pollState, setPollState] = useState<'pending' | 'voting' | 'closed'>('pending');
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [pollingInterval, setPollingInterval] = useState<number>(2000); // Start with 2 seconds
  
  const currentActivationIdRef = useRef<string | null>(null);
  const debugIdRef = useRef<string>(`poll-${Math.random().toString(36).substring(2, 7)}`);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const errorCountRef = useRef<number>(0);
  const voteCountRef = useRef<number>(0);
  const noChangeCountRef = useRef<number>(0);
  const lastVoteCountRef = useRef<number>(0);
  const lastVotesRef = useRef<PollVoteCount>({});
  const lastVotesByTextRef = useRef<{ [text: string]: number }>({});
  const subscriptionRef = useRef<any>(null);

  // Initialize poll data
  const initializePoll = useCallback(async () => {
    if (!activationId) return;
    
    if (debugMode) {
      console.log(`[${debugIdRef.current}] Initializing poll for activation: ${activationId}, player: ${playerId || 'none'}, room: ${roomId || 'none'}, interval: ${pollingInterval}ms`);
    }
   
    // Force poll state update from database
    try {
      const { data: activation, error } = await supabase
        .from('activations')
        .select('poll_state')
        .eq('id', activationId)
        .single();
        
      if (!error && activation && activation.poll_state) {
       if (debugMode && pollState !== activation.poll_state) {
         console.log(`[${debugIdRef.current}] Poll state changed: ${pollState} -> ${activation.poll_state}`);
       }
        setPollState(activation.poll_state);
        
        if (debugMode) {
          console.log(`[${debugIdRef.current}] Updated poll state from database: ${activation.poll_state}`);
        }
      }
    } catch (err) {
      console.error('Error fetching poll state:', err);
    }
    
    if (debugMode) {
      console.log(`[${debugIdRef.current}] Initializing poll for activation: ${activationId}, player: ${playerId || 'none'}, room: ${roomId || 'none'}, interval: ${pollingInterval}ms`);
    }
    
    // Don't fetch too frequently (throttle to once per second)
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 1000) {
      if (debugMode) {
        console.log(`[${debugIdRef.current}] Skipping poll fetch - throttled`);
      }
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
        
        // If we've had multiple consecutive errors, increase polling interval
        if (errorCountRef.current >= 3) {
          const newInterval = Math.min(30000, pollingInterval * 2); // Max 30 seconds
          if (newInterval !== pollingInterval) {
            if (debugMode) {
              console.log(`[${debugIdRef.current}] Increasing polling interval due to errors: ${pollingInterval}ms -> ${newInterval}ms`);
            }
            setPollingInterval(newInterval);
          }
        }
        return;
      } else if (activation) {
        if (debugMode) {
          console.log(`[${debugIdRef.current}] Activation fetched successfully. Poll state: ${activation.poll_state}`);
        }
        setPollState(activation.poll_state || 'pending');
        
        // Reset error count on successful fetch
        errorCountRef.current = 0;
        
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
          const currentVoteCount = voteData.length;
          
          // Check if vote count has changed
          if (currentVoteCount === lastVoteCountRef.current) {
            // No change in vote count
            noChangeCountRef.current++;
            
            if (debugMode) {
              console.log(`[${debugIdRef.current}] No change in vote count (${currentVoteCount}), consecutive no-changes: ${noChangeCountRef.current}, current interval: ${pollingInterval}ms`);
            }
            
            // If no changes for several polls, increase polling interval
            if (noChangeCountRef.current >= 3 && pollState === 'voting') {
              const newInterval = Math.min(10000, Math.round(pollingInterval * 1.5)); // Max 10 seconds
              if (newInterval !== pollingInterval) {
                if (debugMode) {
                  console.log(`[${debugIdRef.current}] Increasing polling interval due to inactivity: ${pollingInterval}ms -> ${newInterval}ms`);
                }
                setPollingInterval(newInterval);
              }
            }
            
            // If no changes and we already have vote data, skip processing
            if (Object.keys(lastVotesRef.current).length > 0) {
              setIsLoading(false);
              return;
            }
          } else {
            // Vote count changed, reset counters and polling interval
            noChangeCountRef.current = 0;
            lastVoteCountRef.current = currentVoteCount;
            
            if (pollingInterval > 2000) {
              if (debugMode) {
                console.log(`[${debugIdRef.current}] Vote count changed, resetting polling interval to 2000ms`);
              }
              setPollingInterval(2000);
            }
          }
          
          if (debugMode) {
            console.log(`[${debugIdRef.current}] Fetched ${voteData.length} votes for activation ${activationId}`);
          }
          
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
          
          // Update refs for comparison in next poll
          lastVotesRef.current = voteCounts;
          lastVotesByTextRef.current = textVoteCounts;
        }

        setVotes(voteCounts);
        setVotesByText(textVoteCounts);
        setLastUpdated(Date.now());
        
        if (debugMode) {
          console.log(`[${debugIdRef.current}] Poll initialized with ${Object.values(textVoteCounts).reduce((sum, count) => sum + count, 0)} total votes`);
          console.log(`[${debugIdRef.current}] Vote counts by text:`, textVoteCounts);
        }
      }
    } catch (error) {
      console.error(`[${debugIdRef.current}] Error initializing poll:`, error);
      logError(error, 'usePollManager.initializePoll', playerId || undefined);
      errorCountRef.current++;
    } finally {
      setIsLoading(false);
    }
  }, [activationId, options, playerId, roomId, pollingInterval, debugMode, pollState]);

  // Reset poll state
  const resetPoll = useCallback(() => {
    if (debugMode) {
      console.log(`[${debugIdRef.current}] Resetting poll state`);
    }
    setVotes({});
    setVotesByText({});
    setHasVoted(false);
    setSelectedOptionId(null);
    setPollState('pending');
    setPollingInterval(2000); // Reset to default interval
    noChangeCountRef.current = 0;
    lastVoteCountRef.current = 0;
    errorCountRef.current = 0;
    lastVotesRef.current = {};
    lastVotesByTextRef.current = {};

    // Clear polling timeout
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
    
    // Clear subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
  }, [debugMode]);

  // Effect to handle activation changes
  useEffect(() => {
    if (activationId !== currentActivationIdRef.current) {
      if (debugMode) {
        console.log(`[${debugIdRef.current}] Activation changed from ${currentActivationIdRef.current} to ${activationId}`);
      }
      currentActivationIdRef.current = activationId;
      resetPoll();
    }
  }, [activationId, resetPoll, debugMode]);

  // Set up polling and subscriptions
  useEffect(() => {
    if (!activationId) return;
    
    if (debugMode) {
      console.log(`[${debugIdRef.current}] Setting up poll for activation ${activationId}`);
    }
    
    // Initial fetch
    initializePoll();
    
    // Set up polling with dynamic interval
    const setupPolling = () => {
      // Clear any existing timeout
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
      
      // Set new timeout with current interval
      pollingTimeoutRef.current = setTimeout(() => {
        initializePoll().finally(() => {
          // Continue polling
          setupPolling();
        });
      }, pollingInterval);
    };
    
    // Start polling
    setupPolling();
    
    // Set up subscription for real-time updates as a fallback/enhancement
    try {
      // Subscribe to poll votes for this activation
      subscriptionRef.current = supabase.channel(`poll_votes_${activationId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'poll_votes',
          filter: `activation_id=eq.${activationId}`
        }, () => {
          // When a new vote comes in, reset to fast polling
          if (pollingInterval > 2000) {
            if (debugMode) {
              console.log(`[${debugIdRef.current}] New vote detected via subscription, resetting polling interval to 2000ms`);
            }
            setPollingInterval(2000);
            noChangeCountRef.current = 0;
          }
          
          // Trigger an immediate poll to get the latest data
          initializePoll();
        })
        .subscribe();
        
      // Subscribe to activation changes for poll state updates
      supabase.channel(`activation_${activationId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'activations',
          filter: `id=eq.${activationId}`
        }, (payload) => {
          if (payload.new && payload.new.poll_state !== payload.old?.poll_state) {
            if (debugMode) {
              console.log(`[${debugIdRef.current}] Poll state changed: ${payload.old?.poll_state} -> ${payload.new.poll_state}`);
            }
            setPollState(payload.new.poll_state || 'pending');
            
            // When poll state changes to voting, force an immediate poll
            if (payload.new.poll_state === 'voting') {
              if (debugMode) {
                console.log(`[${debugIdRef.current}] Poll state changed to voting, forcing immediate poll`);
              }
              initializePoll();
            }
            
            // Reset to fast polling when state changes
            if (pollingInterval > 2000) {
              setPollingInterval(2000);
              noChangeCountRef.current = 0;
            }
            
            // Trigger an immediate poll
            initializePoll();
          }
        })
        .subscribe();
    } catch (error) {
      console.error(`[${debugIdRef.current}] Error setting up subscriptions:`, error);
      // If subscriptions fail, we still have polling as a fallback
    }
    
    // Cleanup
    return () => {
      if (debugMode) {
        console.log(`[${debugIdRef.current}] Cleaning up poll for activation ${activationId}`);
      }
      
      // Clear polling timeout
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
      
      // Unsubscribe from channels
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [activationId, pollingInterval, initializePoll, debugMode]);

  // Submit vote
  const submitVote = useCallback(async (optionId: string): Promise<{ success: boolean; error?: string }> => {
    if (debugMode) {
      console.log(`[${debugIdRef.current}] Submitting vote for option ${optionId}`);
    }
    
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

        if (debugMode) {
          console.log(`[${debugIdRef.current}] Submitting vote:`, { activationId, playerId, optionId, optionText: option.text });
        }

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
            if (debugMode) {
              console.log(`[${debugIdRef.current}] Duplicate vote detected`);
            }
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
        
        // Reset to fast polling
        if (pollingInterval > 2000) {
          if (debugMode) {
            console.log(`[${debugIdRef.current}] Vote submitted, resetting polling interval to 2000ms`);
          }
          setPollingInterval(2000);
          noChangeCountRef.current = 0;
        }
        
        // Force a refresh to get the latest data
        setTimeout(initializePoll, 500);
        
        if (debugMode) {
          console.log(`[${debugIdRef.current}] Vote submitted successfully`);
        }
        
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
          if (debugMode) {
            console.log(`[${debugIdRef.current}] Vote saved locally due to network error`);
          }
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
  }, [activationId, playerId, hasVoted, pollState, options, pollingInterval, initializePoll, debugMode]);

  // Calculate total votes
  const getTotalVotes = useCallback((): number => {
    // Use votesByText as the source of truth
    if (debugMode) {
      console.log(`[${debugIdRef.current}] Calculating total votes from:`, votesByText);
    }
    return Object.values(votesByText).reduce((sum, count) => sum + count, 0);
  }, [votesByText, debugMode]);

  return {
    votes,
    votesByText,
    totalVotes: getTotalVotes(),
    hasVoted,
    selectedOptionId,
    pollState,
    isLoading,
    lastUpdated,
    pollingInterval,
    submitVote,
    resetPoll
  };
}

export default usePollManager;