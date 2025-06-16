import React from 'react';
import { usePollManager } from '../hooks/usePollManager';
import PollDisplay from './ui/PollDisplay';
import { Loader2, AlertCircle, WifiOff } from 'lucide-react';

interface PollOption {
  id?: string;
  text: string;
  media_type?: 'none' | 'image' | 'gif';
  media_url?: string;
}

interface ResultsProps {
  activationId: string | null;
  options?: PollOption[];
  playerId?: string | null;
  roomId?: string | null;
  displayType?: 'bar' | 'pie' | 'horizontal' | 'vertical';
  resultFormat?: 'percentage' | 'votes' | 'both';
  themeColors?: {
    primary_color?: string;
    secondary_color?: string;
  };
  getStorageUrl?: (url: string) => string;
  compact?: boolean;
  className?: string;
  debugMode?: boolean;
  showOptionsOnly?: boolean;
}

/**
 * Results component that displays poll results in real-time
 * Uses the usePollManager hook to manage poll data and state
 */
const Results: React.FC<ResultsProps> = ({
  activationId,
  options = [],
  playerId,
  roomId,
  displayType = 'bar',
  resultFormat = 'both',
  themeColors = {},
  getStorageUrl = (url) => url,
  compact = false,
  className = '',
  debugMode = false,
  showOptionsOnly = false
}) => {
  // Use the poll manager hook to get poll data and state
  const {
    votes,
    votesByText,
    totalVotes,
    hasVoted,
    selectedOptionId,
    pollState,
    isLoading,
    lastUpdated
  } = usePollManager({
    activationId,
    options,
    playerId,
    roomId,
    debugMode
  });

  // Show loading state if no activation ID
  if (!activationId) {
    return (
      <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Poll Active</h3>
          <p className="text-gray-500">Waiting for poll to be activated...</p>
        </div>
      </div>
    );
  }

  // Show loading state while fetching initial data
  if (isLoading && totalVotes === 0 && Object.keys(votes).length === 0) {
    return (
      <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Poll Results</h3>
          <p className="text-gray-500">Fetching the latest voting data...</p>
        </div>
      </div>
    );
  }

  // Show error state if options are missing
  if (!options || options.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 bg-red-50 rounded-lg">
        <div className="text-center">
          <WifiOff className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-900 mb-2">No Poll Options</h3>
          <p className="text-red-600">This poll has no options configured.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Debug info - only shown in debug mode */}
      {debugMode && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <div className="font-medium text-blue-900 mb-1">Debug Info:</div>
          <div className="text-blue-700 space-y-1">
            <div>Activation ID: {activationId}</div>
            <div>Player ID: {playerId || 'None'}</div>
            <div>Poll State: {pollState}</div>
            <div>Total Votes: {totalVotes}</div>
            <div>Has Voted: {hasVoted ? 'Yes' : 'No'}</div>
            <div>Selected Option: {selectedOptionId || 'None'}</div>
            <div>Last Updated: {new Date(lastUpdated).toLocaleTimeString()}</div>
            <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
          </div>
        </div>
      )}

      {/* Poll Display Component */}
      <PollDisplay
        options={options}
        votes={votes}
        votesByText={votesByText}
        totalVotes={totalVotes}
        displayType={displayType}
        resultFormat={resultFormat}
        selectedOptionId={selectedOptionId}
        getStorageUrl={getStorageUrl}
        themeColors={themeColors}
        compact={compact}
        pollState={pollState}
        lastUpdated={lastUpdated}
        showOptionsOnly={showOptionsOnly}
      />

      {/* Loading indicator for updates */}
      {isLoading && totalVotes > 0 && (
        <div className="mt-2 flex items-center justify-center">
          <Loader2 className="w-4 h-4 text-gray-400 animate-spin mr-2" />
          <span className="text-xs text-gray-500">Updating results...</span>
        </div>
      )}

      {/* Vote confirmation for user */}
      {hasVoted && selectedOptionId && pollState === 'voting' && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
            <span className="text-sm text-green-700 font-medium">
              Your vote has been recorded
            </span>
          </div>
          <p className="text-xs text-green-600 mt-1">
            Results will be revealed when voting closes
          </p>
        </div>
      )}

      {/* No votes message */}
      {pollState === 'closed' && totalVotes === 0 && (
        <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
          <p className="text-gray-600">No votes were cast in this poll</p>
        </div>
      )}
    </div>
  );
};

export default Results;