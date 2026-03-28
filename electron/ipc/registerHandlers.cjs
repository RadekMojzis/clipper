// electron/ipc/registerHandlers.cjs
const { shell, clipboard } = require("electron");
const { getOutputDir, pickOutputPath } = require("../services/paths.cjs");
const { encodeOne } = require("../services/encode.cjs");
const { estimateSizeFirst } = require("../services/estimate.cjs");
const path = require("path");
const { buildCF_HDROP, buildPreferredDropEffectCopy } = require("../services/clipboardWin.cjs");
const { spawn } = require("child_process");
const fs = require("fs");


function registerHandlers({ ipcMain, app, runningJobs }) {
  ipcMain.handle("app:ping", async () => ({ ok: true, name: "clipper" }));

  ipcMain.handle("paths:openOutputDir", async () => {
    const dir = getOutputDir(app);
    try {
      const result = await shell.openPath(dir);

      // shell.openPath returns "" on success, or an error message string on failure
      if (result) return { ok: false, error: result };

      return { ok: true, dir };
    } catch (err) {
      return { ok: false, error: String(err?.message || err) };
    }
  });

  ipcMain.handle("paths:copyFileToClipboard", async (_event, filePath) => {
    if (process.platform !== "win32") return { ok: false, error: "Windows only" };

    const p = String(filePath || "");
    if (!p) return { ok: false, error: "Missing path" };

    try {
      const st = fs.statSync(p);
      if (!st.isFile()) return { ok: false, error: "Not a file" };
    } catch {
      return { ok: false, error: "File does not exist" };
    }

    return await new Promise((resolve) => {
      // Use -LiteralPath to avoid weird escaping issues
      const ps = spawn(
        "powershell.exe",
        [
          "-NoProfile",
          "-ExecutionPolicy", "Bypass",
          "-Command",
          `Set-Clipboard -LiteralPath @('${p.replace(/'/g, "''")}')`
        ],
        { windowsHide: true }
      );

      let stderr = "";
      ps.stderr.on("data", (d) => (stderr += d.toString()));

      ps.on("close", (code) => {
        if (code === 0) resolve({ ok: true });
        else resolve({ ok: false, error: stderr || `PowerShell exited ${code}` });
      });

      ps.on("error", (e) => resolve({ ok: false, error: String(e?.message || e) }));
    });
  });

  ipcMain.handle("paths:outputDir", async () => {
    return { ok: true, dir: getOutputDir(app) };
  });

  ipcMain.handle("jobs:cancel", async (_event, jobId) => {
    const proc = runningJobs.get(jobId);
    if (!proc) return { ok: false, reason: "not-running" };

    proc.__cancelled = true;

    try { proc.kill("SIGTERM"); } catch { }
    // don't delete here; let spawnFfmpeg cleanup and send status
    return { ok: true };
  });

  ipcMain.handle("jobs:enqueue", async (event, payload) => {
    const outputDir = getOutputDir(app);

    const f = payload.file;
    const jobId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const codec = f.codec || "av1";

    const outputPath = pickOutputPath(f.path, outputDir, codec, f.targetMb);

    try {
      const r = await encodeOne(runningJobs, {
        inputPath: f.path,
        outputPath,
        targetSizeMb: Number(f.targetMb),
        codec,
        audioMode: f.audioMode || "all",
        audioSelected: Array.isArray(f.audioSelected) ? f.audioSelected : [],
        audioKbps: Number(f.audioKbps),
        fpsCap: Number(f.fpsCap),
        scale: Number(f.scale),
        start: f.start == null ? null : Number(f.start),
        end: f.end == null ? null : Number(f.end),
        crf: Number(f.crf ?? 0),
        eventSender: event.sender,
        jobId,
      });

      return { ok: true, jobId, ...r };
    } catch (err) {
      return { ok: false, jobId, error: String(err?.message || err) };
    }
  });

  ipcMain.handle("estimate", async (_event, cfg) => {
    try {
      return await estimateSizeFirst(cfg);
    } catch (err) {
      return { ok: false, error: String(err?.message || err) };
    }
  });
}

module.exports = { registerHandlers };
