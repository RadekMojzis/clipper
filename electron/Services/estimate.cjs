// electron/services/estimate.cjs
const { runFfprobeDurationSeconds, runFfprobeVideoInfo, runFfprobeAudioTracks } = require("./ffprobe.cjs");
const { computeVideoBitrateKbps } = require("./encode.cjs");

function normalizeClipWindow(durationSec, start, end) {
  const parsedStart = start == null ? null : Number(start);
  const parsedEnd = end == null ? null : Number(end);

  const clipStart = Number.isFinite(parsedStart) ? Math.max(0, parsedStart) : 0;
  const clipEndRaw = Number.isFinite(parsedEnd) ? Math.min(durationSec, parsedEnd) : durationSec;

  if (!Number.isFinite(clipEndRaw) || clipEndRaw <= clipStart) {
    throw new Error("End time must be greater than start time");
  }

  return {
    clipStart,
    clipEnd: clipEndRaw,
    clipDurationSec: clipEndRaw - clipStart,
  };
}

async function estimateSizeFirst(cfg) {
  const inputPath = cfg?.path;
  if (!inputPath) return { ok: false, error: "Missing path" };

  const targetMb = Number(cfg?.targetMb ?? 50);
  const fpsCap = Number(cfg?.fpsCap ?? 0);
  const scale = Number(cfg?.scale ?? 1);
  const codec = cfg?.codec ?? "av1";

  const audioMode = cfg?.audioMode ?? "all"; // "all" | "custom" | "none"
  const audioKbpsPerTrack = Number(cfg?.audioKbps ?? 160);
  const wanted = Array.isArray(cfg?.audioSelected) ? cfg.audioSelected.map(Number) : [];

  const durationSec = await runFfprobeDurationSeconds(inputPath);
  const { clipStart, clipEnd, clipDurationSec } = normalizeClipWindow(durationSec, cfg?.start, cfg?.end);
  const vinfo = await runFfprobeVideoInfo(inputPath);

  const inWidth = vinfo.width;
  const inHeight = vinfo.height;
  const inFps = vinfo.fps || null;

  const outWidth = Math.max(2, Math.round(inWidth * scale));
  const outHeight = Math.max(2, Math.round(inHeight * scale));
  const outFps = fpsCap > 0 ? fpsCap : inFps || null;

  const audioTracksInfo = await runFfprobeAudioTracks(inputPath);
  const validSet = new Set(audioTracksInfo.map((t) => Number(t.streamIndex)));

  let selectedStreamIndexes = [];
  if (audioMode === "all") {
    selectedStreamIndexes = audioTracksInfo.map((t) => Number(t.streamIndex));
  } else if (audioMode === "custom") {
    const wantedValid = wanted.filter((x) => validSet.has(x));
    const wantedSet = new Set(wantedValid);
    selectedStreamIndexes = audioTracksInfo
      .map((t) => Number(t.streamIndex)) // source order
      .filter((si) => wantedSet.has(si));
  } else {
    selectedStreamIndexes = [];
  }

  const audioKbpsTotal = selectedStreamIndexes.length * audioKbpsPerTrack;

  const overheadRatio = codec === "h264" ? 0.08 : 0.12;
  const overheadMb = 1.0;

  const videoKbps = computeVideoBitrateKbps({
    durationSec: clipDurationSec,
    targetSizeMb: targetMb,
    audioKbps: audioKbpsTotal,
    overheadRatio,
  });

  const totalKbps = videoKbps + audioKbpsTotal;
  const estBits = totalKbps * 1000 * clipDurationSec;
  const estMb = estBits / 8 / 1024 / 1024 + overheadMb;

  const ratio = estMb / targetMb;

  let estimateRisk = "low";
  if (ratio <= 0.95) estimateRisk = "low";
  else if (ratio <= 1.0) estimateRisk = "medium";
  else if (ratio <= 1.03) estimateRisk = "high";
  else estimateRisk = "very_high";

  const fpsForMetric = outFps || 60;
  const bpppf = (videoKbps * 1000) / (outWidth * outHeight * fpsForMetric);

  return {
    ok: true,

    durationSec: clipDurationSec,
    sourceDurationSec: durationSec,
    clipStart,
    clipEnd,
    inWidth,
    inHeight,
    inFps,

    outWidth,
    outHeight,
    outFps,

    codec,
    scale,

    audioMode,
    audioTracksInfo,
    audioKbpsPerTrack,
    audioSelected: selectedStreamIndexes,
    audioSelectedCount: selectedStreamIndexes.length,
    audioKbpsTotal,

    videoKbps,
    estimateMb: estMb,
    overheadMb,
    overheadRatio,

    bpppf,
    estimateRisk,
    estimateRatio: ratio,
  };
}

module.exports = { estimateSizeFirst };
