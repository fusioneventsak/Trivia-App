import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CountdownTimerProps {
  duration: number;
  startTime?: string; // ISO timestamp when timer started
  onComplete?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showProgressBar?: boolean;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({
  duration,
  startTime,
  onComplete,
  className,
  size = 'md',
  showIcon = true,
  showProgressBar = true
}) => {
  const [timeRemaining, setTimeRemaining] = useState<number>(duration);
  const [progress, setProgress] = useState<number>(100);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const totalTimeRef = useRef<number>(duration);
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    // Check if we're on mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    let intervalId: NodeJS.Timeout | null = null;
    
    // If we have a start time, calculate the remaining time based on that
    if (startTime) {
      const startTimeMs = new Date(startTime).getTime();
      const currentTimeMs = new Date().getTime();
      const elapsedMs = currentTimeMs - startTimeMs;
      const totalTimeMs = duration * 1000;
      totalTimeRef.current = duration;
      
      // If timer has already expired
      if (elapsedMs >= totalTimeMs) {
        setTimeRemaining(0);
        setProgress(0);
        setIsComplete(true);
        onComplete?.();
        return;
      }
      
      // Calculate remaining time
      const remainingMs = totalTimeMs - elapsedMs;
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      setTimeRemaining(remainingSeconds);
      setProgress((remainingSeconds / duration) * 100);
    } else {
      // No start time provided, just use duration
      setTimeRemaining(duration);
      totalTimeRef.current = duration;
      setProgress(100);
    }
    
    // Start the countdown
    intervalId = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          setIsComplete(true);
          setProgress(0);
          onComplete?.();
          return 0;
        }
        
        const newTime = prev - 1;
        setProgress((newTime / totalTimeRef.current) * 100);
        return newTime;
      });
    }, 1000);
    
    intervalRef.current = intervalId;
    
    // Cleanup on unmount
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      window.removeEventListener('resize', checkMobile);
    };
  }, [duration, startTime, onComplete]);
  
  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  // Determine size classes based on variant
  const sizeClasses = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-xl'
  };
  
  // Determine color based on remaining time
  const getColorClass = () => {
    const percentage = (timeRemaining / totalTimeRef.current) * 100;
    if (percentage <= 25) return 'bg-red-500/30';
    if (percentage <= 50) return 'bg-yellow-500/30';
    return 'bg-green-500/30';
  };
  
  return (
    <div className={cn("flex flex-col items-center", isMobile && size !== 'sm' && "w-full")}>
      <div 
        className={cn(
          "inline-flex items-center justify-center rounded-full text-white font-mono font-bold",
          isComplete ? "bg-red-500/30" : getColorClass(),
          sizeClasses[size],
          className
        )}
      >
        {showIcon && <Clock className={cn("mr-2", {
          'w-3 h-3': size === 'sm',
          'w-5 h-5': size === 'md',
          'w-6 h-6': size === 'lg',
        })} />}
        <span>{formatTime(timeRemaining)}</span>
      </div>
      
      {showProgressBar && (
        <div className="w-full mt-2 bg-white/20 rounded-full h-1.5 max-w-[200px]">
          <div 
            className={cn(
              "h-1.5 rounded-full transition-all duration-1000 ease-linear",
              isComplete ? "bg-red-500" : timeRemaining / totalTimeRef.current <= 0.25 ? "bg-red-500" : timeRemaining / totalTimeRef.current <= 0.5 ? "bg-yellow-500" : "bg-green-500"
            )}
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      )}
    </div>
  );
};

export default CountdownTimer;