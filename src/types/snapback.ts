// types/snapback.ts

export interface SnapbackCheckpoint {
  id: string;
  timestamp: number;
  corePrimitiveHash?: string;
  physicalState: {
    chatSegmentId: string;
    tiptapDelta?: any;
    threeJsCoords?: { x: number; y: number; z: number };
  };
  cognitiveState: {
    monologueTimestamp: number;
    activeEmotionalState: string;
    activeHiddenIntent: string;
  };
}
