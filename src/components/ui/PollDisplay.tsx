import React, { useState, useEffect, useRef } from 'react';
import { cn, getStorageUrl } from '../../lib/utils';
import MediaDisplay from './MediaDisplay';
import { CheckCircle, Crown, Activity } from 'lucide-react';
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
  lastUpdated
}) => {
  // Use provided getStorageUrl function or fall back to the utility function
  const getStorageUrlFn = customGetStorageUrl || getStorageUrl;
  
  // State for animated values
  const [animatedVotes, setAnimatedVotes] = useState<PollVotes>({});
  const [animatedTotalVotes, setAnimatedTotalVotes] = useState(0);
  const [leadingOptionId, setLeadingOptionId] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [barWidths, setBarWidths] = useState<{[key: string]: number}>({});
  
  // Refs for tracking previous values
  const prevVotesRef = useRef<PollVotes>({});
  const prevTotalVotesRef = useRef<number>(0);
  const animationsRef = useRef<{[key: string]: number}>({});
  const prevPollStateRef = useRef<'pending' | 'voting' | 'closed'>('pending');
  
  // Initialize animated values
  useEffect(() => {
    setAnimatedVotes(votes);
    setAnimatedTotalVotes(totalVotes);
    prevVotesRef.current = votes;
    prevTotalVotesRef.current = totalVotes;
    prevPollStateRef.current = pollState;
    
    // Calculate initial bar widths
    const initialWidths: {[key: string]: number} = {};
    options.forEach(option => {
      const optionId = option.id || option.text;
      const voteCount = votes[optionId] || 0;
      const percentage = totalVotes > 0 ? (voteCount / totalVotes * 100) : 0;
      initialWidths[optionId] = Math.max(percentage, 4); // Minimum 4% for visibility
    });
    setBarWidths(initialWidths);
    
    // Determine leading option
    updateLeadingOption(votes);
  }, []);
  
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

  // Animate when votes change
  useEffect(() => {
    // Check if votes have changed
    let hasChanged = totalVotes !== prevTotalVotesRef.current;
    
    // Force animation when poll state changes to voting
    if (pollState === 'voting' && prevPollStateRef.current !== 'voting') {
      hasChanged = true;
    }
    
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
          
          // Animate bar widths
          const percentage = totalVotes > 0 ? ((votes[optionId] || 0) / totalVotes * 100) : 0;
          setBarWidths(prev => ({
            ...prev,
            [optionId]: Math.max(percentage, 4) // Minimum 4% for visibility
          }));
        },
        100 // 100ms stagger between each option
      );
      
      // Update leading option
      updateLeadingOption(votes);
      
      // Update poll state ref
      prevPollStateRef.current = pollState;
      
      // Update refs for next comparison
      prevVotesRef.current = { ...votes };
      prevTotalVotesRef.current = totalVotes;
      
      // Reset animation flag after all animations complete
      setTimeout(() => {
        setIsAnimating(false);
      }, 1000 + (options.length * 100));
    }
  }, [votes, totalVotes, options]);

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

  // Render pie chart
  if (displayType === 'pie') {
    // Calculate angles for pie chart
    let currentAngle = 0;
    const pieSlices = options.map((option, index) => {
      const voteCount = getVoteCount(option);
      const percentage = animatedTotalVotes > 0 ? (voteCount / animatedTotalVotes * 360) : 0;
      const slice = {
        option,
        startAngle: currentAngle,
        endAngle: currentAngle + percentage,
        percentage: animatedTotalVotes > 0 ? (voteCount / animatedTotalVotes * 100) : 0,
        voteCount,
        color: getColorForIndex(index),
        isLeading: option.id === leadingOptionId || option.text === leadingOptionId
      };
      currentAngle += percentage;
      return slice;
    });

    return (
      <div className={cn("p-4 bg-white/10 rounded-lg", className)}>
        <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
          <h3 className="font-semibold text-white">
            {pollState === 'closed' ? 'Final Results' : 'Live Results'}
          </h3>
          <div className="text-sm text-white/80 flex items-center">
            {animatedTotalVotes} votes
            {pollState === 'voting' && (
              <span className="ml-2 flex items-center">
                <span className="relative flex h-2 w-2 mr-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-green-300 text-xs">Live</span>
              </span>
            )}
          </div>
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
                    className={cn(
                      "transition-opacity duration-300",
                      isOptionSelected(slice.option) ? 'opacity-100' : 'opacity-80',
                      slice.isLeading && 'filter drop-shadow-lg'
                    )}
                  />
                );
              })}
            </svg>
            
            {/* Leading indicator */}
            {leadingOptionId && (
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-bold flex items-center shadow-lg animate-pulse">
                <Crown className="w-3 h-3 mr-1" />
                Leading!
              </div>
            )}
          </div>
          
          {/* Legend */}
          <div className="mt-4 space-y-2 w-full">
            {options.map((option, index) => {
              const voteCount = getVoteCount(option);
              const percentage = animatedTotalVotes > 0 ? (voteCount / animatedTotalVotes * 100).toFixed(1) : '0.0';
              const isSelected = isOptionSelected(option);
              const isLeading = option.id === leadingOptionId || option.text === leadingOptionId;
              
              return (
                <div key={index} className={cn(
                  "flex items-center gap-2 p-2 rounded-lg transition-colors duration-300",
                  isLeading && "bg-yellow-500/10",
                  isSelected && "bg-white/10"
                )}>
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: getColorForIndex(index) }}
                  />
                  <div className="flex items-center flex-1">
                    {isSelected && <CheckCircle className="w-3 h-3 mr-1 text-green-400" />}
                    {isLeading && <Crown className="w-3 h-3 mr-1 text-yellow-400" />}
                    {option.media_type !== 'none' && option.media_url && (
                      <MediaDisplay
                        url={option.media_url}
                        type={option.media_type || 'image'}
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
          
          {/* Live update indicator */}
          {pollState === 'voting' && lastUpdated && (
            <div className="mt-3 text-xs text-white/60 flex items-center justify-center">
              <Activity className="w-3 h-3 mr-1" />
              <span>Live updates</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render vertical bars
  if (displayType === 'vertical') {
    return (
      <div className={cn("p-4 bg-white/10 rounded-lg", className)}>
        <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
          <h3 className="font-semibold text-white">
            {pollState === 'closed' ? 'Final Results' : 'Live Results'}
          </h3>
          <div className="text-sm text-white/80 flex items-center">
            {animatedTotalVotes} votes
            {pollState === 'voting' && (
              <span className="ml-2 flex items-center">
                <span className="relative flex h-2 w-2 mr-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-green-300 text-xs">Live</span>
              </span>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 h-48">
          {options.map((option, index) => {
            const voteCount = getVoteCount(option);
            const percentage = animatedTotalVotes > 0 ? (voteCount / animatedTotalVotes * 100) : 0;
            const color = getColorForIndex(index);
            const isSelected = isOptionSelected(option);
            const isLeading = option.id === leadingOptionId || option.text === leadingOptionId;
            const optionId = option.id || option.text;
            const barHeight = barWidths[optionId] || 0;
            
            return (
              <div key={index} className="flex flex-col items-center h-full">
                <div className="text-sm text-white mb-1 flex items-center">
                  {getDisplayLabel(voteCount, percentage.toFixed(1))}
                  {isLeading && (
                    <Crown className="w-3 h-3 ml-1 text-yellow-400" />
                  )}
                </div>
                
                <div className="w-full flex-grow bg-white/20 rounded-t-lg relative flex justify-center">
                  <div 
                    className="absolute bottom-0 w-full transition-all duration-1000 ease-out rounded-t-lg"
                    style={{ 
                      height: `${barHeight}%`,
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
                    <div className="w-4 h-4 rounded-full overflow-hidden mx-auto mb-1">
                      <MediaDisplay
                        url={option.media_url}
                        type={option.media_type || 'image'}
                        alt={option.text}
                        className="w-full h-full object-cover"
                      />
                    </div>
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
        
        {/* Live update indicator */}
        {pollState === 'voting' && lastUpdated && (
          <div className="mt-3 text-xs text-white/60 flex items-center justify-center">
            <Activity className="w-3 h-3 mr-1" />
            <span>Live updates</span>
          </div>
        )}
      </div>
    );
  }

  // Default: Horizontal bars
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
              Live Results
            </>
          ) : (
            <>Poll Results</>
          )}
        </h3>
        <div className="text-sm text-white/80 flex items-center">
          {animatedTotalVotes} votes
          {pollState === 'voting' && (
            <span className="ml-2 flex items-center">
              <span className="relative flex h-2 w-2 mr-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-green-300 text-xs">Live</span>
            </span>
          )}
        </div>
      </div>
      
      <div className="space-y-4">
        {options.map((option, index) => {
          const voteCount = getVoteCount(option);
          const percentage = animatedTotalVotes > 0 ? (voteCount / animatedTotalVotes * 100) : 0;
          const isSelected = isOptionSelected(option);
          const isLeading = option.id === leadingOptionId || option.text === leadingOptionId;
          const optionId = option.id || option.text;
          const barWidth = barWidths[optionId] || 0;
          
          return (
            <div key={index} className={cn(
              "space-y-1",
              isLeading && "animate-pulse-slow"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  {isSelected && <CheckCircle className="w-4 h-4 mr-1 text-green-400" />}
                  {isLeading && <Crown className="w-4 h-4 mr-1 text-yellow-400" />}
                  {option.media_type !== 'none' && option.media_url && (
                    <img
                      src={option.media_url}
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
                  className="h-full transition-all duration-1000 ease-out flex items-center px-2"
                  style={{ 
                    width: `${barWidth}%`,
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
      
      {animatedTotalVotes === 0 && (
        <div className="text-center text-white/60 mt-4">
          No votes yet
        </div>
      )}
      
      {/* Live update indicator */}
      {pollState === 'voting' && lastUpdated && (
        <div className="mt-3 text-xs text-white/60 flex items-center justify-center">
          <Activity className="w-3 h-3 mr-1" />
          <span>Live updates</span>
        </div>
      )}
    </div>
  );
};

export default PollDisplay;