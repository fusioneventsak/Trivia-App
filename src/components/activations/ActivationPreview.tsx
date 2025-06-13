import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, Send, Trophy, Users, Clock, Lock, PlayCircle } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import CountdownTimer from '../ui/CountdownTimer';
import MediaDisplay from '../ui/MediaDisplay';
import PollStateIndicator from '../ui/PollStateIndicator';

interface Option {
  text: string;
  media_type: 'none' | 'image' | 'gif';
  media_url: string;
  color?: string;
}

interface Activation {
  id?: string;
  type: 'multiple_choice' | 'text_answer' | 'poll' | 'social_wall' | 'leaderboard';
  question: string;
  options?: Option[];
  correct_answer?: string;
  exact_answer?: string;
  media_type: 'none' | 'image' | 'youtube' | 'gif';
  media_url?: string;
  poll_state?: 'pending' | 'voting' | 'closed';
  poll_display_type?: 'bar' | 'pie' | 'horizontal' | 'vertical';
  poll_result_format?: 'percentage' | 'votes' | 'both';
  title?: string;
  description?: string;
  max_players?: number;
  theme?: {
    primary_color: string;
    secondary_color: string;
    text_color: string;
    background_color: string;
    container_bg_color?: string;
  };
  logo_url?: string;
  time_limit?: number;
  show_answers?: boolean;
  timer_started_at?: string;
}

interface PollVotes {
  [key: string]: number;
}

