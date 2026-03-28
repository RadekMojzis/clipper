// src/models/clipFile.js
export function makeClipFile(dropped) {
  return {
    id: crypto.randomUUID(),
    path: dropped.path,
    name: dropped.name,
    size: dropped.size,

    // encoding progress
    pass: 1,

    // per-file settings
    codec: "av1",
    targetMb: 50,
    crf: 30,
    fpsCap: 0,
    scale: 1.0,

    // audio settings
    audioMode: "all", // all | custom | none
    audioKbps: 160,
    audioSelected: [],
    audioTracksInfo: [],

    // probe
    inWidth: null,
    inHeight: null,
    inFps: null,

    // runtime
    status: "idle", // idle | queued | encoding | done | error | cancelled
    pct: 0,
    estimateMb: null,
    estimateRisk: null,
    estimateRatio: null,

    warning: null, // kept for compatibility
    jobId: null,
    outputPath: null,
    error: "",
  };
}

export function buildEncodePayload(file) {
  // IMPORTANT: plain object only
  return {
    path: file.path,
    name: file.name,
    size: file.size,
    targetMb: Number(file.targetMb),
    fpsCap: Number(file.fpsCap),
    scale: Number(file.scale),
    audioMode: String(file.audioMode),
    audioSelected: Array.from(file.audioSelected || []).map((x) => Number(x)),
    audioKbps: Number(file.audioKbps),
    codec: String(file.codec),
    crf: Number(file.crf ?? 0),
  };
}
