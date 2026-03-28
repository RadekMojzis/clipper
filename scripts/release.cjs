const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { cleanupReleaseArtifacts } = require("./cleanup-release.cjs");

const root = path.join(__dirname, "..");
const packageJsonPath = path.join(root, "package.json");
const packageLockPath = path.join(root, "package-lock.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function bumpMinor(version) {
  const [majorRaw = "0", minorRaw = "0"] = String(version || "0.0.0").split(".");
  const major = Number(majorRaw);
  const minor = Number(minorRaw);

  if (!Number.isFinite(major) || !Number.isFinite(minor)) {
    throw new Error(`Unsupported version format: ${version}`);
  }

  return `${major}.${minor + 1}.0`;
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const packageJson = readJson(packageJsonPath);
const packageLock = readJson(packageLockPath);
const nextVersion = bumpMinor(packageJson.version);

packageJson.version = nextVersion;
packageLock.version = nextVersion;
if (packageLock.packages?.[""]) {
  packageLock.packages[""].version = nextVersion;
}

writeJson(packageJsonPath, packageJson);
writeJson(packageLockPath, packageLock);

run("npm", ["run", "build"]);
run("npx", ["electron-builder", "--win", "portable", "--config", "scripts/electron-builder.cjs"], {
  ...process.env,
  CLIPPER_RELEASE_VERSION: `${nextVersion.split(".")[0]}.${nextVersion.split(".")[1]}`,
  CLIPPER_INCLUDE_FFMPEG: "1",
});
cleanupReleaseArtifacts();
