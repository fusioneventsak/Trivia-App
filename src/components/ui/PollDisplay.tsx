import React from 'react';
import { cn } from '../../lib/utils';
import { CheckCircle, Crown, Activity, Lock, Clock } from 'lucide-react';

interface PollOption {
  text: string;
  id?: string;
  media_type?: 'none' | 'image' | 'gif';
  media_url?: string;
}

interface PollDisplayProps {
  options: PollOption[];
  votes: { [optionId: string]: number };
  votesByText: { [text: string]: number };
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
  votesByText,
  totalVotes,
  displayType = 'bar',
  resultFormat = 'both',
  selectedAnswer,
  selectedOptionId,
  getStorageUrl = (url) => url,
  themeColors = {},
  compact = false,
  className = '',
  pollState = 'closed',
  lastUpdated,
  showOptionsOnly = false
}) => {
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
      themeColors.primary_color || '#3B82F6',
      themeColors.secondary_color || '#8B5CF6',
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
    if (option.id && votes[option.id] !== undefined) {
      return votes[option.id];
    }
    // Fall back to option text
    return votesByText[option.text] || 0;
  };

  // Check if option is selected
  const isOptionSelected = (option: PollOption): boolean => {
    if (selectedOptionId && option.id) {
      return selectedOptionId === option.id;
    }
    return selectedAnswer === option.text;
  };

  // Determine which width to use based on poll state
  const getBarWidth = (option: PollOption): number => {
    const optionId = option.id || option.text;
    
    if (pollState === 'voting' && !showOptionsOnly) {
      return Math.random() * 80 + 10; // Random between 10-90% for voting state
    }
    
    // For closed/locked polls, calculate actual percentage from vote counts
    if (pollState === 'closed') {
      const voteCount = getVoteCount(option);
      const percentage = totalVotes > 0 ? (voteCount / totalVotes * 100) : 0;
      // Ensure minimum width for options with votes
      return Math.max(percentage, voteCount > 0 ? 4 : 0);
    }
    
    return 0;
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
                    src={getStorageUrl(option.media_url)}
                    alt={option.text}
                    className="w-8 h-8 rounded-full object-cover mr-2"
                    onError={(e) => {
                      e.currentTarget.src = 'https://via.placeholder.com/40?text=!';
                    }}
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
            <>{totalVotes} votes</>
          )}
        </div>
      </div>
      
      <div className="space-y-4">
        {options.map((option, index) => {
          const voteCount = getVoteCount(option);
          const percentage = totalVotes > 0 ? (voteCount / totalVotes * 100) : 0;
          const isSelected = isOptionSelected(option);
          const isLeading = pollState === 'closed' && 
                           (option.id === Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0] || 
                            option.text === Object.entries(votesByText).sort((a, b) => b[1] - a[1])[0]?.[0]);
          const barWidth = getBarWidth(option);
          
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
                      src={getStorageUrl(option.media_url)}
                      crossOrigin="anonymous"
                      alt={option.text}
                      className="w-8 h-8 rounded-full object-cover mr-2 border border-white/30"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/40?text=!';
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
          
          {totalVotes === 0 && (
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