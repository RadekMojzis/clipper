const path = require("path");
const packageJson = require(path.join(__dirname, "..", "package.json"));

const releaseVersion = process.env.CLIPPER_RELEASE_VERSION || (() => {
  const [major = "0", minor = "0"] = String(packageJson.version || "0.0.0").split(".");
  return `${major}.${minor}`;
})();

const includeFfmpeg = process.env.CLIPPER_INCLUDE_FFMPEG === "1";
const artifactBaseName = includeFfmpeg
  ? `ClipperV${releaseVersion}-ffmpeg`
  : `ClipperV${releaseVersion}`;

const config = {
  appId: "com.clipper.app",
  directories: {
    output: "release",
  },
  artifactName: `${artifactBaseName}.\${ext}`,
  files: [
    "dist/**/*",
    "electron/**/*",
    "package.json",
  ],
  win: {
    icon: "public/icon (2).png",
    signAndEditExecutable: false,
    target: [
      "portable",
    ],
  },
};

if (includeFfmpeg) {
  config.extraResources = [
    {
      from: "C:/ffmpeg/bin/ffmpeg.exe",
      to: "bin/ffmpeg.exe",
    },
    {
      from: "C:/ffmpeg/bin/ffprobe.exe",
      to: "bin/ffprobe.exe",
    },
  ];
}

module.exports = config;
