<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import ClipRow from "./components/ClipRow.vue";
import DropRow from "./components/DropRow.vue";

const files = ref([]);
const outputDir = ref("");
const isWindowDragOver = ref(false);
let windowDragDepth = 0;

function addFiles(dropped) {
  for (const f of dropped) {
    if (files.value.some((x) => x.path === f.path)) continue;

    files.value.push({
      id: crypto.randomUUID(),
      path: f.path,
      name: f.name,
      size: f.size,

      // per-file settings
      codec: "av1",
      targetMb: 50,
      crf: 30,
      fpsCap: 0,
      scale: 1.0,
      startText: "",
      endText: "",
      startSeconds: null,
      endSeconds: null,
      startError: "",
      endError: "",

      // audio settings
      audioMode: "all",
      audioKbps: 160,
      audioSelected: [],
      audioTracksInfo: [],

      // probe info
      inWidth: null,
      inHeight: null,
      inFps: null,

      // runtime
      status: "idle",
      pass: 1,
      pct: 0,
      pctMonotonic: 0, // ✅ prevents “flash” / regress
      estimateMb: null,
      estimateRisk: null,
      estimateRatio: null,
      jobId: null,
      outputPath: null,
      error: "",
      outputBytes: null,
    });
  }
}

function isFileDrag(event) {
  const types = event?.dataTransfer?.types;
  return Array.isArray(types)
    ? types.includes("Files")
    : typeof types?.contains === "function"
      ? types.contains("Files")
      : false;
}

function mapDroppedFiles(fileList) {
  return Array.from(fileList || []).map((f) => ({
    path: window.clipper.pathForFile(f),
    name: f.name,
    size: f.size,
  }));
}

function clearWindowDragState() {
  windowDragDepth = 0;
  isWindowDragOver.value = false;
}

function onWindowDragEnter(event) {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  windowDragDepth += 1;
  isWindowDragOver.value = true;
}

function onWindowDragOver(event) {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  isWindowDragOver.value = true;
}

function onWindowDragLeave(event) {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  windowDragDepth = Math.max(0, windowDragDepth - 1);
  if (windowDragDepth === 0) {
    isWindowDragOver.value = false;
  }
}

function onWindowDrop(event) {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  clearWindowDragState();
  addFiles(mapDroppedFiles(event.dataTransfer.files));
}

async function openOutputFolder() {
  try {
    await window.clipper.openOutputDir();
  } catch (e) {
    console.error("Failed to open output dir", e);
  }
}

function removeFile(id) {
  files.value = files.value.filter((f) => f.id !== id);
}

let offJobStatus = null;

onMounted(async () => {
  const out = await window.clipper.getOutputDir();
  if (out?.ok) outputDir.value = out.dir;

  window.addEventListener("dragenter", onWindowDragEnter);
  window.addEventListener("dragover", onWindowDragOver);
  window.addEventListener("dragleave", onWindowDragLeave);
  window.addEventListener("drop", onWindowDrop);

  offJobStatus = window.clipper.onJobStatus((msg) => {
    if (!msg?.inputPath) return;

    const f = files.value.find((x) => x.path === msg.inputPath);
    if (!f) return;

    if (msg.phase === "start") {
      const prevStatus = f.status;
      const prevJobId = f.jobId;
      const isNewJob = msg.jobId && msg.jobId !== prevJobId;

      f.status = "encoding";
      f.pass = msg.pass ?? 1;
      f.jobId = msg.jobId;
      f.outputPath = msg.outputPath || "";
      f.error = "";

      // ✅ reset when re-encoding (new job) OR coming from a finished/error state
      if (isNewJob || ["done", "error", "cancelled"].includes(prevStatus)) {
        f.pct = 0;
        f.pctMonotonic = 0;
      }
    }


    if (msg.phase === "progress") {
      f.status = "encoding";
      f.pass = msg.pass ?? f.pass ?? 1;

      const next = Math.max(0, Math.min(100, Math.round(Number(msg.pct || 0))));
      f.pctMonotonic = Math.max(Number(f.pctMonotonic || 0), next);
      f.pct = f.pctMonotonic;
    }

    if (msg.phase === "done") {
      f.status = "done";
      f.pct = 100;
      f.pctMonotonic = 100;
      
      f.outputPath = msg.outputPath || f.outputPath || "";
      f.outputBytes = Number.isFinite(msg.outputBytes) ? Number(msg.outputBytes) : null;
    }
    if (msg.phase === "cancelled") {
      f.status = "cancelled";
      f.pct = 0;
      f.pctMonotonic = 0
      f.error = "";
    }
    if (msg.phase === "error") {
      if (f.status === "cancelled") return;

      f.status = "error";
      f.error = msg.error || "Unknown error";
    }
  });

});

onBeforeUnmount(() => {
  offJobStatus?.();
  window.removeEventListener("dragenter", onWindowDragEnter);
  window.removeEventListener("dragover", onWindowDragOver);
  window.removeEventListener("dragleave", onWindowDragLeave);
  window.removeEventListener("drop", onWindowDrop);
});
</script>

<template>
  <div class="min-h-screen bg-ink-950 text-white">
    <header class="border-b border-white/10 bg-ink-900/60 backdrop-blur py-5">
      <div class="mx-auto flex max-w-6xl items-start justify-between px-6 gap-6">
        <div>
          <h1 class="text-4xl font-extrabold tracking-tight">Clipper</h1>
        </div>
        <div class="flex max-w-[55vw] items-center gap-2">
        <div class="min-w-0 flex-1 truncate text-sm text-white/80">
          {{ outputDir }}
        </div>

        <button
          @click="openOutputFolder"
          class="btn-action btn-glow btn-amber shadow-glowA group"
          title="Open output folder"
        >
          <fa icon="folder" class="relative z-10" />
        </button>
      </div>

        
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-6 py-7">
      <div class="space-y-4">
        <ClipRow v-for="f in files" :key="f.id" :file="f" @remove="removeFile" />
        <DropRow :is-drag-over="isWindowDragOver" @drop-files="addFiles" />
      </div>
    </main>
  </div>
</template>
