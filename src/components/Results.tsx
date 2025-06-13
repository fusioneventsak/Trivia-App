import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Share2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface PollOption {
  id: string;
  text: string;
  votes: number;
}

interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  createdAt: string;
  isActive: boolean;
}

interface ResultsProps {
  pollId: string;
  onBack?: () => void;
}

const Results: React.FC<ResultsProps> = ({ pollId, onBack }) => {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [animateResults, setAnimateResults] = useState(false);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchPollResults();
    
    // Set up polling for live updates
    pollInterval.current = setInterval(fetchPollResults, 5000);
    
    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, [pollId]);

  useEffect(() => {
    // Trigger animation after data loads
    if (poll && !loading) {
      setTimeout(() => setAnimateResults(true), 100);
    }
  }, [poll, loading]);

  const fetchPollResults = async () => {
    try {
      // Replace with your actual API endpoint
      const response = await fetch(`/api/polls/${pollId}`);
      if (!response.ok) throw new Error('Failed to fetch poll results');
      
      const data = await response.json();
      setPoll(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/poll/${pollId}/results`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: poll?.question || 'Poll Results',
          text: 'Check out these poll results!',
          url: shareUrl,
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareUrl);
      alert('Link copied to clipboard!');
    }
  };

  const getPercentage = (votes: number) => {
    if (!poll || poll.totalVotes === 0) return 0;
    return Math.round((votes / poll.totalVotes) * 100);
  };

  const getTopOption = () => {
    if (!poll) return null;
    return poll.options.reduce((max, option) => 
      option.votes > max.votes ? option : max
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchPollResults}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!poll) return null;

  const topOption = getTopOption();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
          )}
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
          {/* Question */}
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            {poll.question}
          </h1>
          
          {/* Total Votes */}
          <p className="text-gray-600 mb-6">
            {poll.totalVotes.toLocaleString()} {poll.totalVotes === 1 ? 'vote' : 'votes'}
          </p>

          {/* Results */}
          <div className="space-y-4">
            {poll.options.map((option, index) => {
              const percentage = getPercentage(option.votes);
              const isWinner = topOption?.id === option.id && poll.totalVotes > 0;
              
              return (
                <div
                  key={option.id}
                  className={`relative rounded-lg border-2 transition-all ${
                    isWinner ? 'border-green-500 bg-green-50' : 'border-gray-200'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {isWinner && (
                          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm">1st</span>
                          </div>
                        )}
                        <div className="flex-1 font-medium">{option.text}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">{percentage}%</div>
                        <div className="text-sm text-gray-600">
                          {option.votes.toLocaleString()} {option.votes === 1 ? 'vote' : 'votes'}
                        </div>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`absolute top-0 left-0 h-full transition-all duration-1000 ease-out ${
                          isWinner ? 'bg-green-500' : 'bg-blue-500'
                        }`}
                        style={{
                          width: animateResults ? `${percentage}%` : '0%',
                          transitionDelay: `${index * 100}ms`
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Poll Details */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              {showDetails ? (
                <>
                  <ChevronUp className="w-5 h-5" />
                  Hide Details
                </>
              ) : (
                <>
                  <ChevronDown className="w-5 h-5" />
                  Show Details
                </>
              )}
            </button>
            
            {showDetails && (
              <div className="mt-4 space-y-2 text-sm text-gray-600">
                <p>Poll ID: {poll.id}</p>
                <p>Created: {new Date(poll.createdAt).toLocaleDateString()}</p>
                <p>Status: {poll.isActive ? 'Active' : 'Closed'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Live Update Indicator */}
        {poll.isActive && (
          <div className="mt-4 text-center text-sm text-gray-500">
            <RefreshCw className="w-4 h-4 inline-block mr-1" />
            Results update live every 5 seconds
          </div>
        )}
      </div>
    </div>
  );
};

export default Results;