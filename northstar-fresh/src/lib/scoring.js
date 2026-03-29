// ── Pure scoring utility functions
// No React imports — safe to use from React Native or tests

import { HCP_STROKES } from '../constants';

// ── PIN hashing via Web Crypto API (async)
export const hashPin = async (pin) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
};

// ── Format value as plus/minus par string
export const toPM = v =>
  v === null || v === undefined || isNaN(v) ? "—"
  : v === 0 ? "E" : v > 0 ? `+${v}` : `${v}`;

// ── Find index of last non-null score
export const lastFilledIdx = scores => {
  let last = -1;
  scores.forEach((s, i) => { if (s !== null) last = i; });
  return last;
};

// ── Count holes played (1-based)
export const holesPlayed = p => lastFilledIdx(p.scores) + 1;

// ── Gross score relative to par (for holes played so far)
export const calcGrossToPar = (player, pars) => {
  const last = lastFilledIdx(player.scores);
  if (last < 0) return null;
  const gross  = player.scores.slice(0, last + 1).filter(s => s !== null).reduce((a, b) => a + b, 0);
  const parSum = pars.slice(0, last + 1).reduce((a, b) => a + b, 0);
  return gross - parSum;
};

// ── WHS Course Handicap = Index × (Slope / 113) + (Rating − Par)
export const calcCourseHandicap = (handicapIndex, slope, rating, par) => {
  const s = parseFloat(slope) || 113;
  const r = parseFloat(rating) || par;
  const p = parseInt(par) || 72;
  return Math.round(handicapIndex * (s / 113) + (r - p));
};

// ── Net score relative to par for all holes played
export const calcNet = (player, pars, course) => {
  const last = lastFilledIdx(player.scores);
  if (last < 0) return null;
  const totalPar = pars.reduce((a, b) => a + b, 0);
  const courseHcp = (course?.slope && course?.rating)
    ? calcCourseHandicap(player.handicap, course.slope, course.rating, totalPar)
    : player.handicap;
  let hcpStrokes = 0;
  player.scores.forEach((s, i) => {
    if (s === null) return;
    if (HCP_STROKES[i] <= courseHcp) hcpStrokes++;
    if (courseHcp > 18 && HCP_STROKES[i] <= courseHcp - 18) hcpStrokes++;
    if (courseHcp > 36 && HCP_STROKES[i] <= courseHcp - 36) hcpStrokes++;
  });
  const gross  = player.scores.slice(0, last + 1).filter(s => s !== null).reduce((a, b) => a + b, 0);
  const parSum = pars.slice(0, last + 1).reduce((a, b) => a + b, 0);
  return gross - hcpStrokes - parSum;
};

// ── Score label for a hole
export const scoreLabel = (score, par) => {
  if (score === null) return "";
  const d = score - par;
  if (d <= -3) return "ALBATROSS";
  if (d === -2) return "EAGLE";
  if (d === -1) return "BIRDIE";
  if (d === 0)  return "PAR";
  if (d === 1)  return "BOGEY";
  if (d === 2)  return "DOUBLE BOGEY";
  return "TRIPLE+";
};

// ── CSS class name for a hole score
export const scoreClass = (score, par) => {
  if (score === null) return "";
  const d = score - par;
  if (d <= -2) return "s-eagle";
  if (d === -1) return "s-birdie";
  if (d === 0)  return "s-par";
  if (d === 1)  return "s-bogey";
  return "s-double";
};
