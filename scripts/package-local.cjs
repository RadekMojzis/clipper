const { spawnSync } = require("child_process");
const path = require("path");
const { cleanupReleaseArtifacts } = require("./cleanup-release.cjs");

const packageJson = require(path.join(__dirname, "..", "package.json"));

function toShortVersion(version) {
  const [major = "0", minor = "0"] = String(version || "0.0.0").split(".");
  return `${major}.${minor}`;
}

const env = {
  ...process.env,
  CLIPPER_RELEASE_VERSION: toShortVersion(packageJson.version),
  CLIPPER_INCLUDE_FFMPEG: "0",
};

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
    shell: true,
    env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npm", ["run", "build"]);
run("npx", ["electron-builder", "--win", "portable", "--config", "scripts/electron-builder.cjs"]);
cleanupReleaseArtifacts();
