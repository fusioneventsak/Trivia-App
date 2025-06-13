// Easing function for smooth animations
export const easeOutQuart = (t: number): number => 1 - Math.pow(1 - t, 4);

// Animate number changes
export const animateValue = (
  start: number,
  end: number,
  duration: number,
  onUpdate: (value: number) => void
): void => {
  const startTime = performance.now();
  
  const updateAnimation = (currentTime: number) => {
    const elapsedTime = currentTime - startTime;
    const progress = Math.min(elapsedTime / duration, 1);
    const easedProgress = easeOutQuart(progress);
    const currentValue = start + (end - start) * easedProgress;
    
    onUpdate(currentValue);
    
    if (progress < 1) {
      requestAnimationFrame(updateAnimation);
    } else {
      // Ensure we end exactly at the target value
      onUpdate(end);
    }
  };
  
  requestAnimationFrame(updateAnimation);
};

// Stagger animations by delay
export const stagger = (
  items: any[],
  callback: (item: any, index: number) => void,
  delay: number = 100
): void => {
  items.forEach((item, index) => {
    setTimeout(() => {
      callback(item, index);
    }, index * delay);
  });
};

// Format time since last update
export const formatTimeSince = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  
  return `${Math.floor(seconds / 3600)}h ago`;
};

// Debounce function to limit function calls
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>): void => {
    if (timeout) clearTimeout(timeout);
    
    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
};