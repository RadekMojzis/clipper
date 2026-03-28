// electron/services/ffmpeg.cjs
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const { FFMPEG, WIN_PRIORITY_CLASS, WIN_AFFINITY_MASK_HEX } = require("../config.cjs");

function passlogPath(jobId) {
  const tmpDir = app.getPath("temp");
  return path.join(tmpDir, `clipper_pass_${jobId}`);
}

function cleanupPasslogs(passlogBase) {
  try {
    const tmpDir = app.getPath("temp");
    const base = path.basename(passlogBase);
    for (const f of fs.readdirSync(tmpDir)) {
      if (f.startsWith(base)) {
        try { fs.unlinkSync(path.join(tmpDir, f)); } catch { }
      }
    }
  } catch { }
}

function parseProgressKv(text) {
  const kv = {};
  for (const line of text.split(/\r?\n/)) {
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    kv[k] = v;
  }
  return kv;
}

function setWindowsProcessLimits(pid, { priorityClass = WIN_PRIORITY_CLASS, affinityMaskHex = WIN_AFFINITY_MASK_HEX } = {}) {
  return new Promise((resolve) => {
    if (process.platform !== "win32") return resolve();

    const psScript = `
      try {
        $p = Get-Process -Id ${pid} -ErrorAction Stop;
        try { $p.PriorityClass = '${priorityClass}'; } catch { }
        ${affinityMaskHex ? `try { $p.ProcessorAffinity = [intptr]0x${affinityMaskHex}; } catch { }` : ``}
      } catch { }
    `;

    const ps = spawn(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psScript],
      { windowsHide: true }
    );

    ps.on("close", () => resolve());
    ps.on("error", () => resolve());
  });
}

function spawnFfmpeg(runningJobs, jobId, args, { onProgressKv } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, args, { windowsHide: true });

    runningJobs.set(jobId, p);
    setWindowsProcessLimits(p.pid).catch(() => { });

    let buf = "";
    if (onProgressKv) {
      p.stdout.on("data", (d) => {
        buf += d.toString();
        if (buf.includes("\nprogress=") || buf.includes("\r\nprogress=")) {
          const kv = parseProgressKv(buf);
          buf = "";
          try { onProgressKv(kv); } catch { }
        }
      });
    } else {
      p.stdout?.on("data", () => { });
    }

    let stderr = "";
    p.stderr.on("data", (d) => (stderr += d.toString()));

    p.on("error", (err) => {
      if (runningJobs.get(jobId) === p) runningJobs.delete(jobId);
      reject(err);
    });

    p.on("close", (code, signal) => {
      if (runningJobs.get(jobId) === p) runningJobs.delete(jobId);

      // ✅ expected: user cancelled (SIGTERM / SIGINT) or we marked cancelled
      if (p.__cancelled && (signal === "SIGTERM" || signal === "SIGINT" || code !== 0)) {
        return resolve({ ok: false, cancelled: true });
      }

      if (code === 0) return resolve({ ok: true });

      reject(new Error(`ffmpeg failed (${signal ?? code}): ${stderr.slice(-2000)}`));
    });
  });
}


module.exports = {
  passlogPath,
  cleanupPasslogs,
  spawnFfmpeg,
};
