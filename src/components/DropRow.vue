<script setup>
const props = defineProps({
  isDragOver: {
    type: Boolean,
    default: false,
  },
});
const emit = defineEmits(["drop-files"]);

function emitFiles(files) {
  if (files.length) {
    emit("drop-files", files);
  }
}

async function onClick() {
  const result = await window.clipper.pickVideoFiles();
  if (!result?.ok) {
    console.error("Failed to pick files", result?.error);
    return;
  }

  emitFiles(result.files || []);
}
</script>

<template>
  <div
    :class="[
      'group cursor-pointer rounded-3xl border bg-ink-900/40 p-8 pb-12 text-center transition',
      props.isDragOver
        ? 'border-green-500/40 bg-green-900/10 shadow-[0_0_0_1px_rgba(34,197,94,.25),0_0_22px_rgba(34,197,94,.20)]'
        : 'border-white/10 hover:border-green-500/40 hover:bg-green-900/10 hover:shadow-[0_0_0_1px_rgba(34,197,94,.25),0_0_22px_rgba(34,197,94,.20)]',
    ]"
    role="button"
    tabindex="0"
    @click="onClick"
    @keydown.enter.prevent="onClick"
    @keydown.space.prevent="onClick"
  >
    <div class="mx-auto flex max-w-xl flex-col items-center gap-3">
      <div :class="['text-5xl font-black transition', props.isDragOver ? 'text-green-300' : 'group-hover:text-green-300']">
        +
      </div>
      <div :class="['text-lg font-semibold transition', props.isDragOver ? 'text-green-300' : 'group-hover:text-green-300']">
        Drop videos here
      </div>
    </div>
  </div>
</template>
