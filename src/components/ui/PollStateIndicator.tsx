import React from 'react';
import { Clock, PlayCircle, Lock } from 'lucide-react';
import { cn } from '../../lib/utils';

type PollState = 'pending' | 'voting' | 'closed';

interface PollStateIndicatorProps {
  state: PollState;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const PollStateIndicator: React.FC<PollStateIndicatorProps> = ({ 
  state, 
  className = '',
  size = 'md' 
}) => {
  // Determine styling based on state
  let bgColor = '';
  let textColor = '';
  let icon = null;
  let label = '';
  
  // Configure styles and content based on state
  switch (state) {
    case 'pending':
      bgColor = 'bg-yellow-500/20';
      textColor = 'text-yellow-100';
      icon = <Clock className={size === 'sm' ? 'w-3 h-3 mr-1' : size === 'lg' ? 'w-6 h-6 mr-2' : 'w-5 h-5 mr-2'} />;
      label = 'Waiting for voting to start';
      break;
    case 'voting':
      bgColor = 'bg-green-500/20';
      textColor = 'text-green-100';
      icon = <PlayCircle className={size === 'sm' ? 'w-3 h-3 mr-1' : size === 'lg' ? 'w-6 h-6 mr-2' : 'w-5 h-5 mr-2'} />;
      label = 'Voting is open';
      break;
    case 'closed':
      bgColor = 'bg-red-500/20';
      textColor = 'text-red-100';
      icon = <Lock className={size === 'sm' ? 'w-3 h-3 mr-1' : size === 'lg' ? 'w-6 h-6 mr-2' : 'w-5 h-5 mr-2'} />;
      label = 'Voting is locked';
      break;
  }
  
  // Size-based styling
  const padding = size === 'sm' ? 'px-2 py-1' : size === 'lg' ? 'px-6 py-3' : 'px-4 py-2';
  const fontSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm';
  
  return (
    <div className={cn(padding, "rounded-full flex items-center", bgColor, textColor, fontSize, className)}>
      {icon}
      <span>{label}</span>
    </div>
  );
};

export default PollStateIndicator;