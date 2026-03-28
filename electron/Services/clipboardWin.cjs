
// electron/services/clipboardWin.cjs
function buildCF_HDROP(paths) {
  // DROPFILES struct (20 bytes):
  // DWORD pFiles; LONG x; LONG y; DWORD fNC; DWORD fWide;
  const DROPFILES_SIZE = 20;

  // Windows expects double-null-terminated UTF-16LE strings
  const normalized = (paths || [])
    .filter(Boolean)
    .map((p) => String(p).replace(/\//g, "\\"));

  const joined = normalized.join("\0") + "\0\0";
  const filesBuf = Buffer.from(joined, "ucs2"); // UTF-16LE

  const header = Buffer.alloc(DROPFILES_SIZE);
  header.writeUInt32LE(DROPFILES_SIZE, 0); // pFiles offset
  header.writeInt32LE(0, 4);               // pt.x
  header.writeInt32LE(0, 8);               // pt.y
  header.writeUInt32LE(0, 12);             // fNC
  header.writeUInt32LE(1, 16);             // fWide (UTF-16)

  return Buffer.concat([header, filesBuf]);
}

function buildPreferredDropEffectCopy() {
  // DWORD DROPEFFECT_COPY = 1
  const b = Buffer.alloc(4);
  b.writeUInt32LE(1, 0);
  return b;
}

module.exports = { buildCF_HDROP, buildPreferredDropEffectCopy };

