import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { Loader2, AlertCircle, Clock } from 'lucide-react';
import PollResultsChart from './ui/PollResultsChart';
import MediaDisplay from './ui/MediaDisplay';
import { cn } from '../lib/utils';

interface ResultsProps {
  code?: string;
}

const Results: React.FC<ResultsProps> = ({ code: propCode }) => {
  const { code: urlCode } = useParams<{ code: string }>();
  const code = propCode || urlCode;
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<any>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [currentActivation, setCurrentActivation] = useState<any>(null);
  const [pollVotes, setPollVotes] = useState<{[key: string]: number}>({});
  const [pollVotesByText, setPollVotesByText] = useState<{[key: string]: number}>({});
  const [totalVotes, setTotalVotes] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Load room and current activation
  useEffect(() => {
    if (!code) {
      setError('Room code is required');
      setLoading(false);
      return;
    }
    
    const loadRoom = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get room by code
        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('room_code', code.toUpperCase())
          .single();
          
        if (roomError) {
          throw new Error('Room not found');
        }
        
        setRoom(roomData);
        setRoomId(roomData.id);
        
        // Get current game session
        const { data: sessionData, error: sessionError } = await supabase
          .from('game_sessions')
          .select('current_activation')
          .eq('room_id', roomData.id)
          .single();
          
        if (sessionError) {
          console.error('Error fetching game session:', sessionError);
          // Don't throw here, just continue without an activation
        } else if (sessionData?.current_activation) {
          // Get current activation
          const { data: activationData, error: activationError } = await supabase
            .from('activations')
            .select('*')
            .eq('id', sessionData.current_activation)
            .single();
            
          if (!activationError && activationData) {
            setCurrentActivation(activationData);
            
            // If it's a poll, fetch votes
            if (activationData.type === 'poll') {
              fetchPollVotes(activationData.id);
            }
          }
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error('Error loading room:', err);
        setError(err.message || 'Failed to load room');
        setLoading(false);
      }
    };
    
    loadRoom();

    // Set up subscription for activation changes
    const activationSubscription = supabase.channel(`activation_changes`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'activations',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        if (payload.new && currentActivation?.id === payload.new.id) {
          setCurrentActivation(payload.new);
          
          // If poll state changed, refresh votes
          if (payload.new.type === 'poll' && 
              payload.old?.poll_state !== payload.new.poll_state) {
            fetchPollVotes(payload.new.id);
          }
        }
      })
      .subscribe();
    
    // Set up subscription for game session changes
    const gameSessionSubscription = supabase.channel(`game_session_changes`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_sessions',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        // If current_activation changed, reload
        if (payload.new && payload.old && 
            payload.new.current_activation !== payload.old.current_activation) {
          loadRoom();
        }
      })
      .subscribe();
      
    return () => {
      gameSessionSubscription.unsubscribe();
      activationSubscription.unsubscribe();
    };
  }, [code, roomId]);
  
  // Function to fetch poll votes
  const fetchPollVotes = async (activationId: string) => {
    try {
      setIsRefreshing(true);
      
      // Get all votes for this poll
      const { data: voteData, error: voteError } = await supabase
        .from('poll_votes')
        .select('*')
        .eq('activation_id', activationId);
        
      if (voteError) {
        console.error('Error fetching poll votes:', voteError);
        return;
      }
      
      // Count votes by option ID and text
      const votesById: {[key: string]: number} = {};
      const votesByText: {[key: string]: number} = {};
      
      voteData?.forEach(vote => {
        // Count by option ID
        if (vote.option_id) {
          votesById[vote.option_id] = (votesById[vote.option_id] || 0) + 1;
        }
        
        // Count by option text
        if (vote.option_text) {
          votesByText[vote.option_text] = (votesByText[vote.option_text] || 0) + 1;
        }
      });
      
      setPollVotes(votesById);
      setPollVotesByText(votesByText);
      setTotalVotes(voteData?.length || 0);
    } catch (error) {
      console.error('Error fetching poll votes:', error);
    } finally {
      setIsRefreshing(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Loading Results</h2>
          <p className="text-gray-600">Please wait...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2 text-center">Error</h2>
          <p className="text-gray-600 mb-4 text-center">{error}</p>
        </div>
      </div>
    );
  }
  
  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2 text-center">Room Not Found</h2>
          <p className="text-gray-600 mb-4 text-center">
            The room with code {code} could not be found.
          </p>
        </div>
      </div>
    );
  }
  
  // Render room results
  return (
    <div 
      className="min-h-screen"
      style={{ 
        background: `linear-gradient(to bottom right, ${room.theme?.primary_color || theme.primary_color}, ${room.theme?.secondary_color || theme.secondary_color})`,
        color: room.theme?.text_color || theme.text_color
      }}
    >
      <div className="container mx-auto p-4">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            {room?.logo_url && (
              <img 
                src={room?.logo_url} 
                alt={room?.name} 
                className="h-10 w-auto mr-3"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <h1 className="text-2xl font-bold">{room?.name}</h1>
          </div>
          <div className="bg-white/20 px-3 py-1 rounded-full text-sm">
            Room {room?.room_code}
          </div>
        </header>
        
        <main className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
          {currentActivation ? (
            <div>
              <h2 className="text-xl font-semibold mb-4">{currentActivation?.question}</h2>
              
              {/* Display media if available */}
              {currentActivation?.media_type !== 'none' && currentActivation?.media_url && (
                <div className="mb-6 flex justify-center">
                  <MediaDisplay
                    url={currentActivation.media_url}
                    type={currentActivation.media_type}
                    alt="Question media"
                    className={cn(
                      "rounded-lg max-h-64 object-contain",
                      currentActivation.media_type === 'youtube' && "w-full aspect-video"
                    )}
                  />
                </div>
              )}
              
              {/* Render different content based on activation type */}
              {currentActivation?.type === 'poll' && (
                <div className="space-y-4">
                  {/* Poll state indicator */}
                  <div className="flex justify-center mb-2">
                    <div className={cn(
                      "inline-flex items-center px-3 py-1 rounded-full text-sm",
                      currentActivation.poll_state === 'pending' ? "bg-yellow-100 text-yellow-800" :
                      currentActivation.poll_state === 'voting' ? "bg-green-100 text-green-800" :
                      "bg-red-100 text-red-800"
                    )}>
                      <Clock className="w-4 h-4 mr-1" />
                      {currentActivation.poll_state === 'pending' ? 'Waiting for voting to start' :
                       currentActivation.poll_state === 'voting' ? 'Voting in progress' :
                       'Voting closed'}
                    </div>
                  </div>
                  
                  {/* Poll results */}
                  <PollResultsChart
                    options={currentActivation.options || []}
                    votes={pollVotes}
                    votesByText={pollVotesByText}
                    totalVotes={totalVotes}
                    displayType={currentActivation.poll_display_type || 'bar'}
                    resultFormat={currentActivation.poll_result_format || 'both'}
                    themeColors={room?.theme}
                  />
                  
                  {/* Total votes */}
                  <div className="text-center mt-4">
                    <button 
                      onClick={() => fetchPollVotes(currentActivation.id)}
                      className="inline-flex items-center px-3 py-1 bg-white/20 rounded-full text-sm"
                    >
                      <span className="mr-2">{totalVotes} votes</span>
                      <Loader2 className={cn("w-4 h-4", isRefreshing ? "animate-spin" : "")} />
                    </button>
                  </div>
                </div>
              )}
              
              {currentActivation?.type === 'multiple_choice' && (
                <div className="space-y-4">
                  {/* Options */}
                  <div className="space-y-3">
                    {currentActivation.options?.map((option: any, index: number) => {
                      const isCorrect = option.text === currentActivation.correct_answer;
                      return (
                        <div 
                          key={option.id || index} 
                          className={cn(
                            "p-4 rounded-lg border",
                            isCorrect ? "bg-green-50 border-green-200" : "bg-white/10 border-white/20"
                          )}
                        >
                          <div className="flex items-center">
                            {/* Option letter */}
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3",
                              isCorrect ? "bg-green-100 text-green-800" : "bg-white/20 text-white"
                            )}>
                              {String.fromCharCode(65 + index)}
                            </div>
                            
                            {/* Option media if available */}
                            {option.media_type !== 'none' && option.media_url && (
                              <div className="mr-3">
                                <MediaDisplay
                                  url={option.media_url}
                                  type={option.media_type}
                                  alt={`Option ${String.fromCharCode(65 + index)}`}
                                  className="w-10 h-10 object-cover rounded"
                                />
                              </div>
                            )}
                            
                            {/* Option text */}
                            <span className={cn(
                              "flex-1",
                              isCorrect && "font-medium"
                            )}>
                              {option.text}
                            </span>
                            
                            {/* Correct indicator */}
                            {isCorrect && (
                              <div className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                Correct
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Correct answer */}
                  {currentActivation.correct_answer && (
                    <div className="mt-4 p-4 bg-green-50 text-green-800 rounded-lg">
                      <div className="font-medium">Correct Answer:</div>
                      <div>{currentActivation.correct_answer}</div>
                    </div>
                  )}
                </div>
              )}
              
              {currentActivation?.type === 'text_answer' && (
                <div className="space-y-4">
                  {/* Exact answer */}
                  {currentActivation.exact_answer && (
                    <div className="p-4 bg-green-50 text-green-800 rounded-lg">
                      <div className="font-medium">Correct Answer:</div>
                      <div className="text-xl mt-2">{currentActivation.exact_answer}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold mb-3">Waiting for the next activity...</h2>
              <p>
                {room?.settings?.results_page_message || 'The host will start the next question or poll soon.'}
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Results;