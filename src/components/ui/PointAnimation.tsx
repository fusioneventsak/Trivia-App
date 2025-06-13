import React, { useState, useEffect } from 'react';
import { formatPoints } from '../../lib/point-calculator';

interface PointAnimationProps {
  points: number;
  className?: string;
}

const PointAnimation: React.FC<PointAnimationProps> = ({ points, className = '' }) => {
  const [visible, setVisible] = useState(true);
  const [animationClass, setAnimationClass] = useState('animate-fadeIn');
  
  useEffect(() => {
    // Reset animation when points change
    setVisible(true);
    setAnimationClass('animate-fadeIn');
    
    // Start fade out after 2.5 seconds
    const timer = setTimeout(() => {
      setAnimationClass('animate-fadeOut');
      
      // Hide completely after fade out
      setTimeout(() => {
        setVisible(false);
      }, 500);
    }, 2500);
    
    return () => clearTimeout(timer);
  }, [points]);
  
  if (!visible || points === 0) return null;
  
  const isPositive = points > 0;
  
  return (
    <div className={`${animationClass} ${className} font-bold text-2xl animate-point-pulse`}>
      <span className={isPositive ? 'text-green-400' : 'text-red-400'}>
        {isPositive ? '+' : ''}{formatPoints(points)}
      </span>
    </div>
  );
};

export default PointAnimation;