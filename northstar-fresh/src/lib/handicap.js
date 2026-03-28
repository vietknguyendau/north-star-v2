// ── Handicap stroke allocation — single source of truth
// All net score calculations go through calcHoleRange.

import { HCP_STROKES } from '../constants';
import { calcCourseHandicap } from './scoring';

/**
 * Calculate gross, net, strokes, and holes-through for a hole range.
 *
 * @param {(number|null)[]} scores      - 18-element scores array (nulls for unplayed)
 * @param {number}          handicapIndex - Player's WHS handicap index
 * @param {object|null}     course      - { slope, rating } or null
 * @param {number[]}        pars        - 18-element par array
 * @param {number[]}        holeRange   - [startInclusive, endExclusive], e.g. [0,18], [0,9], [9,18]
 * @returns {{ gross: number, net: number, strokes: number, thru: number } | null}
 */
export function calcHoleRange(scores, handicapIndex, course, pars, holeRange = [0, 18]) {
  const [start, end] = holeRange;
  const rangeScores = scores.slice(start, end);
  const played = rangeScores.filter(Boolean);
  if (played.length === 0) return null;

  const totalPar = pars.reduce((a, b) => a + b, 0);
  const courseHcp = (course?.slope && course?.rating)
    ? calcCourseHandicap(handicapIndex, course.slope, course.rating, totalPar)
    : handicapIndex;

  const gross = played.reduce((a, b) => a + b, 0);

  let strokes = 0;
  rangeScores.forEach((s, i) => {
    if (!s) return;
    const holeIdx = start + i;
    if (HCP_STROKES[holeIdx] <= courseHcp) strokes++;
    if (courseHcp > 18 && HCP_STROKES[holeIdx] <= courseHcp - 18) strokes++;
    if (courseHcp > 36 && HCP_STROKES[holeIdx] <= courseHcp - 36) strokes++;
  });

  // Par sum only for holes that have scores
  const parSum = pars
    .slice(start, end)
    .reduce((acc, par, i) => acc + (rangeScores[i] ? par : 0), 0);

  return {
    gross,
    net: gross - strokes - parSum,
    strokes,
    thru: played.length,
  };
}
