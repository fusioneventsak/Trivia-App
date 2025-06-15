import { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CountdownTimerProps {
  initialSeconds: number;
  startTime?: string; // ISO timestamp when timer started
  onComplete?: () => void;
  className?: string;
  variant?: 'default' | 'large' | 'small';
  showIcon?: boolean;
  showProgressBar?: boolean;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({
  initialSeconds,
  startTime,
  onComplete,
  className,
  variant = 'default',
  showIcon = true,
  showProgressBar = true
}) => {
  const [timeRemaining, setTimeRemaining] = useState<number>(initialSeconds);
  const [progress, setProgress] = useState<number>(100);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const totalTimeRef = useRef<number>(initialSeconds);
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    // Check if mobile on mount and window resize
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    // Initialize timer based on start time if provided
    if (startTime) {
      const startTimeMs = new Date(startTime).getTime();
      const currentTimeMs = new Date().getTime();
      const elapsedMs = currentTimeMs - startTimeMs;
      const totalTimeMs = initialSeconds * 1000;
      totalTimeRef.current = initialSeconds;
      
      // If timer has already expired
      if (elapsedMs >= totalTimeMs) {
        setTimeRemaining(0);
        setProgress(0);
        setIsComplete(true);
        if (onComplete) onComplete();
        return;
      }
      
      // Calculate remaining time
      const remainingMs = totalTimeMs - elapsedMs;
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      setTimeRemaining(remainingSeconds);
      setProgress((remainingSeconds / initialSeconds) * 100);
    } else {
      // No start time provided, just use initialSeconds
      setTimeRemaining(initialSeconds);
      totalTimeRef.current = initialSeconds;
      setProgress(100);
    }
    
    // Set up interval to update timer
    intervalRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setIsComplete(true);
          setProgress(0);
          if (onComplete) onComplete();
          return 0;
        }
        const newTime = prev - 1;
        setProgress((newTime / totalTimeRef.current) * 100);
        return newTime;
      });
    }, 1000);
    
    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      window.removeEventListener('resize', checkMobile);
    };
  }, [initialSeconds, startTime, onComplete]);
  
  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Determine size classes based on variant
  const sizeClasses = {
    small: 'px-2 py-1 text-sm',
    default: 'px-4 py-2 text-base',
    large: 'px-6 py-3 text-xl'
  };
  
  // Determine color based on remaining time
  const getColorClass = () => {
    const percentage = (timeRemaining / totalTimeRef.current) * 100;
    if (percentage > 50) return 'bg-green-500';
    if (percentage > 25) return 'bg-yellow-500';
    return 'bg-red-500';
  };
  
  return (
    <div className={cn("flex flex-col items-center", isMobile && variant !== 'small' && "w-full")}>
      <div 
        className={cn(
          "inline-flex items-center justify-center rounded-full text-white font-mono font-bold",
           isComplete ? "bg-red-500/30" : getColorClass(),
          sizeClasses[variant],
          className
        )}
      >
        {showIcon && <Clock className={cn("mr-2", {
          'w-3 h-3': variant === 'small',
          'w-5 h-5': variant === 'default',
          'w-6 h-6': variant === 'large',
        })} />}
        <span>{formatTime(timeRemaining)}</span>
      </div>
      
      {showProgressBar && !isComplete && (
        <div className="w-full h-1 bg-gray-200 rounded-full mt-2">
          <div 
            className={cn(
              "h-full rounded-full transition-all duration-1000",
              getColorClass()
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default CountdownTimer;