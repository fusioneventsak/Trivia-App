import React, { useState, useEffect } from 'react';
import { Trophy } from 'lucide-react';
import { formatPoints } from '../../lib/point-calculator';

interface PointsDisplayProps {
  points: number;
  className?: string;
  showIcon?: boolean;
  animate?: boolean;
}

const PointsDisplay: React.FC<PointsDisplayProps> = ({ 
  points, 
  className = '', 
  showIcon = true,
  animate = true
}) => {
  const [displayPoints, setDisplayPoints] = useState(points);
  const [isAnimating, setIsAnimating] = useState(false);
  
  useEffect(() => {
    // When points change, animate to the new value
    if (points !== displayPoints) {
      if (animate) {
        setIsAnimating(true);
        
        // Animate to new value
        setTimeout(() => {
          setDisplayPoints(points);
          
          // Remove animation class after animation completes
          setTimeout(() => {
            setIsAnimating(false);
          }, 1000);
        }, 100);
      } else {
        // Update immediately without animation
        setDisplayPoints(points);
      }
    }
  }, [points, displayPoints, animate]);
  
  return (
    <div className={`flex items-center ${className} ${isAnimating ? 'animate-score-change' : ''}`}>
      {showIcon && <Trophy className="w-4 h-4 mr-1 text-yellow-300" />}
      <span className="font-bold">{formatPoints(displayPoints)}</span>
    </div>
  );
};

export default PointsDisplay;