import type { LevelMap } from "@/types";

export type LadderTrack = "developer" | "techLead" | "engineeringManager";

export type LadderTemplate = {
  id: string;
  track: LadderTrack;
  levels: LevelMap;
};

// Source: https://www.engineeringladders.com (mapped onto this app's 1-5 scale per vertical)
const level = (
  Technology: number,
  System: number,
  People: number,
  Process: number,
  Influence: number
): LevelMap => ({ Technology, System, People, Process, Influence });

export const LADDER_TEMPLATES: LadderTemplate[] = [
  { id: "D1", track: "developer", levels: level(1, 1, 1, 1, 1) },
  { id: "D2", track: "developer", levels: level(1, 2, 2, 2, 1) },
  { id: "D3", track: "developer", levels: level(2, 2, 2, 3, 2) },
  { id: "D4", track: "developer", levels: level(3, 3, 3, 3, 2) },
  { id: "D5", track: "developer", levels: level(4, 4, 3, 4, 3) },
  { id: "D6", track: "developer", levels: level(5, 5, 3, 4, 4) },
  { id: "D7", track: "developer", levels: level(5, 5, 3, 4, 5) },
  { id: "TL4", track: "techLead", levels: level(2, 3, 4, 4, 1) },
  { id: "TL5", track: "techLead", levels: level(3, 4, 4, 5, 2) },
  { id: "TL6", track: "techLead", levels: level(4, 5, 4, 5, 3) },
  { id: "TL7", track: "techLead", levels: level(4, 5, 4, 5, 4) },
  { id: "EM5", track: "engineeringManager", levels: level(3, 3, 5, 4, 2) },
  { id: "EM6", track: "engineeringManager", levels: level(3, 4, 5, 5, 2) },
  { id: "EM7", track: "engineeringManager", levels: level(3, 4, 5, 5, 3) },
];

export const LADDER_TRACKS: LadderTrack[] = ["developer", "techLead", "engineeringManager"];

export function findTemplate(id: string | null | undefined): LadderTemplate | undefined {
  if (!id) return undefined;
  return LADDER_TEMPLATES.find((template) => template.id === id);
}
