"use client";

// One aisle (Stories 10.2–10.6, 12.2; FR-42, FR-51): the open aisle's wall with its selection,
// `?loc=` pin, recommendations, Manual move… and moves drawer, and the drag on the wall (Story
// 12.2): the wall is wrapped in the drag slice's provider and only this mode passes `grid.drag`.
// Moved out of locations-page.tsx in Story 12.2 (epic-10 retro item 89).

import { useCallback, useEffect, useRef, useState } from "react";

import { usePanelPlanData, usePartPanel, WithPartPanel } from "@/components/common/part-panel";
import { ManualMoveAction } from "@/components/common/manual-move-dialog";
import { OtherLocationAction } from "@/components/common/other-location";
import { PlanLoadError, PlanOpening, showsLoadError } from "@/components/common/plan-status";
import { SearchField } from "@/components/common/search-field";
import { moveKey, recommendationsAtVersion } from "@/components/common/wall";
import type { useImportLayout } from "@/lib/api/imports";
import { usePlanRecommendations, usePlanWall } from "@/lib/api/plans";
import { usePlanCommands } from "@/lib/commands";
import { EMPTY_LOCATION_REASON, hoverNoteLines } from "@/lib/copy";
import {
  isSelectedWallMove,
  type LocationParams,
  planStepHref,
  recommendationHref,
  wallMoveQuery,
} from "@/lib/view-state/urls";

import { storeAisle } from "./aisle-choice";
import { WallDragProvider } from "./drag/drag-context";
import { LocationsWall } from "./locations-wall";
import { joinedRow, MovesDrawer } from "./moves-drawer";

export type ScopeSwitch = {
  /** Whole warehouse: keeps the stored aisle and, from One aisle, the selected move. */
  toWarehouse: (moveQuery: Pick<LocationParams, "rec" | "move">) => void;
  /** One aisle on `aisle` (a card, or the control on the chosen aisle; none while the layout is not here). */
  toAisle: (aisle?: string) => void;
  /** Set by a switch: the newly mounted control takes focus, then calls `onFocused`. */
  focusControl: boolean;
  onFocused: () => void;
};

