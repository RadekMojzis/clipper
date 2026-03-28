// electron/services/ffprobe.cjs
const { spawn } = require("child_process");
const { FFPROBE } = require("../config.cjs");

function runFfprobeDurationSeconds(inputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      inputPath,
    ];

    const p = spawn(FFPROBE, args, { windowsHide: true });

    let out = "";
    let err = "";

    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));

    p.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffprobe failed (${code}): ${err || out}`));
      const dur = parseFloat(out.trim());
      if (!Number.isFinite(dur) || dur <= 0) return reject(new Error(`Invalid duration from ffprobe: "${out}"`));
      resolve(dur);
    });
  });
}

function runFfprobeVideoInfo(inputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height,r_frame_rate,avg_frame_rate",
      "-of", "json",
      inputPath,
    ];

    const p = spawn(FFPROBE, args, { windowsHide: true });

    let out = "";
    let err = "";

    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));

    p.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffprobe failed (${code}): ${err || out}`));

      try {
        const json = JSON.parse(out);
        const s = json?.streams?.[0];
        if (!s?.width || !s?.height) throw new Error("Missing width/height");

        const parseRate = (v) => {
          if (!v || typeof v !== "string") return null;
          const [n, d] = v.split("/").map(Number);
          if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
          return n / d;
        };

        const fpsAvg = parseRate(s.avg_frame_rate);
        const fpsR = parseRate(s.r_frame_rate);
        const fps = fpsAvg || fpsR || null;

        resolve({ width: s.width, height: s.height, fps });
      } catch (e) {
        reject(new Error(`ffprobe parse error: ${e.message}`));
      }
    });
  });
}

/**
 * Audio stream list with best-effort names.
 * - streamIndex is the GLOBAL stream index (works with -map 0:<index>)
 * - displayName is what we will try to preserve into MP4 (title/handler_name)
 */
function runFfprobeAudioTracks(inputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      "-v", "error",
      "-select_streams", "a",
      "-show_entries",
      "stream=index,codec_name,channels,sample_rate,bit_rate:stream_tags=language,title,handler_name",
      "-of", "json",
      inputPath,
    ];

    const p = spawn(FFPROBE, args, { windowsHide: true });

    let out = "";
    let err = "";

    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));

    p.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffprobe failed (${code}): ${err || out}`));

      try {
        const json = JSON.parse(out);
        const streams = Array.isArray(json?.streams) ? json.streams : [];

        const tracks = streams.map((s, i) => {
          const tags = s?.tags || {};
          const lang = tags.language ? String(tags.language) : "";
          const title = tags.title ? String(tags.title) : "";
          const handler = tags.handler_name ? String(tags.handler_name) : "";

          const displayName =
            title ||
            handler ||
            (lang ? `Track ${i + 1} (${lang})` : `Track ${i + 1}`);

          const codec = s?.codec_name ? String(s.codec_name) : "audio";
          const ch = Number(s?.channels || 0);
          const hz = s?.sample_rate ? Number(s.sample_rate) : null;

          const labelParts = [`#${i + 1}`, displayName, codec];
          if (ch) labelParts.push(`${ch}ch`);
          if (hz) labelParts.push(`${hz}Hz`);

          return {
            streamIndex: Number(s.index),
            ordinal: i,
            codec,
            channels: ch,
            sampleRate: hz,
            language: lang || null,
            title: title || null,
            handlerName: handler || null,
            displayName,
            label: labelParts.join(" · "),
          };
        });

        resolve(tracks);
      } catch (e) {
        reject(new Error(`ffprobe parse error: ${e.message}`));
      }
    });
  });
}

module.exports = {
  runFfprobeDurationSeconds,
  runFfprobeVideoInfo,
  runFfprobeAudioTracks,
};
