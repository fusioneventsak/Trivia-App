import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

interface ConnectionStatusProps {
  isConnected: boolean;
  message: string | null;
  onRetry: () => void;
  retrying?: boolean;
}

/**
 * A reusable component that displays connection status and retry options
 */
const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ 
  isConnected, 
  message, 
  onRetry, 
  retrying = false 
}) => {
  if (isConnected) return null;
  
  return (
    <div className="p-6 mb-6 bg-red-50 rounded-lg shadow-sm text-center">
      <div className="flex justify-center mb-4">
        <div className="p-3 bg-red-100 rounded-full">
          <WifiOff className="w-10 h-10 text-red-600" />
        </div>
      </div>
      <h2 className="text-xl font-semibold text-red-700 mb-2">Connection Error</h2>
      <p className="text-gray-700 mb-6">{message || 'Unable to connect to the server.'}</p>
      <p className="text-gray-600 mb-6">
        This might be due to network issues or the database being unavailable.
        Please check your internet connection and try again.
      </p>
      <button 
        onClick={onRetry}
        disabled={retrying}
        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center justify-center mx-auto disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 mr-2 ${retrying ? 'animate-spin' : ''}`} />
        {retrying ? 'Retrying...' : 'Retry Connection'}
      </button>
    </div>
  );
};

export default ConnectionStatus;