<script setup>
const emit = defineEmits(["drop-files"]);

function onDrop(e) {
  e.preventDefault();
  console.log(e.dataTransfer.files)
  const files = Array.from(e.dataTransfer.files).map((f) => ({
    path: window.clipper.pathForFile(f),
    name: f.name,
    size: f.size,
  }));
  emit("drop-files", files);
}
</script>

<template>
  <div
    class="group rounded-3xl border border-white/10 bg-ink-900/40 p-8 text-center transition hover:border-grass-500/40 hover:shadow-glowG"
    @dragover.prevent
    @drop="onDrop"
  >
    <div class="mx-auto flex max-w-xl flex-col items-center gap-3">
      <div class="text-5xl font-black text-grass-400 transition group-hover:scale-105">
        +
      </div>
      <div class="text-lg font-semibold">Drop videos here</div>
      <div class="text-base text-white/60">
        Add multiple files — each row can have different settings.
      </div>
    </div>
  </div>
</template>
