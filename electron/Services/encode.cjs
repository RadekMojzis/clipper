// electron/services/encode.cjs
const { FFMPEG_THREADS, SVT_PARAMS, SVT_PRESET } = require("../config.cjs");
const { runFfprobeDurationSeconds, runFfprobeAudioTracks } = require("./ffprobe.cjs");
const { passlogPath, cleanupPasslogs, spawnFfmpeg } = require("./ffmpeg.cjs");
const fs = require("fs");

function pickVideoEncoder(codec) {
  if (codec === "h264") return "libx264";
  return "libsvtav1";
}

function computeVideoBitrateKbps({ durationSec, targetSizeMb, audioKbps = 96, overheadRatio }) {
  const targetBits = targetSizeMb * 1024 * 1024 * 8;
  const overheadBits = targetBits * overheadRatio;
  const audioBits = audioKbps * 1000 * durationSec;

  const videoBits = targetBits - overheadBits - audioBits;
  const videoKbps = Math.floor(videoBits / durationSec / 1000);
  return Math.max(videoKbps, 150);
}

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

/**
 * NOTE:
 * - audioSelected: array of GLOBAL stream indexes (numbers)
 * - audio order in output == source order (audioTracksInfo order)
 * - track naming: set title + handler_name per output stream
 */
async function encodeOne(runningJobs, {
  inputPath,
  outputPath,
  targetSizeMb,
  codec,
  audioMode,     // "all" | "custom" | "none"
  audioSelected, // global stream indexes
  audioKbps,     // per track
  fpsCap,
  scale,
  start,
  end,
  crf,           // ignored
  eventSender,
  jobId,
}) {
  const sourceDurationSec = await runFfprobeDurationSeconds(inputPath);
  const { clipStart, clipEnd, clipDurationSec } = normalizeClipWindow(sourceDurationSec, start, end);

  const audioTracksInfo = await runFfprobeAudioTracks(inputPath);
  const validSet = new Set(audioTracksInfo.map((t) => Number(t.streamIndex)));
  const wanted = Array.isArray(audioSelected) ? audioSelected.map((x) => Number(x)) : [];

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

  const audioPerTrackKbps = Number(audioKbps || 160);
  const audioKbpsTotal = selectedStreamIndexes.length * audioPerTrackKbps;

  const overheadRatio = codec === "h264" ? 0.08 : 0.12;
  const videoKbps = computeVideoBitrateKbps({
    durationSec: clipDurationSec,
    targetSizeMb,
    audioKbps: audioKbpsTotal,
    overheadRatio,
  });

  const vf = [];
  if (fpsCap && fpsCap > 0) vf.push(`fps=${fpsCap}`);
  if (scale && scale !== 1) vf.push(`scale=iw*${scale}:ih*${scale}`);
  const vfArg = vf.length ? ["-vf", vf.join(",")] : [];

  // mapping
  const mapArgs = ["-map", "0:v:0"];
  if (audioMode === "all") {
    mapArgs.push("-map", "0:a?");
  } else if (audioMode === "custom" && selectedStreamIndexes.length > 0) {
    for (const si of selectedStreamIndexes) {
      mapArgs.push("-map", `0:${si}?`);
    }
  }

  const audioArgs =
    audioMode === "none" || selectedStreamIndexes.length === 0
      ? []
      : ["-c:a", "aac", "-b:a", `${audioPerTrackKbps}k`, "-ac", "2"];

  // per-output audio stream metadata (prevents "Sound handler")
  const audioMetaArgs = [];
  if (audioMode !== "none" && selectedStreamIndexes.length > 0) {
    const byIndex = new Map(audioTracksInfo.map((t) => [Number(t.streamIndex), t]));
    selectedStreamIndexes.forEach((si, outAi) => {
      const t = byIndex.get(Number(si));
      if (!t) return;

      const name = String(t.displayName || t.title || t.handlerName || `Track ${outAi + 1}`);
      audioMetaArgs.push(`-metadata:s:a:${outAi}`, `title=${name}`);
      audioMetaArgs.push(`-metadata:s:a:${outAi}`, `handler_name=${name}`);
      if (t.language) audioMetaArgs.push(`-metadata:s:a:${outAi}`, `language=${String(t.language)}`);
    });
  }

  const metaArgs = [
    "-metadata",
    `comment=Clipper | size-first | codec=${codec} | fps=${fpsCap || "src"} | scale=${scale || 1} | clip=${clipStart}-${clipEnd}s | vbr=${videoKbps}k | a=${audioMode}:${audioPerTrackKbps}k x${selectedStreamIndexes.length}`,
    "-metadata",
    `encoder=Clipper`,
  ];

  const vCodec = pickVideoEncoder(codec);

  const vCodecArgs =
    codec === "av1"
      ? ["-svtav1-params", SVT_PARAMS, "-preset", SVT_PRESET]
      : ["-preset", "slow", "-profile:v", "high", "-level", "4.2", "-pix_fmt", "yuv420p"];

  const passlog = passlogPath(jobId);
  const NULL_OUT = process.platform === "win32" ? "NUL" : "/dev/null";

  const baseArgs = [
    "-y",
    "-i", inputPath,
    ...(clipStart > 0 ? ["-ss", String(clipStart)] : []),
    ...(clipDurationSec < sourceDurationSec ? ["-t", String(clipDurationSec)] : []),
    ...mapArgs,

    "-c:v", vCodec,
    ...vCodecArgs,

    "-b:v", `${videoKbps}k`,
    "-threads", String(FFMPEG_THREADS),

    ...vfArg,
  ];

  const pass1Args = [
    ...baseArgs,
    "-an",
    "-pass", "1",
    "-passlogfile", passlog,
    "-progress", "pipe:1",
    "-nostats",
    "-f", "null",
    NULL_OUT,
  ];

  const pass2Args = [
    ...baseArgs,
    ...audioArgs,
    ...audioMetaArgs,
    ...metaArgs,

    "-pass", "2",
    "-passlogfile", passlog,

    "-movflags", "+faststart",
    "-progress", "pipe:1",
    "-nostats",

    outputPath,
  ];

  eventSender.send("jobs:status", {
    jobId,
    phase: "start",
    pass: 1,
    inputPath,
    outputPath,
    durationSec: clipDurationSec,
    sourceDurationSec,
    clipStart,
    clipEnd,
    codec,
    videoKbps,
    audioMode,
    audioPerTrackKbps,
    audioSelected: selectedStreamIndexes,
  });

  try {
    const r1 = await spawnFfmpeg(runningJobs, jobId, pass1Args, {
      onProgressKv: (kv) => {
        const outTimeMs = parseInt(kv.out_time_ms || "0", 10);
        const outTimeSec = outTimeMs / 1_000_000;
        const passPct = clipDurationSec > 0 ? Math.min(100, (outTimeSec / clipDurationSec) * 100) : 0;

        eventSender.send("jobs:status", {
          jobId,
          phase: "progress",
          pass: 1,
          inputPath,
          outputPath,
          pct: passPct * 0.5,
          passPct,
          outTimeSec,
        });
      },
    });
    if (r1?.cancelled) {
      cleanupPasslogs(passlog);
      eventSender.send("jobs:status", { jobId, phase: "cancelled", inputPath, outputPath });
      return { ok: false, cancelled: true };
    }
  } catch (err) {
    cleanupPasslogs(passlog);
    eventSender.send("jobs:status", {
      jobId,
      phase: "error",
      inputPath,
      outputPath,
      error: String(err?.message || err),
    });
    throw err;
  }

  try {
    const r2 = await spawnFfmpeg(runningJobs, jobId, pass2Args, {
      onProgressKv: (kv) => {
        const outTimeMs = parseInt(kv.out_time_ms || "0", 10);
        const outTimeSec = outTimeMs / 1_000_000;
        const passPct = clipDurationSec > 0 ? Math.min(100, (outTimeSec / clipDurationSec) * 100) : 0;

        eventSender.send("jobs:status", {
          jobId,
          phase: "progress",
          pass: 2,
          inputPath,
          outputPath,
          pct: 50 + passPct * 0.5,
          passPct,
          outTimeSec,
        });
      },
    });
    if (r2?.cancelled) {
      cleanupPasslogs(passlog);
      eventSender.send("jobs:status", { jobId, phase: "cancelled", inputPath, outputPath });
      return { ok: false, cancelled: true };
    }
  } catch (err) {
    cleanupPasslogs(passlog);
    eventSender.send("jobs:status", {
      jobId,
      phase: "error",
      inputPath,
      outputPath,
      error: String(err?.message || err),
    });
    throw err;
  } finally {
    cleanupPasslogs(passlog);
  }
  let outputBytes = null;
  try {
    const st = fs.statSync(outputPath);
    outputBytes = Number(st.size) || null;
  } catch { }
  eventSender.send("jobs:status", { jobId, phase: "done", inputPath, outputPath, outputBytes });
  return { ok: true, outputPath };
}

module.exports = {
  encodeOne,
  computeVideoBitrateKbps,
};
