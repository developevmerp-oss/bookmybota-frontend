import { StadiumBlockDefV2, StadiumElementDefV2, StadiumGroundConfigV2, BackgroundPlanDef } from "./types";

export interface StudioSnapshot {
  blocks: StadiumBlockDefV2[];
  elements: StadiumElementDefV2[];
  groundConfig: StadiumGroundConfigV2;
  backgroundPlan?: BackgroundPlanDef;
}

export class HistoryManager {
  private undoStack: StudioSnapshot[] = [];
  private redoStack: StudioSnapshot[] = [];
  private maxHistory: number;

  constructor(maxHistory = 30) {
    this.maxHistory = maxHistory;
  }

  public push(snapshot: StudioSnapshot) {
    this.undoStack.push(JSON.parse(JSON.stringify(snapshot)));
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    // Clear redo on new action
    this.redoStack = [];
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public undo(currentSnapshot: StudioSnapshot): StudioSnapshot | null {
    if (!this.canUndo()) return null;
    const previous = this.undoStack.pop()!;
    this.redoStack.push(JSON.parse(JSON.stringify(currentSnapshot)));
    return previous;
  }

  public redo(currentSnapshot: StudioSnapshot): StudioSnapshot | null {
    if (!this.canRedo()) return null;
    const next = this.redoStack.pop()!;
    this.undoStack.push(JSON.parse(JSON.stringify(currentSnapshot)));
    return next;
  }

  public clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}