export function AisleMode({
  planId,
  params,
  layout,
  aisle,
  switchScope,
}: {
  planId: string;
  params: LocationParams;
  layout: ReturnType<typeof useImportLayout>;
  aisle: string | undefined;
  switchScope: ScopeSwitch;
}) {
  const wall = usePlanWall(planId, aisle ?? "", aisle !== undefined);
  const panel = usePartPanel(planId, "locations");
  const data = usePanelPlanData(planId, wall, panel.part);
  const recommendations = usePlanRecommendations(planId);
  const { disabledReason, sendWithEvents } = usePlanCommands(planId);
  // Which side asked for the last selection, so the other side scrolls to it.
  const [wallScroll, setWallScroll] = useState<{ code: string; seq: number } | undefined>(undefined);
  const [drawerScroll, setDrawerScroll] = useState<{ key: string; seq: number } | undefined>(undefined);

  // `?loc=` pins that location's dialog once per distinct value (a new link pins again).
  const [handledLoc, setHandledLoc] = useState<string | undefined>(undefined);
  if (params.loc === undefined && handledLoc !== undefined) setHandledLoc(undefined);
  const loc = params.loc;
  const onPinHandled = useCallback(() => setHandledLoc(loc), [loc]);
  const pinCode = loc !== undefined && loc !== handledLoc && data?.view.aisle === aisle ? loc : undefined;

  // A part opened from the search field: once its detail is here, the wall shows its aisle.
  const followPart = useRef<string | undefined>(undefined);
  const detail = data?.detail;
  useEffect(() => {
    if (detail === undefined || followPart.current !== detail.part) return;
    followPart.current = undefined;
    const target = detail.current_location?.aisle;
    if (target !== undefined && target !== aisle) {
      window.history.replaceState(null, "", planStepHref(planId, "locations", { aisle: target, part: detail.part }));
    }
  }, [detail, aisle, planId]);

  useEffect(() => {
    if (aisle !== undefined) storeAisle(planId, aisle);
  }, [planId, aisle]);

  function select(next: string) {
    window.history.replaceState(null, "", planStepHref(planId, "locations", { aisle: next, part: panel.part }));
  }

  function openList() {
    // The chosen aisle, not the previous aisle's wall still shown while the next one loads; no `loc`.
    const current = aisle ?? data?.view.aisle;
    window.history.replaceState(
      null,
      "",
      planStepHref(planId, "locations", { aisle: current, mode: "list", part: panel.part }),
    );
  }

  if (!data || aisle === undefined) {
    return (
      <div className="flex flex-col gap-4 px-page-gutter py-5">
        {showsLoadError(layout.error) ? (
          <PlanLoadError message={layout.error.message} />
        ) : showsLoadError(wall.error) ? (
          <PlanLoadError message={wall.error.message} />
        ) : (
          <PlanOpening planId={planId} />
        )}
      </div>
    );
  }
  // The selected part's current location; the recommendations only at the wall's version (AD-12).
  const selectedCode =
    panel.part !== undefined && data.detail?.part === panel.part ? data.detail.current_location?.code : undefined;
  const recRows = recommendationsAtVersion(recommendations.data, data.view.version);
  const view = data.view;
  // `?rec=` / `?move=` select an entry of the open aisle; any other id selects nothing.
  const selectedMove = view.moves.find((move) => isSelectedWallMove(move, params));
  const selectedMoveKey = selectedMove ? moveKey(selectedMove) : undefined;
  const noteLines = selectedMove ? hoverNoteLines(selectedMove, joinedRow(selectedMove, recRows)?.reason) : undefined;

  function selectMove(key: string, from: "wall" | "drawer") {
    const move = view.moves.find((candidate) => moveKey(candidate) === key);
    if (!move) return;
    window.history.replaceState(
      null,
      "",
      planStepHref(planId, "locations", { aisle: view.aisle, part: panel.part, ...wallMoveQuery(move) }),
    );
    if (from === "wall") {
      setDrawerScroll((current) => ({ key, seq: (current?.seq ?? 0) + 1 }));
    } else {
      const code = move.from_location.aisle === view.aisle ? move.from_location.code : move.to_location.code;
      setWallScroll((current) => ({ code, seq: (current?.seq ?? 0) + 1 }));
    }
  }

  return (
    <WithPartPanel
      planId={planId}
      part={panel.part}
      detail={data.detail}
      detailError={data.detailError}
      onClose={panel.close}
    >
      {/* Drag (Story 12.2): One aisle is the only wall that passes `grid.drag`. */}
      <WallDragProvider planId={planId} wall={view}>
        {(drag) => (
          <LocationsWall
            planId={planId}
            view={data.view}
            layout={layout.data}
            selected={aisle}
            onSelect={select}
            onOpenList={openList}
            onScopeChange={(next) => {
              if (next === "warehouse") switchScope.toWarehouse(selectedMove ? wallMoveQuery(selectedMove) : {});
            }}
            focusScope={switchScope.focusControl}
            onScopeFocused={switchScope.onFocused}
            part={panel.part}
            search={
              <SearchField
                planId={planId}
                onOpenPart={(part, opener) => {
                  // The part already open does not move the wall on a later refetch.
                  if (part !== panel.part) followPart.current = part;
                  panel.open(part, opener);
                }}
              />
            }
            drawer={
              <MovesDrawer
                planId={planId}
                aisle={view.aisle}
                round={view.round}
                moves={view.moves}
                selectedKey={selectedMoveKey}
                onSelect={(key) => selectMove(key, "drawer")}
                rows={recRows}
                version={view.version}
                savingReason={disabledReason}
                onSend={sendWithEvents}
                otherLocation={(props) => <OtherLocationAction key={props.row.id} planId={planId} {...props} />}
                scrollTo={drawerScroll}
              />
            }
            grid={{
              selectedMoveKey,
              noteLines,
              onSelectMove: (key) => selectMove(key, "wall"),
              scrollTo: wallScroll,
              selectedCode,
              pinCode,
              onPinHandled,
              recommendations: recRows,
              recommendationHref: (row) => recommendationHref(planId, row),
              onOpenPart: panel.open,
              // One Manual move… per pinned location: its part and reason follow the data, so a move
              // that empties the location closes its dialog normally and focus returns to the cell.
              manualMove: ({ location, returnFocusRef }) => (
                <ManualMoveAction
                  key={location.location.code}
                  planId={planId}
                  part={location.top_part?.part}
                  emptyReason={EMPTY_LOCATION_REASON}
                  savingReason={disabledReason}
                  initialFrom={location.location.code}
                  returnFocusRef={returnFocusRef}
                />
              ),
              drag,
            }}
          />
        )}
      </WallDragProvider>
    </WithPartPanel>
  );
}
