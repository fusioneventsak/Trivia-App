import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

interface NetworkStatusProps {
  onRetry?: () => void;
  className?: string;
}

/**
 * A component that displays the current network status and provides a retry button
 */
const NetworkStatus: React.FC<NetworkStatusProps> = ({ onRetry, className }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = () => {
    setIsRetrying(true);
    
    // If a custom retry handler is provided, use it
    if (onRetry) {
      onRetry();
    } else {
      // Default behavior: refresh the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
    
    // Reset retrying state after a timeout
    setTimeout(() => {
      setIsRetrying(false);
    }, 2000);
  };

  return (
    <div 
      className={cn(
        "flex items-center justify-between p-3 rounded-lg text-sm",
        isOnline ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700", 
        className
      )}
    >
      <div className="flex items-center">
        {isOnline ? (
          <Wifi className="w-4 h-4 mr-2" /> 
        ) : (
          <WifiOff className="w-4 h-4 mr-2" />
        )}
        <span>
          {isOnline ? 'Connected' : 'No internet connection'}
        </span>
      </div>
      
      <button
        onClick={handleRetry}
        disabled={isRetrying}
        className={cn(
          "px-2 py-1 rounded text-xs flex items-center",
          isOnline ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700",
          "disabled:opacity-50"
        )}
      >
        <RefreshCw className={cn("w-3 h-3 mr-1", isRetrying && "animate-spin")} />
        {isRetrying ? 'Retrying...' : 'Retry'}
      </button>
    </div>
  );
};

export default NetworkStatus;