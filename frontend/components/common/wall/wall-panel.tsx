// WallPanel (DESIGN.md "wall-panel", UX-DR40/41/48): one aisle drawn as a graphite shelf wall.
// A louvre background, an upright at each section start, a beam under each level (a 4px best rail
// on a level in `rail_levels`), a section header row and level labels per run, the two runs, and an
// end cap with the aisle's last Walk Path. Cells come from `wallCells`; this file owns only pixels.
// Without a `label` the picture is `aria-hidden`: the keyboard grid over it (`WallGrid`, Story
// 10.3) carries the names, focus, hover and clicks. The selected part's cell gets the Key's
// Selected frame.

import { useId } from "react";

import type { AisleLayout } from "@/lib/api/imports";
import { BEST_TAG, bestCountTag, endCapLabel, levelLabel } from "@/lib/copy";

import { BIN_HEIGHT, BIN_WIDTH, Bin } from "./bin";
import { Frame, SELECTED_FRAME } from "./key";
import {
  BEAM_HEIGHT,
  BEAM_TOP,
  cellRect,
  columnX,
  framedCounts,
  LABEL_WIDTH,
  PAD,
  PITCH,
  ROW_HEIGHT,
  runTops as runTopsOf,
  runWidth,
  SECTION_GAP,
  SECTION_HEADER,
  UPRIGHT_WIDTH,
  type WallCellModel,
  wallNaturalSize,
} from "./model";
import { Slot, SlotNone, SlotNoneHatch } from "./slot";

const TAG_HEIGHT = 15;

function BestTag({ x, y, text }: { x: number; y: number; text: string }) {
  const width = Math.max(40, text.length * 6.6 + 8);
  return (
    <g data-best-tag={text}>
      <rect x={x} y={y} width={width} height={TAG_HEIGHT} rx={2} fill="var(--color-best)" />
      <text
        x={x + width / 2}
        y={y + 11}
        textAnchor="middle"
        fontSize={11}
        className="font-code font-bold"
        fill="var(--color-ink)"
      >
        {text}
      </text>
    </g>
  );
}

function Cell({
  cell,
  x,
  y,
  scale,
  hatchId,
  selected,
}: {
  cell: WallCellModel;
  x: number;
  y: number;
  scale: number;
  hatchId: string;
  selected: boolean;
}) {
  if (cell.code === null) {
    return (
      <g data-gap="">
        <SlotNone x={x} y={y} hatchId={hatchId} />
      </g>
    );
  }
  const top = cell.parts[0];
  return (
    <g
      data-cell={cell.code}
      data-occupied={cell.occupied ? "true" : "false"}
      data-best={cell.best}
      data-class={top}
      data-parts={cell.parts.length}
      data-selected={selected ? "" : undefined}
    >
      {cell.occupied && top !== undefined ? (
        <Bin parts={cell.parts} x={x} y={y} drawnWidth={BIN_WIDTH * scale} />
      ) : (
        <Slot x={x} y={y} />
      )}
      {cell.best === "frame" && (
        <rect
          x={x - 1}
          y={y - 1}
          width={BIN_WIDTH + 2}
          height={BIN_HEIGHT + 2}
          rx={3}
          fill="none"
          stroke="var(--color-best)"
          strokeWidth={2}
          data-best-frame=""
        />
      )}
      {selected && (
        <g data-selected-frame="">
          <Frame {...SELECTED_FRAME} x={x} y={y} />
        </g>
      )}
    </g>
  );
}