const ActivationPreview: React.FC<{ activation: Activation }> = ({ activation }) => {
  const { theme: globalTheme } = useTheme();
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [textAnswer, setTextAnswer] = useState('');
  const [hasAnswered, setHasAnswered] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [showAnswers, setShowAnswers] = useState<boolean>(true);
  
  // For poll display
  const [pollVotes, setPollVotes] = useState<PollVotes>({});
  const [totalVotes, setTotalVotes] = useState(0);
  const [pollVoted, setPollVoted] = useState(false);
  const [pollState, setPollState] = useState<'pending' | 'voting' | 'closed'>(activation.poll_state || 'pending');
  
  // Mock players for leaderboard preview
  const [mockPlayers] = useState(Array.from({ length: 20 }, (_, i) => ({
    id: `player-${i}`,
    name: `Player ${i + 1}`,
    score: Math.floor(Math.random() * 1000) + 100
  })).sort((a, b) => b.score - a.score));
  
  // Initialize poll votes
  useEffect(() => {
    if (activation.type === 'poll' && activation.options) {
      // Generate random votes for preview
      const votes: PollVotes = {};
      let total = 0;
      
      activation.options.forEach(option => {
        const count = Math.floor(Math.random() * 20);
        votes[option.text] = count;
        total += count;
      });
      
      setPollVotes(votes);
      setTotalVotes(total);
    }
  }, [activation.type, activation.options]);
  
  // Initialize timer if time_limit is set
  useEffect(() => {
    // Reset states
    setTimeRemaining(null);
    setShowAnswers(activation.show_answers !== false);
    setHasAnswered(false);
    setShowResult(false);
    setPollState(activation.poll_state || 'pending');
    
    // If time limit is set, start the timer
    if (activation.time_limit && activation.time_limit > 0) {
      setTimeRemaining(activation.time_limit);
      setShowAnswers(false);
      
      // Start countdown
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(timer);
            setShowAnswers(activation.show_answers !== false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [activation.time_limit, activation.show_answers, activation.poll_state]);
  
  const handleMultipleChoiceAnswer = (answer: string) => {
    if (hasAnswered) return;
    
    setSelectedAnswer(answer);
    setHasAnswered(true);
    setShowResult(true);
    
    if (activation.correct_answer) {
      setIsCorrect(answer === activation.correct_answer);
    }
  };
  
  const handleTextAnswerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasAnswered) return;
    
    setHasAnswered(true);
    setShowResult(true);
    
    if (activation.exact_answer) {
      const userAnswer = textAnswer.trim().toLowerCase();
      const correctAnswer = activation.exact_answer.trim().toLowerCase();
      setIsCorrect(userAnswer === correctAnswer);
    }
  };
  
  const handlePollVote = (answer: string) => {
    if (pollVoted || pollState === 'closed') return;
    
    setSelectedAnswer(answer);
    setPollVoted(true);
    
    // Update votes
    const newVotes = { ...pollVotes };
    newVotes[answer] = (newVotes[answer] || 0) + 1;
    setPollVotes(newVotes);
    
    setTotalVotes(totalVotes + 1);
  };
  
  const renderLeaderboard = () => {
    // Get theme colors from the activation or use defaults
    const activeTheme = activation.theme || globalTheme;
    const primaryColor = activeTheme.primary_color;
    const secondaryColor = activeTheme.secondary_color;
    const textColor = activeTheme.text_color;
    const backgroundColor = activeTheme.container_bg_color || 'rgba(0,0,0,0.2)';
    
    // Get branding settings
    const title = activation.title || 'Leaderboard';
    const logoUrl = activation.logo_url;
    const maxPlayers = activation.max_players || 20;
    
    // Use mock players for preview
    const displayPlayers = mockPlayers.slice(0, maxPlayers);
    
    // Determine if we should use two columns (more than 10 players)
    const useTwoColumns = displayPlayers.length > 10;
    
    // Split players into columns if needed
    const firstColumnPlayers = useTwoColumns 
      ? displayPlayers.slice(0, Math.ceil(displayPlayers.length / 2))
      : displayPlayers;
    
    const secondColumnPlayers = useTwoColumns
      ? displayPlayers.slice(Math.ceil(displayPlayers.length / 2))
      : [];
    
    return (
      <div 
        className="w-full rounded-xl p-6"
        style={{ backgroundColor }}
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            {logoUrl && (
              <img 
                src={logoUrl} 
                alt="Logo" 
                className="h-16 w-auto object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <h2 
              className="text-3xl font-bold"
              style={{ color: textColor }}
            >
              {title}
            </h2>
          </div>
          <div 
            className="flex items-center gap-2 px-4 py-2 rounded-full"
            style={{ backgroundColor: `${primaryColor}40` }}
          >
            <Users className="w-5 h-5" style={{ color: textColor }} />
            <span style={{ color: textColor }}>{displayPlayers.length} Players</span>
          </div>
        </div>
        
        <div className={`grid ${useTwoColumns ? 'grid-cols-1 md:grid-cols-2 gap-x-6' : 'grid-cols-1'} gap-y-4`}>
          {/* First column */}
          <div className="space-y-4">
            {firstColumnPlayers.map((player, index) => {
              // Calculate background opacity based on position
              const opacity = Math.max(0.1, 1 - (index * 0.05));
              const isTopPlayer = index === 0 && !useTwoColumns;
              const actualRank = index + 1;
              
              return (
                <div 
                  key={player.id}
                  className={`flex items-center p-4 rounded-xl transition-all ${
                    isTopPlayer ? 'animate-pulse-slow' : ''
                  }`}
                  style={{ 
                    backgroundColor: isTopPlayer 
                      ? `${secondaryColor}80` 
                      : `${primaryColor}${Math.floor(opacity * 60).toString(16)}` 
                  }}
                >
                  <div 
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-bold mr-4 ${
                      actualRank === 1 
                        ? 'bg-yellow-300 text-yellow-800 text-xl' 
                        : actualRank === 2 
                          ? 'bg-gray-300 text-gray-700'
                          : actualRank === 3
                            ? 'bg-amber-400 text-amber-800'
                            : 'bg-white/20 text-white'
                    }`}
                  >
                    {actualRank}
                  </div>
                  <div className="flex-1">
                    <div 
                      className="font-bold text-xl"
                      style={{ color: textColor }}
                    >
                      {player.name}
                    </div>
                  </div>
                  <div 
                    className={`text-2xl font-bold px-4 py-2 rounded-lg ${isTopPlayer ? 'animate-shimmer' : ''}`}
                    style={{ 
                      backgroundColor: isTopPlayer ? `${primaryColor}80` : `${secondaryColor}40`,
                      color: textColor
                    }}
                  >
                    {player.score}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Second column (if using two columns) */}
          {useTwoColumns && (
            <div className="space-y-4">
              {secondColumnPlayers.map((player, index) => {
                // Calculate background opacity based on position
                const opacity = Math.max(0.1, 1 - (index * 0.05));
                const actualRank = index + 1 + Math.ceil(displayPlayers.length / 2);
                
                return (
                  <div 
                    key={player.id}
                    className="flex items-center p-4 rounded-xl"
                    style={{ 
                      backgroundColor: `${primaryColor}${Math.floor(opacity * 60).toString(16)}`
                    }}
                  >
                    <div 
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold mr-4 ${
                        actualRank === 1 
                          ? 'bg-yellow-300 text-yellow-800 text-xl' 
                          : actualRank === 2 
                            ? 'bg-gray-300 text-gray-700'
                            : actualRank === 3
                              ? 'bg-amber-400 text-amber-800'
                              : 'bg-white/20 text-white'
                      }`}
                    >
                      {actualRank}
                    </div>
                    <div className="flex-1">
                      <div 
                        className="font-bold text-xl"
                        style={{ color: textColor }}
                      >
                        {player.name}
                      </div>
                    </div>
                    <div 
                      className="text-2xl font-bold px-4 py-2 rounded-lg"
                      style={{ 
                        backgroundColor: `${secondaryColor}40`,
                        color: textColor
                      }}
                    >
                      {player.score}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };
  
  const renderMediaContent = () => {
    if (!activation.media_url || activation.media_type === 'none') return null;
    
    return (
      <div className="flex justify-center items-center mb-4">
        {activation.media_type === 'youtube' ? (
          <div className="w-full max-w-md rounded-lg shadow-sm overflow-hidden">
            <div className="aspect-video max-h-40">
              <MediaDisplay
                url={activation.media_url}
                type={activation.media_type}
                alt="Question media"
                className="w-full h-full"
                fallbackText="Video not available"
                onError={(e) => {
                  console.warn(`Failed to load question media: ${activation.media_url}`);
                }}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-lg shadow-sm bg-gray-100 p-1 overflow-hidden inline-block">
            <MediaDisplay
              url={activation.media_url}
              type={activation.media_type}
              alt="Question media"
              className="max-h-40 object-contain"
              fallbackText="Image not available"
              onError={(e) => {
                console.warn(`Failed to load question media: ${activation.media_url}`);
              }}
            />
          </div>
        )}
      </div>
    );
  };
  
  const renderAnswerResult = () => {
    if (!showResult || !showAnswers) return null;
    
    return (
      <div className={`
        mt-4 p-4 rounded-lg text-center transform transition-all duration-300 ease-out
        ${isCorrect
          ? 'bg-green-100 text-green-800'
          : 'bg-red-100 text-red-800'
        }
      `}>
        <div className="flex items-center justify-center gap-2 text-lg font-semibold">
          {isCorrect ? (
            <>
              <CheckCircle className="w-5 h-5" />
              <span>Correct Answer!</span>
            </>
          ) : (
            <>
              <XCircle className="w-5 h-5" />
              <span>Wrong Answer</span>
            </>
          )}
        </div>
        {!isCorrect && activation.type === 'multiple_choice' && showAnswers && (
          <p className="text-sm mt-1 opacity-90">
            The correct answer was: <span className="font-medium">{activation.correct_answer}</span>
          </p>
        )}
        {!isCorrect && activation.type === 'text_answer' && showAnswers && (
          <p className="text-sm mt-1 opacity-90">
            The correct answer was: <span className="font-medium">{activation.exact_answer}</span>
          </p>
        )}
      </div>
    );
  };
  
  const renderPollResults = () => {
    if (!activation.options) return null;

    const displayType = activation.poll_display_type || 'bar';
    const resultFormat = activation.poll_result_format || 'both';
    
    const getDisplayLabel = (votes: number, percentage: string): string => {
      if (resultFormat === 'percentage') return `${percentage}%`;
      if (resultFormat === 'votes') return `${votes}`;
      return `${votes} (${percentage}%)`;
    };
    
    // Get theme colors from room or activation
    const activeTheme = activation.theme || globalTheme;
    
    return (
      <div className="mt-4 p-3 bg-white/10 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-white text-sm">Poll Results</h3>
          <div className="text-sm text-white/80">{totalVotes} votes</div>
        </div>
        
        {/* Poll State Indicator */}
        <PollStateIndicator state={pollState} size="sm" className="mb-3" />
        
        {displayType === 'pie' ? (
          <div className="relative w-48 h-48 mx-auto">
            {/* Simple pie chart representation */}
            <div className="w-full h-full rounded-full overflow-hidden bg-white/20 flex">
              {activation.options.map((option, index) => {
                const votes = pollVotes[option.text] || 0;
                const percentage = totalVotes > 0 ? (votes / totalVotes * 100) : 0;
                return percentage > 0 ? (
                  <div 
                    key={index}
                    className="h-full"
                    style={{ 
                      width: `${percentage}%`,
                      backgroundColor: getColorForIndex(index, activeTheme)
                    }}
                  />
                ) : null;
              })}
            </div>
            
            <div className="mt-4 space-y-1">
              {activation.options.map((option, index) => {
                const votes = pollVotes[option.text] || 0;
                const percentage = totalVotes > 0 ? (votes / totalVotes * 100).toFixed(1) : '0.0';
                
                return (
                  <div key={index} className="flex items-center gap-1 text-xs">
                    <div 
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: getColorForIndex(index, activeTheme) }}
                    />
                    <div className="flex items-center gap-1 flex-1 text-white truncate">
                      {option.media_type !== 'none' && option.media_url && (
                        <div className="w-4 h-4 rounded-full overflow-hidden flex-shrink-0 bg-black/20">
                          <img
                            src={option.media_url}
                            alt={option.text}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              console.warn(`Failed to load poll option image: ${option.media_url}`);
                              e.currentTarget.style.display = 'none';
                              const parent = e.currentTarget.parentElement;
                              if (parent && !parent.querySelector('.fallback-icon')) {
                                const fallback = document.createElement('div');
                                fallback.className = 'fallback-icon w-full h-full flex items-center justify-center text-white/50 text-xs';
                                fallback.textContent = '?';
                                parent.appendChild(fallback);
                              }
                            }}
                          />
                        </div>
                      )}
                      <span className="truncate">{option.text}</span>
                    </div>
                    <div className="text-xs text-white/80">{getDisplayLabel(votes, percentage)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : displayType === 'vertical' ? (
          // Vertical layout
          <div className="space-y-3">
            {activation.options.map((option, index) => {
              const votes = pollVotes[option.text] || 0;
              const percentage = totalVotes > 0 ? (votes / totalVotes * 100) : 0;
              
              return (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-white max-w-[80%]">
                      {option.media_type !== 'none' && option.media_url && (
                        <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 bg-black/20">
                          <img
                            src={option.media_url}
                            alt={option.text}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              console.warn(`Failed to load poll option image: ${option.media_url}`);
                              e.currentTarget.style.display = 'none';
                              const parent = e.currentTarget.parentElement;
                              if (parent && !parent.querySelector('.fallback-icon')) {
                                const fallback = document.createElement('div');
                                fallback.className = 'fallback-icon w-full h-full flex items-center justify-center text-white/50 text-xs';
                                fallback.textContent = '?';
                                parent.appendChild(fallback);
                              }
                            }}
                          />
                        </div>
                      )}
                      <span className="truncate font-medium">{option.text}</span>
                    </div>
                    <div className="text-sm text-white font-mono">
                      {getDisplayLabel(votes, percentage.toFixed(1))}
                    </div>
                  </div>
                  
                  {/* Vertical bar */}
                  <div className="h-24 bg-white/20 rounded-lg overflow-hidden w-full relative">
                    <div 
                      className="absolute bottom-0 left-0 w-full transition-all duration-500 ease-out flex justify-center items-end"
                      style={{ 
                        height: `${Math.max(percentage, 4)}%`,
                        backgroundColor: getColorForIndex(index, activeTheme)
                      }}
                    >
                      {percentage >= 20 && (
                        <span className="text-xs text-white font-medium mb-1">
                          {option.text}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {activation.options.map((option, index) => {
              const votes = pollVotes[option.text] || 0;
              const percentage = totalVotes > 0 ? (votes / totalVotes * 100) : 0;
              
              return (
                <div key={index} className="space-y-0.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1 text-white max-w-[70%]">
                      {option.media_type !== 'none' && option.media_url && (
                        <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 bg-black/20">
                          <img
                            src={option.media_url}
                            alt={option.text}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              console.warn(`Failed to load poll option image: ${option.media_url}`);
                              e.currentTarget.style.display = 'none';
                              const parent = e.currentTarget.parentElement;
                              if (parent && !parent.querySelector('.fallback-icon')) {
                                const fallback = document.createElement('div');
                                fallback.className = 'fallback-icon w-full h-full flex items-center justify-center text-white/50 text-xs';
                                fallback.textContent = '?';
                                parent.appendChild(fallback);
                              }
                            }}
                          />
                        </div>
                      )}
                      <span className="truncate">{option.text}</span>
                    </div>
                    <span className="text-xs text-white font-mono">
                      {getDisplayLabel(votes, percentage.toFixed(1))}
                    </span>
                  </div>
                  
                  {/* Bar representation */}
                  <div className="w-full bg-white/20 rounded-full h-5 overflow-hidden">
                    <div 
                      className="h-full transition-all duration-500 ease-out flex items-center px-2"
                      style={{ 
                        width: `${Math.max(percentage, 4)}%`,
                        backgroundColor: getColorForIndex(index, activeTheme)
                      }}
                    >
                      {percentage >= 15 && (
                        <span className="text-xs text-white font-medium truncate">
                          {option.text}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };
  
  const getColorForIndex = (index: number, theme?: any) => {
    // Use theme colors if available
    if (theme) {
      const baseColors = [
        theme.primary_color || '#3B82F6',
        theme.secondary_color || '#8B5CF6',
        theme.success_color || '#10B981',
        theme.warning_color || '#F59E0B',
        theme.error_color || '#EF4444',
        '#06B6D4', // Cyan
        '#EC4899', // Pink
        '#F97316', // Orange
        '#14B8A6', // Teal
      ];
      return baseColors[index % baseColors.length];
    }
    
    // Fallback colors
    const colors = [
      '#3B82F6', // Blue
      '#10B981', // Green
      '#F59E0B', // Yellow
      '#8B5CF6', // Purple
      '#EC4899', // Pink
      '#6366F1'  // Indigo
    ];
    return colors[index % colors.length];
  };
  
  // Special case for leaderboard
  if (activation.type === 'leaderboard') {
    return (
      <div className="p-4 h-full flex flex-col bg-gray-100">
        <div className="flex-1 overflow-y-auto">
          {renderLeaderboard()}
        </div>
        
        <div className="mt-6 py-2 border-t text-center text-sm text-gray-500">
          Preview Mode - Leaderboard will display actual player data when activated
        </div>
      </div>
    );
  }
  
  // Get theme colors from the activation or use defaults
  const activeTheme = activation.theme || globalTheme;
  const containerBgColor = activeTheme.container_bg_color || 'rgba(255, 255, 255, 0.1)';
  
  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div 
          className="text-center mb-4 p-4 rounded-lg"
          style={{ backgroundColor: containerBgColor }}
        >
          <div className="mb-1 inline-block px-2 py-1 bg-gray-100 text-xs rounded-full uppercase tracking-wide font-semibold text-gray-500">
            {activation.type === 'multiple_choice' 
              ? 'Multiple Choice' 
              : activation.type === 'text_answer'
                ? 'Text Answer'
                : activation.type === 'poll'
                  ? 'Poll'
                  : 'Social Wall'}
          </div>
          
          {/* Timer display */}
          {activation.time_limit && (
            <div className="mb-2 flex justify-center">
              <CountdownTimer 
                initialSeconds={activation.time_limit}
                startTime={activation.timer_started_at}
                variant="default"
                onComplete={() => setShowAnswers(true)}
              />
            </div>
          )}
          
          {/* Poll state indicator for polls */}
          {activation.type === 'poll' && (
            <div className="mb-2 flex justify-center">
              <PollStateIndicator state={pollState} size="sm" />
            </div>
          )}
          
          <h2 className="text-xl font-semibold text-gray-800 mb-4">{activation.question}</h2>
          
          {renderMediaContent()}
        </div>
        
        {/* Multiple Choice Question */}
        {activation.type === 'multiple_choice' && activation.options && (
          <div 
            className="grid grid-cols-2 gap-4"
            style={{ backgroundColor: containerBgColor, padding: '16px', borderRadius: '8px' }}
          >
            {activation.options.map((option, index) => {
              const isSelected = option.text === selectedAnswer;
              const isCorrect = option.text === activation.correct_answer;
              const showCorrect = hasAnswered && showAnswers && isCorrect;
              const showIncorrect = hasAnswered && showAnswers && isSelected && !isCorrect;
              
              return (
                <button
                  key={index}
                  onClick={() => handleMultipleChoiceAnswer(option.text)}
                  disabled={hasAnswered}
                  className={`
                    relative p-3 rounded-xl text-left transition 
                    ${hasAnswered
                      ? showCorrect
                        ? 'bg-green-100 text-green-700 ring-2 ring-green-500'
                        : showIncorrect
                          ? 'bg-red-100 text-red-700 ring-2 ring-red-500'
                          : isSelected
                            ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500'
                            : 'bg-gray-100 text-gray-500'
                      : 'bg-white shadow-md hover:shadow-lg border-2 border-purple-100 hover:border-purple-300'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    {option.media_type !== 'none' && option.media_url && (
                      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gray-100 border-2 border-gray-200">
                        <img
                          src={option.media_url}
                          alt={option.text}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.warn(`Failed to load option image: ${option.media_url}`);
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent && !parent.querySelector('.fallback-icon')) {
                              const fallback = document.createElement('div');
                              fallback.className = 'fallback-icon w-full h-full flex items-center justify-center text-gray-400 bg-gray-100';
                              fallback.textContent = '?';
                              parent.appendChild(fallback);
                            }
                          }}
                        />
                      </div>
                    )}
                    <div className="flex-1 font-medium truncate">{option.text}</div>
                  </div>
                  
                  {showCorrect && (
                    <div className="absolute -top-2 -right-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                  {showIncorrect && (
                    <div className="absolute -top-2 -right-2">
                      <XCircle className="w-5 h-5 text-red-500" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
        
        {/* Text Answer Question */}
        {activation.type === 'text_answer' && (
          <form onSubmit={handleTextAnswerSubmit} className="space-y-4">
            <div 
              className="p-4 rounded-lg"
              style={{ backgroundColor: containerBgColor }}
            >
              {/* Timer display for text answer */}
              {activation.time_limit && (
                <div className="mb-4 flex justify-center">
                  <CountdownTimer 
                    initialSeconds={activation.time_limit}
                    startTime={activation.timer_started_at}
                    variant="default"
                    onComplete={() => setShowAnswers(true)}
                  />
                </div>
              )}
              
              {showAnswers ? (
                <div className="bg-green-100 text-green-800 p-4 rounded-lg">
                  <div className="font-medium mb-1">Correct Answer:</div>
                  <div className="text-lg">{activation.exact_answer}</div>
                </div>
              ) : (
                <input
                  type="text"
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  disabled={hasAnswered}
                  className={`w-full px-4 py-3 bg-white/10 border ${
                    hasAnswered 
                      ? showResult 
                        ? isCorrect 
                          ? 'border-green-400' 
                          : 'border-red-400' 
                        : 'border-white/30' 
                      : 'border-white/30'
                  } rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50`}
                />
              )}
            </div>
            
            {!hasAnswered && !showAnswers && (
              <button
                type="submit"
                disabled={!textAnswer.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: activeTheme.primary_color }}
              >
                <Send className="w-4 h-4" />
                Submit Answer
              </button>
            )}
            
            {showResult && renderAnswerResult()}
          </form>
        )}
        
        {/* Poll Question */}
        {activation.type === 'poll' && activation.options && (
          <div 
            className="mt-4"
            style={{ backgroundColor: containerBgColor, padding: '16px', borderRadius: '8px' }}
          >
            {/* Timer display for poll */}
            {activation.time_limit && (
              <div className="mb-4 flex justify-center">
                <CountdownTimer 
                  initialSeconds={activation.time_limit}
                  startTime={activation.timer_started_at}
                  variant="default"
                  onComplete={() => setPollVoted(true)}
                />
              </div>
            )}
            
            <div className="grid grid-cols-1 gap-3">
              {!pollVoted && pollState !== 'closed' ? (
                activation.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handlePollVote(option.text)}
                    disabled={pollVoted || pollState === 'closed'}
                    className="p-4 rounded-xl text-left transition hover:shadow-lg bg-white shadow-md border-2 border-blue-100 hover:border-blue-300"
                  >
                    <div className="flex items-center gap-3">
                      {option.media_type !== 'none' && option.media_url && (
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-200">
                          <img
                            src={option.media_url}
                            alt={option.text}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              console.warn(`Failed to load poll option image: ${option.media_url}`);
                              e.currentTarget.style.display = 'none';
                              const parent = e.currentTarget.parentElement;
                              if (parent && !parent.querySelector('.fallback-icon')) {
                                const fallback = document.createElement('div');
                                fallback.className = 'fallback-icon w-full h-full flex items-center justify-center text-gray-400 bg-gray-100';
                                fallback.textContent = '?';
                                parent.appendChild(fallback);
                              }
                            }}
                          />
                        </div>
                      )}
                      <div className="flex-1 font-medium">{option.text}</div>
                    </div>
                  </button>
                ))
              ) : (
                renderPollResults()
              )}
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-6 py-2 border-t text-center text-sm text-gray-500">
        Preview Mode - Activation will appear like this to your audience
      </div>
    </div>
  );
};

export default ActivationPreview;