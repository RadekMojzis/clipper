// electron/config.cjs
const path = require("path");
const fs = require("fs");
const { app } = require("electron");

function resolveBinaryPath(name) {
  const localPath = path.join("C:\\ffmpeg\\bin", name);

  if (app?.isPackaged) {
    const bundledPath = path.join(process.resourcesPath, "bin", name);
    if (fs.existsSync(bundledPath)) {
      return bundledPath;
    }
  }

  return localPath;
}

module.exports = {
  FFMPEG: resolveBinaryPath("ffmpeg.exe"),
  FFPROBE: resolveBinaryPath("ffprobe.exe"),

  // ffmpeg thread limits (secondary cap; affinity is primary on Windows)
  FFMPEG_THREADS: 6,

  // SVT-AV1
  SVT_PRESET: "8",
  SVT_PARAMS: "lp=6:pin=0",

  // Windows process limits (best-effort)
  WIN_PRIORITY_CLASS: "BelowNormal",
  WIN_AFFINITY_MASK_HEX: "0FFF", // CPUs 0..11
};
