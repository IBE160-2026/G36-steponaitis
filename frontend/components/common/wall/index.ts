// Wall primitives (Story 10.2, FR-42): shared by the Locations wall, the front page and, later,
// wall crops (Story 10.5), the whole-warehouse view (Story 10.6, its mini-walls and route) and
// marking (Story 10.7). The keyboard grid, its navigation and the tooltip are Story 10.3's; the
// moves layer is Story 10.4's (Story 10.5 reuses it for the wall crops). The aisle tabs and the
// open aisle's wall moved here from the Locations module in Story 10.7, whose Best locations
// marking wall reuses them.

export { aisleTabId, AisleTabs } from "./aisle-tabs";
export { AisleWall, type AisleWallProps } from "./aisle-wall";
export { BIN_HEIGHT, BIN_WIDTH, Bin, CODE_MIN_WIDTH } from "./bin";
export { CLASS_FILL } from "./class-fill";
export { cropLayout } from "./crop";
export { ColourPopoverBody, type ColourPopoverBodyProps, KeyColourAnnouncer, KeyColourButton } from "./colour-popover";
export { Frame, Key, KEY_COLOUR_OF, KeySwatch, SELECTED_FRAME } from "./key";
export {
  type CellBest,
  cellRect,
  framedCounts,
  isFramed,
  LABEL_WIDTH,
  MAX_SCALE,
  PAD,
  ROW_HEIGHT,
  runHeight,
  runTops,
  runWidth,
  SECTION_HEADER,
  type WallCellModel,
  wallCells,
  wallNaturalSize,
  wallScale,
} from "./model";
export {
  arrowPath,
  cellMoveSelection,
  liftedRect,
  marksByCode,
  moveKey,
  type MoveMark,
  moveMarks,
  type NotePlacement,
  placeNote,
  type Rect,
  rectsOverlap,
  scrollBehavior,
} from "./moves";
export {
  cellGeometry,
  type CellGeometry,
  MOVE_ARROW,
  NOTE_HEIGHT,
  NOTE_WIDTH,
  WallHoverNote,
  WallMoveMarkers,
  WallMovesLayer,
} from "./moves-layer";
export { firstCell, nextCell, WALL_KEYS, type WallKeyEvent } from "./navigation";
export {
  gridCounts,
  HOVER_DELAY_MS,
  HOVER_GRACE_MS,
  NO_TIP,
  type TipEvent,
  type TipState,
  crossAisleLines,
  tipReducer,
  WallGrid,
  type WallGridProps,
  type WallManualMoveProps,
  type WallMarking,
} from "./wall-grid";
export {
  cellRecommendations,
  partnerStrips,
  recommendationLinks,
  recommendationsAtVersion,
  type WallPartner,
  type WallRecommendationLink,
  WallTooltip,
} from "./wall-tooltip";
export { Slot, SlotNone } from "./slot";
export { WallPanel } from "./wall-panel";
