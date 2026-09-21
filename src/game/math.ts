export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v))
}

export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt))
}

export function angDiff(target: number, current: number): number {
  let d = target - current
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  return current + angDiff(target, current) * (1 - Math.exp(-lambda * dt))
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export function formatScore(n: number): string {
  return Math.max(0, Math.floor(n)).toLocaleString('en-US')
}
