// Wall primitives (Story 10.2, FR-42): shared by the Locations wall, the front page and, later,
// wall crops (Story 10.5), the whole-warehouse view (Story 10.6) and marking (Story 10.7).

export { BIN_HEIGHT, BIN_WIDTH, Bin, CODE_MIN_WIDTH } from "./bin";
export { CLASS_FILL } from "./class-fill";
export { Key, KeySwatch } from "./key";
export {
  type CellBest,
  framedCounts,
  isFramed,
  MAX_SCALE,
  type WallCellModel,
  wallCells,
  wallNaturalSize,
  wallScale,
} from "./model";
export { Slot, SlotNone } from "./slot";
export { WallPanel } from "./wall-panel";
