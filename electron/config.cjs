// electron/config.cjs
module.exports = {
  FFMPEG: "C:\\ffmpeg\\bin\\ffmpeg.exe",
  FFPROBE: "C:\\ffmpeg\\bin\\ffprobe.exe",

  // ffmpeg thread limits (secondary cap; affinity is primary on Windows)
  FFMPEG_THREADS: 6,

  // SVT-AV1
  SVT_PRESET: "8",
  SVT_PARAMS: "lp=6:pin=0",

  // Windows process limits (best-effort)
  WIN_PRIORITY_CLASS: "BelowNormal",
  WIN_AFFINITY_MASK_HEX: "0FFF", // CPUs 0..11
};
