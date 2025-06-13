import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { formatPoints } from '../../lib/point-calculator';

interface LeaderboardItemProps {
  player: {
    id: string;
    name: string;
    score: number;
    stats?: {
      totalPoints: number;
      correctAnswers: number;
      totalAnswers: number;
      averageResponseTimeMs: number;
    };
  };
  rank: number;
  previousRank?: number;
  isCurrentPlayer?: boolean;
  showStats?: boolean;
}

const LeaderboardItem: React.FC<LeaderboardItemProps> = ({ 
  player, 
  rank, 
  previousRank,
  isCurrentPlayer = false,
  showStats = false
}) => {
  const [showRankChange, setShowRankChange] = useState(false);
  const [animation, setAnimation] = useState('');
  
  useEffect(() => {
    // Only show rank change if we have a previous rank to compare
    if (previousRank !== undefined && previousRank !== rank) {
      setShowRankChange(true);
      
      // Show score pulse animation
      setAnimation('animate-score-change');
      
      // Hide rank change indicator after 5 seconds
      const timer = setTimeout(() => {
        setShowRankChange(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [rank, previousRank]);
  
  useEffect(() => {
    // Remove animation class after animation completes
    if (animation) {
      const timer = setTimeout(() => {
        setAnimation('');
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [animation]);
  
  // Calculate rank change
  const rankChange = previousRank !== undefined ? previousRank - rank : 0;
  
  // Format time in seconds to MM:SS
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes > 0 ? minutes + 'm ' : ''}${seconds}s`;
  };
  
  // Calculate accuracy percentage
  const calculateAccuracy = (correct: number, total: number): string => {
    if (total === 0) return '0%';
    return `${Math.round((correct / total) * 100)}%`;
  };
  
  // Determine size based on rank
  const isTopFour = rank <= 4;
  
  return (
    <div 
      className={`flex items-center ${isTopFour ? 'p-2' : 'p-1'} rounded-lg transition-colors ${animation} ${
        isCurrentPlayer ? 'bg-white/30' : 'bg-white/10'
      } ${
        rank === 1 ? 'border border-yellow-300 pulse-border' : 
        rank === 2 ? 'border border-gray-300' : 
        rank === 3 ? 'border border-amber-400' : 
        rank === 4 ? 'border border-white/20' : ''
      }`}
    >
      <div className={`${isTopFour ? 'w-6 h-6' : 'w-5 h-5'} rounded-full flex items-center justify-center font-bold mr-2 ${
        rank === 1 ? 'bg-yellow-300 text-yellow-800' : 
        rank === 2 ? 'bg-gray-300 text-gray-700' :
        rank === 3 ? 'bg-amber-300 text-amber-800' :
        'bg-white/20 text-white'
      }`}>
        {rank}
      </div>
      
      <div className={`flex-1 font-medium text-white ${isTopFour ? 'text-sm' : 'text-xs'} truncate`}>
        {player.name}
        {isCurrentPlayer && <span className="ml-2 text-xs bg-purple-500/50 px-2 py-0.5 rounded-full">You</span>}
        
        {/* Show stats if available */}
        {showStats && player.stats && (
          <div className="text-xs text-white/70 mt-0.5 flex flex-wrap gap-x-2">
            <span title="Accuracy">
              {player.stats.correctAnswers}/{player.stats.totalAnswers} ({calculateAccuracy(player.stats.correctAnswers, player.stats.totalAnswers)})
            </span>
            {player.stats.averageResponseTimeMs > 0 && (
              <span title="Average response time">
                {formatTime(player.stats.averageResponseTimeMs)}
              </span>
            )}
          </div>
        )}
      </div>
      
      <div className="flex items-center">
        {showRankChange && rankChange !== 0 && (
          <div className={`mr-2 flex items-center ${
            rankChange > 0 ? 'text-green-400' : rankChange < 0 ? 'text-red-400' : 'text-gray-400'
          }`}>
            {rankChange > 0 ? (
              <ArrowUp className="w-3 h-3" />
            ) : rankChange < 0 ? (
              <ArrowDown className="w-3 h-3" />
            ) : (
              <Minus className="w-3 h-3" />
            )}
            <span className="text-xs ml-0.5">{Math.abs(rankChange)}</span>
          </div>
        )}
        
        <div className={`font-bold text-white ${isTopFour ? 'text-sm' : 'text-xs'}`}>
          {formatPoints(player.score)}
        </div>
      </div>
    </div>
  );
};

export default LeaderboardItem;