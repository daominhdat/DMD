
export const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

export const checkCollision = (
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number
) => {
  const dx = x1 - x2;
  const dy = y1 - y2;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < r1 + r2;
};

// Simple point in circle check
export const pointInCircle = (px: number, py: number, cx: number, cy: number, r: number) => {
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
};

// Line Segment intersects Circle check
export const lineIntersectsCircle = (x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, r: number) => {
  // Check if either end is inside
  if (pointInCircle(x1, y1, cx, cy, r) || pointInCircle(x2, y2, cx, cy, r)) return true;

  const lenSq = (x1 - x2) ** 2 + (y1 - y2) ** 2;
  if (lenSq === 0) return false; // Points are same

  // Dot product to find closest point projection
  const dot = ((cx - x1) * (x2 - x1) + (cy - y1) * (y2 - y1)) / lenSq;
  
  // Closest point is outside segment
  if (dot < 0 || dot > 1) return false;

  // Find closest point coordinates
  const closeX = x1 + dot * (x2 - x1);
  const closeY = y1 + dot * (y2 - y1);

  // Check distance from circle center to closest point
  return pointInCircle(closeX, closeY, cx, cy, r);
};

// Audio Synthesis for Sound Effects (Swish & Splat) without external files
let audioCtx: AudioContext | null = null;

export const playSoundEffect = (type: 'swish' | 'splat' | 'bomb') => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    if (type === 'swish') {
        // White noise buffer for swish
        const bufferSize = audioCtx.sampleRate * 0.2; // 0.2s
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, audioCtx.currentTime);
        filter.frequency.linearRampToValueAtTime(3000, audioCtx.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        noise.start();
    } else if (type === 'splat') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'bomb') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.5);

        gainNode.gain.setValueAtTime(0.8, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    }
};
