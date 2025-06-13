import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Link, QrCode, ExternalLink } from 'lucide-react';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  title?: string;
  subtitle?: string;
  className?: string;
  logoUrl?: string;
  theme?: {
    primary_color?: string;
    secondary_color?: string;
  };
}

const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  value,
  size = 200,
  title = "Join the Experience",
  subtitle = "Scan the QR code to join",
  className = "",
  logoUrl,
  theme,
}) => {
  const [copied, setCopied] = useState(false);
  const [qrError, setQrError] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Extract primary color from theme or use default
  const primaryColor = theme?.primary_color || "#6366F1";

  // Track component mounting for client-side rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Extract room code from URL if available
  const getRoomCode = () => {
    try {
      const url = new URL(value);
      return url.searchParams.get('code') || 'CODE';
    } catch {
      const parts = value.split('code=');
      return parts.length > 1 ? parts[1] : 'CODE';
    }
  };

  // Don't render QR code during SSR or before mounting
  if (!mounted) {
    return (
      <div className={`bg-white/20 backdrop-blur-sm rounded-xl p-6 text-center ${className}`}>
        <h2 className="text-2xl font-bold text-white mb-1">{title}</h2>
        <p className="text-white/70 mb-5">{subtitle}</p>
        <div className="w-[200px] h-[200px] bg-white p-3 rounded-lg inline-block shadow-lg mb-5">
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-gray-300 border-t-purple-600 rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white/20 backdrop-blur-sm rounded-xl p-6 text-center ${className}`}>
      <h2 className="text-2xl font-bold text-white mb-1">{title}</h2>
      <p className="text-white/70 mb-5">{subtitle}</p>
      
      <div className="relative flex justify-center mb-5">
        {!qrError ? (
          <div className="relative bg-white p-3 rounded-lg inline-block shadow-lg">
            <div className="qrcode-container\" data-testid="qrcode">
              {/* Wrap the QRCodeSVG in a try/catch to prevent rendering errors */}
              <QRCodeSVG
                value={value}
                size={size}
                fgColor="#000000"
                bgColor="#FFFFFF"
                level="M"
                includeMargin={false}
                onError={(err) => {
                  console.error('QR Code rendering failed', err);
                  setQrError(true);
                }}
              />
            </div>
            
            {logoUrl && (
              <div 
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-1 rounded-md shadow-md"
                style={{ width: size * 0.24, height: size * 0.24 }}
              >
                <img 
                  src={logoUrl} 
                  alt="Logo" 
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
        ) : (
          // Fallback if QR code fails to render
          <div className="bg-white p-4 rounded-lg inline-block shadow-lg">
            <div className="w-[170px] h-[170px] flex flex-col items-center justify-center">
              <div className="text-gray-800 font-medium mb-2">Join with code:</div>
              <div className="text-3xl font-bold text-gray-900 mb-3">
                {getRoomCode()}
              </div>
              <div className="px-4 py-2 bg-purple-100 text-purple-800 rounded-lg">
                {window.location.origin}/join
              </div>
            </div>
          </div>
        )}

        {/* Small decorative elements */}
        <div className="absolute top-0 right-0 -translate-x-4 -translate-y-4 w-12 h-12 rounded-full opacity-20"
             style={{ backgroundColor: primaryColor }}></div>
        <div className="absolute bottom-0 left-0 translate-x-4 translate-y-4 w-8 h-8 rounded-full opacity-30"
             style={{ backgroundColor: primaryColor }}></div>
      </div>
      
      <div className="flex flex-col items-center gap-3">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 rounded-full text-white">
          <QrCode className="w-4 h-4" />
          <span className="text-sm truncate max-w-[180px]">{value.replace(/^https?:\/\//, '')}</span>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md transition"
          >
            <Link className="w-4 h-4" />
            <span className="text-sm">{copied ? "Copied!" : "Copy Link"}</span>
          </button>
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md transition"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="text-sm">Open</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default QRCodeDisplay;