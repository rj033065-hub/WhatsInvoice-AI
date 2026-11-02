declare module 'canvas-confetti' {
  export interface Options {
    particleCount?: number;
    angle?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    gravity?: number;
    drift?: number;
    flat?: boolean;
    ticks?: number;
    origin?: { x?: number; y?: number };
    colors?: string[];
    shapes?: Array<'square' | 'circle' | 'star' | string>;
    scalar?: number;
    zIndex?: number;
    disableForReducedMotion?: boolean;
  }

  export interface GlobalOptions {
    resize?: boolean;
    useWorker?: boolean;
    disableForReducedMotion?: boolean;
  }

  export interface CreateTypes {
    (options?: Options): Promise<null> | null;
    reset: () => void;
  }

  const confetti: {
    (options?: Options): Promise<null> | null;
    create: (canvas: HTMLCanvasElement, options?: GlobalOptions) => CreateTypes;
    reset: () => void;
  };

  export default confetti;
}
