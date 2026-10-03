import type { TFunction } from "i18next";
import { SERIES_COLORS } from "@/components/atoms/radarChart";
import type { RadarSeries } from "@/components/atoms/radarChart";
import type { Evaluation, LevelMap } from "@/types";
import { versionLabel } from "./evaluations";
import type { LadderTemplate } from "./ladderTemplates";

const PEER_PALETTE = ["#6366f1", "#0ea5e9", "#ec4899", "#f97316", "#14b8a6", "#ef4444"];

const MANAGER_COMPARE_PALETTE = ["#2563eb", "#0891b2", "#db2777", "#ea580c"];

type Translator = TFunction<"translation">;

function stablePaletteColor(identity: string, palette: string[]): string {
  let hash = 0;
  for (const character of identity.toLocaleLowerCase()) {
    hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  }
  return palette[hash % palette.length]!;
}

export function comparisonColor(evaluation: Evaluation): string {
  if (evaluation.kind === "self") return SERIES_COLORS.self;
  if (evaluation.kind === "peer") {
    return stablePaletteColor(evaluation.authorName?.trim() || evaluation.id, PEER_PALETTE);
  }
  return stablePaletteColor(evaluation.id, MANAGER_COMPARE_PALETTE);
}

export function evaluationAuthor(evaluation: Evaluation, t: Translator): string {
  const kind = t(`versions.kind.${evaluation.kind}`);
  return evaluation.kind === "peer" && evaluation.authorName
    ? `${kind} · ${evaluation.authorName}`
    : kind;
}

type BuildSeriesArgs = {
  primary?: { currentLevels: LevelMap; goalLevels: LevelMap; hideGoal?: boolean } | undefined;
  compare: Evaluation[];
  all: Evaluation[];
  template?: LadderTemplate | undefined;
  t: Translator;
  locale: string;
};

export function buildRadarSeries({
  primary,
  compare,
  all,
  template,
  t,
  locale,
}: BuildSeriesArgs): RadarSeries[] {
  const series: RadarSeries[] = [];
  if (template) {
    series.push({
      id: `template-${template.id}`,
      label: t("templates.seriesLabel", { id: template.id }),
      levels: template.levels,
      color: SERIES_COLORS.template,
      dashed: true,
    });
  }
  compare.forEach((evaluation) => {
    series.push({
      id: `compare-${evaluation.id}`,
      label: `${evaluationAuthor(evaluation, t)} · ${versionLabel(evaluation, all, locale)}`,
      levels: evaluation.currentLevels,
      color: comparisonColor(evaluation),
      dashed: true,
      fill: 0.06,
    });
  });
  if (primary) {
    if (!primary.hideGoal) {
      series.push({
        id: "goal",
        label: t("series.goal"),
        levels: primary.goalLevels,
        color: SERIES_COLORS.goal,
        dashed: true,
        fill: 0.12,
      });
    }
    series.push({
      id: "current",
      label: t("series.current"),
      levels: primary.currentLevels,
      color: SERIES_COLORS.current,
      fill: 0.18,
      primary: true,
    });
  }
  return series;
}
