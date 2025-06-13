import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { usePollManager } from '../../hooks/usePollManager';
import MediaDisplay from './MediaDisplay';
import { cn } from '../../lib/utils';

interface PollOption {
  id?: string;
  text: string;
  media_type?: 'none' | 'image' | 'gif';
  media_url?: string;
}

interface PollVotingProps {
  activationId: string | null;
  options?: PollOption[];
  playerId?: string | null;
  pollState?: 'pending' | 'voting' | 'closed';
  className?: string;
  onVoteSubmitted?: (optionId: string, optionText: string) => void;
  themeColors?: {
    primary_color?: string;
    secondary_color?: string;
  };
}

const PollVoting: React.FC<PollVotingProps> = ({
  activationId,
  options = [],
  playerId,
  pollState: initialPollState = 'pending',
  className,
  onVoteSubmitted,
  themeColors = {}
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Use the poll manager hook for handling votes
  const {
    hasVoted,
    selectedOptionId,
    pollState,
    isLoading,
    submitVote,
    totalVotes
  } = usePollManager({
    activationId,
    options,
    playerId
  });

  // Clear error message after 5 seconds
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleVote = async (optionId: string, optionText: string) => {
    if (!activationId || !playerId) {
      setErrorMessage('Unable to submit vote. Please try again.');
      return;
    }

    if (hasVoted) {
      setErrorMessage('You have already voted in this poll.');
      return;
    }

    if (pollState !== 'voting') {
      setErrorMessage('Voting is not currently open.');
      return;
    }

    try {
      const result = await submitVote(optionId);
      
      if (result.success) {
        setSuccessMessage('Vote submitted successfully!');
        if (onVoteSubmitted) {
          onVoteSubmitted(optionId, optionText);
        }
      } else {
        setErrorMessage(result.error || 'Failed to submit vote. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting vote:', error);
      setErrorMessage('An unexpected error occurred. Please try again.');
    }
  };

  // Helper to get color for option
  const getColorForOption = (index: number) => {
    const baseColors = [
      themeColors.primary_color || '#3B82F6',
      themeColors.secondary_color || '#8B5CF6',
      '#10B981', // Green
      '#F59E0B', // Yellow
      '#EF4444', // Red
      '#06B6D4', // Cyan
      '#EC4899', // Pink
      '#F97316', // Orange
      '#14B8A6', // Teal
    ];
    return baseColors[index % baseColors.length];
  };

  if (!activationId) {
    return null;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Poll state indicator */}
      <div className="flex justify-between items-center mb-2">
        <div className={cn(
          "px-3 py-1 rounded-full text-sm font-medium",
          pollState === 'pending' ? "bg-yellow-100 text-yellow-800" :
          pollState === 'voting' ? "bg-green-100 text-green-800" :
          "bg-red-100 text-red-800"
        )}>
          {pollState === 'pending' ? 'Waiting for voting to start' :
           pollState === 'voting' ? 'Voting is open' :
           'Voting is closed'}
        </div>
        
        {totalVotes > 0 && (
          <div className="text-sm text-gray-500">
            {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="p-3 bg-red-100 text-red-700 rounded-lg flex items-center">
          <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="p-3 bg-green-100 text-green-700 rounded-lg flex items-center">
          <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Options grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map((option, index) => {
          const isSelected = option.id === selectedOptionId;
          const isDisabled = hasVoted || pollState !== 'voting' || isLoading;
          
          return (
            <button
              key={option.id || index}
              onClick={() => handleVote(option.id || '', option.text)}
              disabled={isDisabled}
              className={cn(
                "p-4 rounded-lg text-left transition transform hover:scale-105",
                isDisabled ? "opacity-80 cursor-not-allowed" : "cursor-pointer",
                isSelected ? "ring-2 ring-offset-2" : "bg-white/20 hover:bg-white/30",
                "relative overflow-hidden"
              )}
              style={{
                borderColor: isSelected ? getColorForOption(index) : 'transparent',
                borderWidth: isSelected ? '2px' : '0',
              }}
            >
              <div className="flex items-center gap-3 relative z-10">
                {option.media_type !== 'none' && option.media_url && (
                  <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-black/20">
                    <MediaDisplay
                      url={option.media_url}
                      type={option.media_type}
                      alt={option.text}
                      className="w-full h-full object-cover"
                      fallbackText="!"
                    />
                  </div>
                )}
                <span className="text-white font-medium text-lg">{option.text}</span>
                
                {isSelected && (
                  <CheckCircle className="w-5 h-5 text-green-400 ml-auto" />
                )}
              </div>
              
              {/* Loading indicator */}
              {isLoading && isSelected && (
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Voting closed message */}
      {pollState === 'closed' && !hasVoted && (
        <div className="p-4 bg-gray-100 text-gray-700 rounded-lg text-center">
          Voting is now closed. You did not submit a vote.
        </div>
      )}

      {/* Waiting message */}
      {pollState === 'pending' && (
        <div className="p-4 bg-yellow-50 text-yellow-700 rounded-lg text-center">
          Waiting for the host to start voting...
        </div>
      )}
    </div>
  );
};

export default PollVoting;