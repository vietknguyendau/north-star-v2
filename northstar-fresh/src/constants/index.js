// ── Single source of truth for all app-wide constants

export const TOURNAMENT_ID = "tournament-2024"; // change per season/event

export const SKILL_LEVELS = ["Scratch (0-5)", "Low (6-12)", "Mid (13-20)", "High (21+)"];

export const DEFAULT_PAR   = [4,4,3,4,5,3,4,4,5, 4,3,4,5,4,3,4,4,5];
export const DEFAULT_YARDS = [385,412,178,395,520,162,430,388,510, 402,185,415,535,375,160,420,395,525];

// WHS handicap stroke allocation order (1 = hardest hole)
// Single source of truth — do NOT redefine HCP_S anywhere else
export const HCP_STROKES = [7,1,15,5,9,17,3,13,11, 8,18,4,6,16,14,2,12,10];
