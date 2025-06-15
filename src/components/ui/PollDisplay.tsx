import React, { useState, useEffect, useRef } from 'react';
import { cn, getStorageUrl } from '../../lib/utils';
import MediaDisplay from './MediaDisplay';
import { CheckCircle, Crown, Activity, Lock, Clock } from 'lucide-react';
import { animateValue, stagger } from '../../lib/animation-utils';

interface PollOption {
  text: string;
  id?: string;
  media_type?: 'none' | 'image' | 'gif';
  media_url?: string;
}

interface PollVotes {
  [textOrId: string]: number;
}

interface PollDisplayProps {
  options: PollOption[];
  votes: PollVotes;
  totalVotes: number;
  displayType?: 'bar' | 'pie' | 'horizontal' | 'vertical';
  resultFormat?: 'percentage' | 'votes' | 'both';
  selectedAnswer?: string | null;
  selectedOptionId?: string | null;
  getStorageUrl?: (url: string) => string;
  themeColors?: {
    primary_color?: string;
    secondary_color?: string;
  };
  compact?: boolean;
  className?: string;
  pollState?: 'pending' | 'voting' | 'closed';
  lastUpdated?: number;
  showOptionsOnly?: boolean;
}

const PollDisplay: React.FC<PollDisplayProps> = ({
  options,
  votes,
  totalVotes,
  displayType = 'bar',
  resultFormat = 'both',
  selectedAnswer,
  selectedOptionId,
  getStorageUrl: customGetStorageUrl,
  themeColors = {},
  compact = false,
  className = '',
  pollState = 'closed',
  lastUpdated,
  showOptionsOnly = false
}) => {
  // Use provided getStorageUrl function or fall back to the utility function
  const getStorageUrlFn = customGetStorageUrl || getStorageUrl;
  
  // State for animated values
  const [animatedVotes, setAnimatedVotes] = useState<PollVotes>({});
  const [animatedTotalVotes, setAnimatedTotalVotes] = useState(0);
  const [leadingOptionId, setLeadingOptionId] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [barWidths, setBarWidths] = useState<{[key: string]: number}>({});
  const [randomBarWidths, setRandomBarWidths] = useState<{[key: string]: number}>({});
  
  // Refs for tracking previous values
  const prevVotesRef = useRef<PollVotes>({});
  const prevTotalVotesRef = useRef<number>(0);
  const animationsRef = useRef<{[key: string]: number}>({});
  const prevPollStateRef = useRef<'pending' | 'voting' | 'closed'>('pending');
  const randomAnimationRef = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize random bar widths for voting state
  useEffect(() => {
    if (pollState === 'voting' && !showOptionsOnly) {
      // Initialize random widths
      const initialRandomWidths: {[key: string]: number} = {};
      options.forEach(option => {
        const optionId = option.id || option.text;
        initialRandomWidths[optionId] = Math.random() * 80 + 10; // Random between 10-90%
      });
      setRandomBarWidths(initialRandomWidths);
      
      // Start random animation
      const animateRandomBars = () => {
        setRandomBarWidths(prev => {
          const newWidths: {[key: string]: number} = {};
          options.forEach(option => {
            const optionId = option.id || option.text;
            const currentWidth = prev[optionId] || 50;
            
            // Random walk: move up or down by random amount
            const change = (Math.random() - 0.5) * 30; // -15 to +15
            let newWidth = currentWidth + change;
            
            // Keep within bounds (5% to 95%)
            newWidth = Math.max(5, Math.min(95, newWidth));
            
            newWidths[optionId] = newWidth;
          });
          return newWidths;
        });
      };
      
      // Animate every 1-2 seconds
      const animationInterval = setInterval(animateRandomBars, 1500);
      randomAnimationRef.current = animationInterval;
      
      return () => {
        if (randomAnimationRef.current) {
          clearInterval(randomAnimationRef.current);
        }
      };
    } else if (pollState === 'closed') {
      // Clear random animation when poll closes
      if (randomAnimationRef.current) {
        clearInterval(randomAnimationRef.current);
        randomAnimationRef.current = null;
      }
    }
  }, [pollState, options, showOptionsOnly]);
  
  // Initialize real values when poll closes
  useEffect(() => {
   console.log(`PollDisplay: Poll state changed to ${pollState}`);
   
    if (pollState === 'closed') {
      // Add a small delay for dramatic effect
      setTimeout(() => {
        setAnimatedVotes(votes);
        setAnimatedTotalVotes(totalVotes);
        prevVotesRef.current = votes;
        prevTotalVotesRef.current = totalVotes;
        
        // Calculate real bar widths with animation
        const realWidths: {[key: string]: number} = {};
        options.forEach(option => {
          const optionId = option.id || option.text;
          const voteCount = votes[optionId] || 0;
          const percentage = totalVotes > 0 ? (voteCount / totalVotes * 100) : 0;
          realWidths[optionId] = Math.max(percentage, voteCount > 0 ? 4 : 0); // Minimum 4% for visibility if there are votes
        });
        
        // Animate from random widths to real widths
        setIsAnimating(true);
        setBarWidths(realWidths);
        
        // Determine leading option
        updateLeadingOption(votes);
        
        // Reset animation flag after transition
        setTimeout(() => {
          setIsAnimating(false);
        }, 1500);
      }, 300); // 300ms delay for effect
    }
  }, [pollState, votes, totalVotes, options]);
  
  // Update leading option
  const updateLeadingOption = (currentVotes: PollVotes) => {
    let maxVotes = 0;
    let leaderId: string | null = null;
    
    options.forEach(option => {
      const optionId = option.id || option.text;
      const voteCount = currentVotes[optionId] || 0;
      
      if (voteCount > maxVotes) {
        maxVotes = voteCount;
        leaderId = optionId;
      }
    });
    
    setLeadingOptionId(leaderId);
  };

  // Animate when votes change (only for closed polls)
  useEffect(() => {
    if (pollState !== 'closed') return;
    
    // Check if votes have changed
    let hasChanged = totalVotes !== prevTotalVotesRef.current;
    
    if (!hasChanged) {
      // Check each option for changes
      for (const option of options) {
        const optionId = option.id || option.text;
        if ((votes[optionId] || 0) !== (prevVotesRef.current[optionId] || 0)) {
          hasChanged = true;
          break;
        }
      }
    }
    
    if (hasChanged) {
      setIsAnimating(true);
      
      // Animate total votes
      if (totalVotes !== prevTotalVotesRef.current) {
        animateValue(
          prevTotalVotesRef.current,
          totalVotes,
          1000,
          (value) => setAnimatedTotalVotes(Math.round(value))
        );
      }
      
      // Cancel any ongoing animations
      Object.values(animationsRef.current).forEach(id => {
        cancelAnimationFrame(id);
      });
      animationsRef.current = {};
      
      // Animate individual vote counts with staggered start
      stagger(
        options,
        (option, index) => {
          const optionId = option.id || option.text;
          const prevCount = prevVotesRef.current[optionId] || 0;
          const newCount = votes[optionId] || 0;
          
          if (prevCount !== newCount) {
            animateValue(
              prevCount,
              newCount,
              800,
              (value) => {
                setAnimatedVotes(prev => ({
                  ...prev,
                  [optionId]: Math.round(value)
                }));
              }
            );
          }
          
          // Animate bar widths with actual percentages for closed polls
          const percentage = totalVotes > 0 ? ((votes[optionId] || 0) / totalVotes * 100) : 0;
          setBarWidths(prev => ({
            ...prev,
            [optionId]: Math.max(percentage, (votes[optionId] || 0) > 0 ? 4 : 0) // Minimum 4% for visibility if there are votes
          }));
        },
        100 // 100ms stagger between each option
      );
      
      // Update leading option
      updateLeadingOption(votes);
      
      // Update refs for next comparison
      prevVotesRef.current = { ...votes };
      prevTotalVotesRef.current = totalVotes;
      
      // Reset animation flag after all animations complete
      setTimeout(() => {
        setIsAnimating(false);
      }, 1000 + (options.length * 100));
    }
  }, [votes, totalVotes, options, pollState]);

  // Helper to get display label based on format
  const getDisplayLabel = (voteCount: number, percentage: string): string => {
    if (pollState === 'voting' && !showOptionsOnly) {
      return '???'; // Hide actual values during voting
    }
    if (resultFormat === 'percentage') return `${percentage}%`;
    if (resultFormat === 'votes') return `${voteCount}`;
    return `${voteCount} (${percentage}%)`;
  };

  // Helper to get color for each option
  const getColorForIndex = (index: number) => {
    const baseColors = [
      themeColors?.primary_color || '#3B82F6',
      themeColors?.secondary_color || '#8B5CF6',
      '#10B981', // Green
      '#F59E0B', // Yellow
      '#EF4444', // Red
      '#06B6D4', // Cyan
      '#8B5CF6', // Purple
      '#EC4899', // Pink
      '#F97316', // Orange
      '#14B8A6', // Teal
    ];

    return baseColors[index % baseColors.length];
  };

  // Helper to get vote count for an option
  const getVoteCount = (option: PollOption): number => {
    if (pollState === 'voting' && !showOptionsOnly) {
      return 0; // Hide actual counts during voting
    }
    // Try by option ID first if available
    if (option.id && animatedVotes[option.id] !== undefined) {
      return animatedVotes[option.id];
    }
    // Fall back to option text
    return animatedVotes[option.text] || 0;
  };

  // Check if option is selected
  const isOptionSelected = (option: PollOption): boolean => {
    if (selectedOptionId && option.id) {
      return selectedOptionId === option.id;
    }
    return selectedAnswer === option.text;
  };

  // Determine which width to use based on poll state - FIXED FOR LOCKED POLLS
  const getBarWidth = (option: PollOption): number => {
    const optionId = option.id || option.text;
    
    if (pollState === 'voting' && !showOptionsOnly && randomBarWidths[optionId]) {
      return randomBarWidths[optionId] || 50;
    }
    
    // For closed/locked polls, calculate actual percentage from vote counts
    if (pollState === 'closed') {
      const voteCount = getVoteCount(option);
      const percentage = animatedTotalVotes && animatedTotalVotes > 0 ? (voteCount / animatedTotalVotes * 100) : 0;
      // Ensure minimum width for options with votes
      return Math.max(percentage, voteCount > 0 ? 4 : 0);
    }
    
    return barWidths[optionId] || 0;
  };

  // Show options only (no results) - for pending state or when explicitly requested
  if (showOptionsOnly || pollState === 'pending') {
    return (
      <div className={cn("p-4 bg-white/10 rounded-lg", className)}>
        <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
          <h3 className="font-semibold text-white">
            {pollState === 'pending' ? 'Poll Options' : 'Poll Results'}
          </h3>
          {pollState === 'pending' && (
            <div className="text-sm text-yellow-400 flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              <span>Waiting to start</span>
            </div>
          )}
        </div>
        <div className="space-y-3">
          {options.map((option, index) => (
            <div key={index} className="p-3 bg-white/5 rounded-lg">
              <div className="flex items-center">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold mr-3"
                  style={{ backgroundColor: getColorForIndex(index) }}
                >
                  {String.fromCharCode(65 + index)}
                </div>
                {option.media_type !== 'none' && option.media_url && (
                  <img
                    src={getStorageUrlFn(option.media_url)}
                    alt={option.text}
                    className="w-8 h-8 rounded-full object-cover mr-2"
                  />
                )}
                <span className="font-medium text-white">{option.text}</span>
              </div>
            </div>
          ))}
        </div>
        {pollState === 'pending' && (
          <div className="mt-4 text-center">
            <div className="inline-flex items-center px-3 py-1 bg-yellow-500/20 rounded-full">
              <Clock className="w-4 h-4 mr-2 text-yellow-400" />
              <span className="text-sm text-yellow-300">Voting has not started yet</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render horizontal bars (default)
  return (
    <div className={cn("p-4 bg-white/10 rounded-lg", className)}>
      <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
        <h3 className="font-semibold text-white flex items-center">
          {pollState === 'closed' ? (
            <>Final Results</>
          ) : pollState === 'voting' ? (
            <>
              <span className="relative flex h-2 w-2 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Live Voting
            </>
          ) : (
            <>Poll Results</>
          )}
        </h3>
        <div className="text-sm text-white/80 flex items-center">
          {pollState === 'voting' ? (
            <span className="text-green-300">Voting in progress...</span>
          ) : (
            <>{animatedTotalVotes} votes</>
          )}
        </div>
      </div>
      
      <div className="space-y-4">
        {options.map((option, index) => {
          const voteCount = getVoteCount(option);
          const percentage = animatedTotalVotes > 0 ? (voteCount / animatedTotalVotes * 100) : 0;
          const isSelected = isOptionSelected(option);
          const isLeading = pollState === 'closed' && (option.id === leadingOptionId || option.text === leadingOptionId);
          const barWidth = getBarWidth(option); // UPDATED to pass the option object
          
          return (
            <div key={index} className={cn(
              "space-y-1",
              isLeading && "animate-pulse-slow"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  {isSelected && pollState === 'closed' && <CheckCircle className="w-4 h-4 mr-1 text-green-400" />}
                  {isLeading && <Crown className="w-4 h-4 mr-1 text-yellow-400" />}
                  {option.media_type !== 'none' && option.media_url && (
                    <img
                      src={getStorageUrlFn(option.media_url)}
                      crossOrigin="anonymous"
                      alt={option.text}
                      className="w-8 h-8 rounded-full object-cover mr-2 border border-white/30"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/100?text=!';
                      }}
                    />
                  )}
                  <span className="font-medium text-white">{option.text}</span>
                </div>
                <span className="text-sm text-white font-mono">
                  {getDisplayLabel(voteCount, percentage.toFixed(1))}
                </span>
              </div>
              
              <div className="w-full bg-white/20 rounded-full h-6 overflow-hidden">
                <div 
                  className={cn(
                    "h-full flex items-center px-2",
                    pollState === 'voting' ? "transition-all duration-[1500ms] ease-in-out" : "transition-all duration-1000 ease-out"
                  )}
                  style={{ 
                    width: `${barWidth}%`,
                    backgroundColor: getColorForIndex(index),
                    border: isSelected && pollState === 'closed' ? '2px solid white' : 'none'
                  }}
                >
                  {barWidth >= 15 && pollState === 'closed' && (
                    <span className="text-xs text-white font-medium truncate">
                      {percentage.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Status indicators */}
      {pollState === 'voting' && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center px-3 py-1 bg-green-500/20 rounded-full">
            <Activity className="w-4 h-4 mr-2 text-green-400 animate-pulse" />
            <span className="text-sm text-green-300">Results will be revealed when voting closes</span>
          </div>
        </div>
      )}
      
      {pollState === 'closed' && (
        <div className="mt-4">
          {/* Voting Closed Notification */}
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-3">
            <div className="flex items-center justify-center">
              <Lock className="w-5 h-5 text-red-400 mr-2" />
              <span className="text-lg font-semibold text-red-300">Voting Closed</span>
            </div>
            <p className="text-center text-white/70 text-sm mt-1">
              Final results are now displayed
            </p>
          </div>
          
          {animatedTotalVotes === 0 && (
            <div className="text-center text-white/60">
              No votes were cast
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PollDisplay;