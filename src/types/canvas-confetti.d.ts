declare module 'canvas-confetti' {
  interface ConfettiOptions {
    particleCount?: number;
    angle?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    gravity?: number;
    drift?: number;
    ticks?: number;
    origin?: {
      x?: number;
      y?: number;
    };
    colors?: string[];
    shapes?: string[];
    scalar?: number;
    zIndex?: number;
    disableForReducedMotion?: boolean;
  }

  interface ConfettiCannon {
    reset: () => void;
    fire: () => void;
  }

  type ConfettiFunction = (options?: ConfettiOptions) => ConfettiCannon;

  const confetti: ConfettiFunction & {
    create: (canvas: HTMLCanvasElement, options?: { resize?: boolean, useWorker?: boolean }) => ConfettiFunction;
  };

  export default confetti;
}