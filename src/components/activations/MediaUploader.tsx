import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Image, FileImage, RefreshCw } from 'lucide-react';
import imageCompression from 'browser-image-compression';

interface MediaUploaderProps {
  onUpload: (file: File) => Promise<void>;
  uploading: boolean;
  small?: boolean;
}

const MediaUploader: React.FC<MediaUploaderProps> = ({ onUpload, uploading, small = false }) => {
  const [compressing, setCompressing] = useState(false);
  
  const compressAndUpload = async (file: File) => {
    try {
      // Only compress if it's an image and larger than 1MB
      if (file.type.startsWith('image/') && file.size > 1024 * 1024) {
        setCompressing(true);
        
        // Compression options
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
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
    } finally {
      setCompressing(false);
    }
  };
  
  const onDrop = useCallback((acceptedFiles: File[]) => {
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
  
  if (small) {
    return (
      <div
        {...getRootProps()}
        className={`border-2 border-dashed ${
          isDragActive ? 'border-purple-400 bg-purple-50' : 'border-gray-300 bg-gray-50'
        } rounded-md p-1 cursor-pointer flex items-center justify-center transition`}
      >
        <input {...getInputProps()} />
        {uploading || compressing ? (
          <div className="text-center text-gray-500 text-xs flex items-center px-2 py-1">
            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
            <span>{compressing ? 'Compressing...' : 'Uploading...'}</span>
          </div>
        ) : (
          <div className="text-center text-gray-500 text-xs flex items-center px-2 py-1">
            <FileImage className="w-3 h-3 mr-1" />
            <span>Upload image</span>
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed ${
        isDragActive ? 'border-purple-400 bg-purple-50' : 'border-gray-300 bg-gray-50'
      } rounded-md p-6 cursor-pointer flex flex-col items-center justify-center transition`}
    >
      <input {...getInputProps()} />
      {uploading || compressing ? (
        <div className="text-center text-gray-500">
          <RefreshCw className="w-10 h-10 mx-auto mb-2 animate-spin" />
          <p>{compressing ? 'Compressing image...' : 'Uploading image...'}</p>
        </div>
      ) : (
        <>
          <div className="mb-2 text-gray-400">
            <Image className="w-8 h-8 mx-auto" />
          </div>
          <p className="text-sm text-gray-500 text-center mb-1">
            {isDragActive ? 'Drop image here' : 'Drag & drop an image here'}
          </p>
          <p className="text-xs text-gray-400 text-center">
            or click to select a file
          </p>
          <p className="text-xs text-gray-400 mt-1">
            JPG, PNG, GIF, WEBP up to 10MB
          </p>
        </>
      )}
    </div>
  );
};

export default MediaUploader;