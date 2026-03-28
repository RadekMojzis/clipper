// src/composables/useJobStatus.js
import { onMounted, onBeforeUnmount } from "vue";
import { clipperApi } from "../lib/clipperApi.js";

export function useJobStatus(filesRef) {
  let off = null;

  onMounted(() => {
    off = clipperApi.onJobStatus((msg) => {
      if (!msg?.inputPath) return;

      const f = filesRef.value.find((x) => x.path === msg.inputPath);
      if (!f) return;

      if (msg.phase === "start") {
        f.status = "encoding";
        f.pct = 0;
        f.pass = msg.pass ?? 1;
        f.jobId = msg.jobId;
        f.outputPath = msg.outputPath || "";
        f.error = "";
      } else if (msg.phase === "progress") {
        f.status = "encoding";
        f.pass = msg.pass ?? f.pass ?? 1;
        f.pct = Math.max(0, Math.min(100, Math.round(msg.pct || 0)));
      } else if (msg.phase === "done") {
        f.status = "done";
        f.pct = 100;
      } else if (msg.phase === "error") {
        f.status = "error";
        f.error = msg.error || "Unknown error";
      }
    });
  });

  onBeforeUnmount(() => {
    off?.();
  });
}
