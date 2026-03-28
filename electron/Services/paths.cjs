// electron/services/paths.cjs
const path = require("path");
const fs = require("fs");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}

function getOutputDir(app) {
  const videos = app.getPath("videos"); // e.g. C:\Users\You\Videos
  return ensureDir(path.join(videos, "clipper"));
}

function safeBaseName(filePath) {
  const base = path.basename(filePath);
  return base.replace(path.extname(base), "");
}

function pickOutputPath(inputPath, outputDir, codec, targetSizeMb) {
  const base = safeBaseName(inputPath);
  const ext = ".mp4";
  const suffix = `_${codec}_${targetSizeMb}MB`;
  return path.join(outputDir, `${base}${suffix}${ext}`);
}

module.exports = {
  ensureDir,
  getOutputDir,
  safeBaseName,
  pickOutputPath,
};