export function WallPanel({
  layout,
  cells,
  railLevels,
  scale = 1,
  label,
  selectedCode,
}: {
  layout: AisleLayout;
  cells: readonly WallCellModel[];
  /** The levels under a best rail (the server's `rail_levels`). */
  railLevels: readonly string[];
  /** The drawn size over the natural size (`wallScale`). */
  scale?: number;
  /** The picture's accessible name; without one the picture is `aria-hidden` (a grid names the cells). */
  label?: string;
  /** The location drawn with the Selected frame (the open part's current location). */
  selectedCode?: string;
}) {
  const id = useId();
  const louvre = `${id}-louvre`;
  const hatch = `${id}-hatch`;
  const size = wallNaturalSize(layout);
  const rails = new Set(railLevels);
  const framed = framedCounts(layout, cells);
  const left = PAD + LABEL_WIDTH;
  const runTops = runTopsOf(layout);
  const endCapY = size.height - PAD - 6;
  return (
    <svg
      width={size.width * scale}
      height={size.height * scale}
      viewBox={`0 0 ${size.width} ${size.height}`}
      {...(label === undefined ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
      focusable="false"
      data-wall-panel={layout.aisle}
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <pattern id={louvre} width={14} height={10} patternUnits="userSpaceOnUse">
          <rect width={14} height={10} fill="var(--color-wall)" />
          <rect x={2} y={3.5} width={9} height={2.6} rx={1.3} fill="var(--color-wall-slat)" />
        </pattern>
        <SlotNoneHatch id={hatch} />
      </defs>
      <rect
        x={0.5}
        y={0.5}
        width={size.width - 1}
        height={size.height - 1}
        rx={8}
        fill={`url(#${louvre})`}
        stroke="var(--color-wall-edge)"
        strokeWidth={1}
      />
      {layout.runs.map((run, runIndex) => {
        const runTop = runTops[runIndex];
        const rowsTop = runTop + SECTION_HEADER;
        const width = runWidth(run);
        const uprights = [
          ...(run.sections.length > 0 ? run.sections.map((span) => columnX(run, span.first_column)) : [SECTION_GAP]),
          width,
        ];
        return (
          <g key={runIndex} data-run={runIndex}>
            {run.sections.map((span) => {
              const start = columnX(run, span.first_column);
              return (
                <text
                  key={span.section}
                  x={left + start + (span.columns * PITCH) / 2}
                  y={runTop + 13}
                  textAnchor="middle"
                  className="type-wall-section"
                  fill="var(--color-on-dark-secondary)"
                  data-section={span.section}
                >
                  {span.section}
                </text>
              );
            })}
            {uprights.map((x) => (
              <rect
                key={x}
                x={left + x - SECTION_GAP + 1}
                y={rowsTop}
                width={UPRIGHT_WIDTH}
                height={run.levels.length * ROW_HEIGHT}
                fill="var(--color-upright)"
              />
            ))}
            {run.levels.map((level, row) => {
              const rowTop = rowsTop + row * ROW_HEIGHT;
              const railed = rails.has(level);
              const count = framed[runIndex]?.[row] ?? 0;
              const tag = railed ? BEST_TAG : count > 0 ? bestCountTag(count) : null;
              return (
                <g key={level} data-level={level}>
                  <text x={PAD + 4} y={rowTop + 15} className="type-wall-label" fill="var(--color-on-dark)">
                    {levelLabel(level)}
                  </text>
                  {tag !== null && <BestTag x={PAD + 2} y={rowTop + 19} text={tag} />}
                  <rect
                    x={left}
                    y={rowTop + BEAM_TOP}
                    width={width}
                    height={BEAM_HEIGHT}
                    fill={railed ? "var(--color-best)" : "var(--color-beam)"}
                    data-rail={railed ? level : undefined}
                  />
                </g>
              );
            })}
          </g>
        );
      })}
      {cells.map((cell) => {
        const rect = cellRect(layout, runTops, cell);
        if (rect === null) return null;
        return (
          <Cell
            key={`${cell.run}:${cell.row}:${cell.column}`}
            cell={cell}
            x={rect.x}
            y={rect.y}
            scale={scale}
            hatchId={hatch}
            selected={cell.code !== null && cell.code === selectedCode}
          />
        );
      })}
      <text
        x={size.width - PAD - 4}
        y={endCapY}
        textAnchor="end"
        className="type-wall-section"
        fill="var(--color-on-dark-secondary)"
        data-end-cap=""
      >
        {endCapLabel(layout.aisle, layout.walk_path_last)}
      </text>
    </svg>
  );
}
