import React, { useState } from 'react';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import MediaDisplay from './MediaDisplay';

interface PollOption {
  id?: string;
  text: string;
  media_type?: 'none' | 'image' | 'gif';
  media_url?: string;
}

interface PollVoteFormProps {
  options: PollOption[];
  onVote: (optionId: string, optionText: string) => Promise<{ success: boolean; error?: string }>;
  disabled?: boolean;
  isSubmitting?: boolean;
  className?: string;
  themeColors?: {
    primary_color?: string;
    secondary_color?: string;
  };
}

const PollVoteForm: React.FC<PollVoteFormProps> = ({
  options,
  onVote,
  disabled = false,
  isSubmitting = false,
  className,
  themeColors = {}
}) => {
  const [selectedOption, setSelectedOption] = useState<PollOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isVoting, setIsVoting] = useState(false);

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

  const handleOptionSelect = (option: PollOption) => {
    if (disabled || isSubmitting || isVoting) return;
    setSelectedOption(option);
    setError(null);
  };

  const handleSubmitVote = async () => {
    if (!selectedOption || disabled || isSubmitting || isVoting) return;
    
    setIsVoting(true);
    setError(null);
    setSuccess(null);
    
    try {
      const optionId = selectedOption.id || '';
      const result = await onVote(optionId, selectedOption.text);
      
      if (result.success) {
        setSuccess('Your vote has been submitted!');
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccess(null);
        }, 3000);
      } else {
        setError(result.error || 'Failed to submit vote');
      }
    } catch (err) {
      console.error('Error submitting vote:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded-lg flex items-center">
          <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-100 text-green-700 rounded-lg flex items-center">
          <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map((option, index) => (
          <button
            key={option.id || index}
            onClick={() => handleOptionSelect(option)}
            disabled={disabled || isSubmitting || isVoting}
            className={cn(
              "p-4 rounded-lg text-left transition transform hover:scale-105",
              disabled ? "opacity-70 cursor-not-allowed" : "cursor-pointer",
              selectedOption?.id === option.id ? 
                "ring-2 ring-offset-2" : 
                "bg-white/20 hover:bg-white/30",
              "relative overflow-hidden"
            )}
            style={{
              borderColor: selectedOption?.id === option.id ? getColorForOption(index) : 'transparent',
              borderWidth: selectedOption?.id === option.id ? '2px' : '0',
            }}
          >
            <div className="flex items-center gap-3 relative z-10">
              {option.media_type !== 'none' && option.media_url && (
                <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-black/20">
                  <MediaDisplay
                    url={option.media_url}
                    type={option.media_type || 'image'}
                    alt={option.text}
                    className="w-full h-full object-cover"
                    fallbackText="!"
                  />
                </div>
              )}
              <span className="text-white font-medium text-lg">{option.text}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-center pt-2">
        <button
          onClick={handleSubmitVote}
          disabled={!selectedOption || disabled || isSubmitting || isVoting}
          className={cn(
            "px-6 py-3 rounded-lg font-medium transition",
            !selectedOption || disabled || isSubmitting || isVoting ? 
              "bg-gray-400 text-gray-200 cursor-not-allowed" : 
              "bg-white/20 hover:bg-white/30 text-white",
            "flex items-center justify-center gap-2"
          )}
          style={{
            backgroundColor: selectedOption && !disabled && !isSubmitting && !isVoting ? 
              (themeColors.primary_color || '#3B82F6') : undefined
          }}
        >
          {isVoting || isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Submitting...</span>
            </>
          ) : (
            <span>Submit Vote</span>
          )}
        </button>
      </div>
    </div>
  );
};

export default PollVoteForm;