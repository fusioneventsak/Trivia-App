// src/components/ui/PollDisplay.tsx
import React from 'react';
import { cn, getStorageUrl } from '../../lib/utils';
import MediaDisplay from './MediaDisplay';
import { CheckCircle } from 'lucide-react';

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
  className = ''
}) => {
  // Use provided getStorageUrl function or fall back to the utility function
  const getStorageUrlFn = customGetStorageUrl || getStorageUrl;

  // Helper to get display label based on format
  const getDisplayLabel = (voteCount: number, percentage: string): string => {
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
    // Try by option ID first if available
    if (option.id && votes[option.id] !== undefined) {
      return votes[option.id];
    }
    // Fall back to option text
    return votes[option.text] || 0;
  };

  // Check if option is selected
  const isOptionSelected = (option: PollOption): boolean => {
    if (selectedOptionId && option.id) {
      return selectedOptionId === option.id;
    }
    return selectedAnswer === option.text;
  };

  // Render pie chart
  if (displayType === 'pie') {
    // Calculate angles for pie chart
    let currentAngle = 0;
    const pieSlices = options.map((option, index) => {
      const voteCount = getVoteCount(option);
      const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 360 : 0;
      const slice = {
        option,
        startAngle: currentAngle,
        endAngle: currentAngle + percentage,
        percentage: totalVotes > 0 ? (voteCount / totalVotes * 100) : 0,
        voteCount,
        color: getColorForIndex(index)
      };
      currentAngle += percentage;
      return slice;
    });

    return (
      <div className={cn("p-4 bg-white/10 rounded-lg", className)}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-white">Poll Results</h3>
          <div className="text-sm text-white/80">{totalVotes} votes</div>
        </div>
      
        <div className="flex flex-col items-center">
          {/* SVG Pie Chart */}
          <div className="relative w-64 h-64">
            <svg viewBox="0 0 200 200" className="w-full h-full">
              {pieSlices.map((slice, index) => {
                if (slice.percentage === 0) return null;
                
                const startAngleRad = (slice.startAngle - 90) * Math.PI / 180;
                const endAngleRad = (slice.endAngle - 90) * Math.PI / 180;
                
                const x1 = 100 + 80 * Math.cos(startAngleRad);
                const y1 = 100 + 80 * Math.sin(startAngleRad);
                const x2 = 100 + 80 * Math.cos(endAngleRad);
                const y2 = 100 + 80 * Math.sin(endAngleRad);
                
                const largeArcFlag = slice.endAngle - slice.startAngle > 180 ? 1 : 0;
                
                const pathData = [
                  `M 100 100`,
                  `L ${x1} ${y1}`,
                  `A 80 80 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                  `Z`
                ].join(' ');
                
                return (
                  <path
                    key={index}
                    d={pathData}
                    fill={slice.color}
                    stroke="white"
                    strokeWidth="2"
                    className={isOptionSelected(slice.option) ? 'opacity-100' : 'opacity-80'}
                  />
                );
              })}
            </svg>
          </div>
          
          {/* Legend */}
          <div className="mt-4 space-y-2 w-full">
            {options.map((option, index) => {
              const voteCount = getVoteCount(option);
              const percentage = totalVotes > 0 ? (voteCount / totalVotes * 100).toFixed(1) : '0.0';
              const isSelected = isOptionSelected(option);
              
              return (
                <div key={index} className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: getColorForIndex(index) }}
                  />
                  <div className="flex items-center flex-1">
                    {isSelected && <CheckCircle className="w-3 h-3 mr-1 text-green-400" />}
                    {option.media_type !== 'none' && option.media_url && (
                      <MediaDisplay
                        url={option.media_url}
                        type={option.media_type}
                        alt={option.text}
                        className="w-6 h-6 rounded-full object-cover mr-1"
                      />
                    )}
                    <span className="text-white">{option.text}</span>
                  </div>
                  <div className="text-sm text-white/80">
                    {getDisplayLabel(voteCount, percentage)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Render vertical bars
  if (displayType === 'vertical') {
    return (
      <div className={cn("p-4 bg-white/10 rounded-lg", className)}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-white">Poll Results</h3>
          <div className="text-sm text-white/80">{totalVotes} votes</div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 h-48">
          {options.map((option, index) => {
            const voteCount = getVoteCount(option);
            const percentage = totalVotes > 0 ? (voteCount / totalVotes * 100) : 0;
            const color = getColorForIndex(index);
            const isSelected = isOptionSelected(option);
            
            return (
              <div key={index} className="flex flex-col items-center h-full">
                <div className="text-sm text-white mb-1">
                  {getDisplayLabel(voteCount, percentage.toFixed(1))}
                </div>
                
                <div className="w-full flex-grow bg-white/20 rounded-t-lg relative flex justify-center">
                  <div 
                    className="absolute bottom-0 w-full transition-all duration-500 ease-out rounded-t-lg"
                    style={{ 
                      height: `${Math.max(percentage, 2)}%`,
                      backgroundColor: color,
                      border: isSelected ? '2px solid white' : 'none'
                    }}
                  >
                    {percentage > 20 && (
                      <div className="absolute top-2 inset-x-0 text-center">
                        <span className="text-xs text-white font-medium">
                          {percentage.toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="text-xs text-white mt-2 text-center px-1">
                  {option.media_type !== 'none' && option.media_url && (
                    <img
                      src={getStorageUrlFn(option.media_url)}
                      alt=""
                      className="w-4 h-4 rounded-full object-cover mx-auto mb-1"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <div className="flex items-center justify-center">
                    {isSelected && <CheckCircle className="w-3 h-3 mr-1 text-green-400" />}
                    <span className="truncate" title={option.text}>{option.text}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Default: Horizontal bars
  return (
    <div className={cn("p-4 bg-white/10 rounded-lg", className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-white">Poll Results</h3>
        <div className="text-sm text-white/80">{totalVotes} votes</div>
      </div>
      
      <div className="space-y-4">
        {options.map((option, index) => {
          const voteCount = getVoteCount(option);
          const percentage = totalVotes > 0 ? (voteCount / totalVotes * 100) : 0;
          const isSelected = isOptionSelected(option);
          
          return (
            <div key={index} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  {isSelected && <CheckCircle className="w-4 h-4 mr-1 text-green-400" />}
                  {option.media_type !== 'none' && option.media_url && (
                    <MediaDisplay
                      url={getStorageUrlFn(option.media_url)}
                      type={option.media_type}
                      alt={option.text}
                      className="w-8 h-8 rounded-full object-cover mr-2 border border-white/30"
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
                  className="h-full transition-all duration-500 ease-out flex items-center px-2"
                  style={{ 
                    width: `${Math.max(percentage, 4)}%`,
                    backgroundColor: getColorForIndex(index),
                    border: isSelected ? '2px solid white' : 'none'
                  }}
                >
                  {percentage >= 15 && (
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
      
      {totalVotes === 0 && (
        <div className="text-center text-white/60 mt-4">
          No votes yet
        </div>
      )}
    </div>
  );
};

export default PollDisplay;