export const MILESTONES = ['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8'] as const;

export type Milestone = (typeof MILESTONES)[number];

export const CURRENT_MILESTONE: Milestone = 'M6';
