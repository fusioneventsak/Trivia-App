import React from 'react';
import { BarChart, PieChart, Users, Clock, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PollVoteStatsProps {
  totalVotes: number;
  pollState: 'pending' | 'voting' | 'closed';
  lastUpdated?: Date | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
}

const PollVoteStats: React.FC<PollVoteStatsProps> = ({
  totalVotes,
  pollState,
  lastUpdated,
  onRefresh,
  isRefreshing = false,
  className
}) => {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <div className={cn(
        "flex items-center gap-1 px-3 py-1 rounded-full text-sm",
        pollState === 'pending' ? "bg-yellow-100 text-yellow-800" :
        pollState === 'voting' ? "bg-green-100 text-green-800" :
        "bg-red-100 text-red-800"
      )}>
        {pollState === 'pending' ? (
          <Clock className="w-3.5 h-3.5" />
        ) : pollState === 'voting' ? (
          <BarChart className="w-3.5 h-3.5" />
        ) : (
          <PieChart className="w-3.5 h-3.5" />
        )}
        <span className="font-medium">
          {pollState === 'pending' ? 'Waiting' :
           pollState === 'voting' ? 'Voting Open' :
           'Voting Closed'}
        </span>
      </div>
      
      <div className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
        <Users className="w-3.5 h-3.5" />
        <span className="font-medium">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
      </div>
      
      {lastUpdated && (
        <div className="text-xs text-gray-500 flex items-center">
          <Clock className="w-3 h-3 mr-1" />
          Updated {lastUpdated.toLocaleTimeString()}
          
          {onRefresh && (
            <button 
              onClick={onRefresh}
              disabled={isRefreshing}
              className="ml-1 p-1 text-gray-400 hover:text-gray-600 rounded-full disabled:opacity-50"
              title="Refresh results"
            >
              <RefreshCw className={cn("w-3 h-3", isRefreshing && "animate-spin")} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default PollVoteStats;