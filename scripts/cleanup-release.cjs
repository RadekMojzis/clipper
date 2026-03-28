const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const releaseDir = path.join(root, "release");

function removeIfExists(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function cleanupReleaseArtifacts() {
  if (!fs.existsSync(releaseDir)) return;

  for (const entry of fs.readdirSync(releaseDir)) {
    const fullPath = path.join(releaseDir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isFile() && entry.toLowerCase().endsWith(".exe")) continue;

    removeIfExists(fullPath);
  }
}

module.exports = { cleanupReleaseArtifacts };
