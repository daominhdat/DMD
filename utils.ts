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