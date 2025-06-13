import React from 'react';
import { useDropzone } from 'react-dropzone';
import { Image, RefreshCw } from 'lucide-react';
import imageCompression from 'browser-image-compression';

interface OptionMediaUploaderProps {
  onUpload: (file: File) => Promise<void>;
  uploading: boolean;
  mediaUrl?: string;
  className?: string;
}

const OptionMediaUploader: React.FC<OptionMediaUploaderProps> = ({
  onUpload,
  uploading,
  mediaUrl,
  className = ''
}) => {
  const compressAndUpload = async (file: File) => {
    try {
      // Only compress if it's an image and larger than 500KB
      if (file.type.startsWith('image/') && file.size > 500 * 1024) {
        // Compression options
        const options = {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 800,
          useWebWorker: true
        };
        
        // Compress the image
        const compressedFile = await imageCompression(file, options);
        
        // Upload the compressed file
        await onUpload(compressedFile);
      } else {
        // Upload original file if not an image or small enough
        await onUpload(file);
      }
    } catch (error) {
      console.error('Error compressing image:', error);
      // Fall back to the original file on compression error
      await onUpload(file);
    }
  };
  
  const onDrop = React.useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      compressAndUpload(file);
    }
  }, [onUpload]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp']
    },
    maxFiles: 1,
    multiple: false
  });
  
  return (
    <div className={className}>
      {mediaUrl ? (
        <div className="relative group">
          <img 
            src={mediaUrl}
            alt="Option media"
            className="w-full h-16 object-cover rounded-md"
          />
          <div 
            {...getRootProps()}
            className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100 rounded-md"
          >
            <input {...getInputProps()} />
            {uploading ? (
              <RefreshCw className="w-6 h-6 text-white animate-spin" />
            ) : (
              <div className="text-white text-sm">
                Click to replace
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed ${
            isDragActive ? 'border-purple-400 bg-purple-50' : 'border-gray-300 bg-gray-50'
          } rounded-md p-2 cursor-pointer flex items-center justify-center transition h-16`}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <div className="text-center text-gray-500 text-sm flex items-center">
              <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
              <span>Uploading...</span>
            </div>
          ) : (
            <div className="text-center text-gray-500 text-sm flex flex-col items-center">
              <Image className="w-5 h-5 mb-1" />
              <span>{isDragActive ? 'Drop image here' : 'Add image'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OptionMediaUploader;