/** Convert the demo's m:ss duration into seconds. */
export function parseDuration(value) {
  if (!/^\d+:[0-5]\d$/.test(value)) throw new RangeError('Expected a duration in m:ss format');
  const [minutes, seconds] = value.split(':').map(Number);
  return minutes * 60 + seconds;
}
/** Shuffle advances by a nonzero offset, so Next never repeats the current track. */
export function nextTrackIndex(current, count, shuffle, random = Math.random) {
  if (count <= 1) return 0;
  const offset = shuffle ? 1 + Math.floor(random() * (count - 1)) : 1;
  return (current + offset) % count;
}
