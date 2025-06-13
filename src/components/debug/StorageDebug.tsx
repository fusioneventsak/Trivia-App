import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getStorageUrl } from '../../lib/utils';

interface StorageDebugProps {
  mediaUrl?: string;
  bucketName?: string;
}

const StorageDebug: React.FC<StorageDebugProps> = ({ 
  mediaUrl, 
  bucketName = 'public' 
}) => {
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    const debugStorage = async () => {
      if (!mediaUrl) return;

      const info: any = {
        originalUrl: mediaUrl,
        processedUrl: getStorageUrl(mediaUrl),
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL
      };

      // Check if URL is accessible
      try {
        const response = await fetch(getStorageUrl(mediaUrl), { method: 'HEAD' });
        info.accessible = response.ok;
        info.status = response.status;
        info.contentType = response.headers.get('content-type');
      } catch (error) {
        info.accessible = false;
        info.error = error;
      }

      // Check bucket permissions
      try {
        const { data, error } = await supabase.storage
          .from(bucketName)
          .list('', { limit: 1 });
        
        info.bucketAccessible = !error;
        info.bucketError = error;
      } catch (error) {
        info.bucketAccessible = false;
        info.bucketError = error;
      }

      setDebugInfo(info);
    };

    debugStorage();
  }, [mediaUrl, bucketName]);

  if (!mediaUrl) return null;

  return (
    <div className="p-4 bg-gray-100 rounded text-xs font-mono">
      <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
    </div>
  );
};

export default StorageDebug;