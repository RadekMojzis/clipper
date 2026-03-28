# Clipper

Clipper is a small desktop app for trimming and recompressing video clips to a target file size.

It uses:
- `Electron` for the desktop shell
- `Vue 3` + `Vite` for the UI
- `ffmpeg` / `ffprobe` for media processing

## What It Does

- Drag in one or more video files
- Set a target output size in MB
- Choose codec, FPS cap, scale, and audio behavior
- Optionally trim by `start` and `end`
- Enter trim times as seconds or formatted text like `1:27:13.7`
- Encode to MP4 with progress reporting

## Requirements

- Node.js and npm
- Windows
- `ffmpeg` and `ffprobe`

For development, the app expects:

```text
C:\ffmpeg\bin\ffmpeg.exe
C:\ffmpeg\bin\ffprobe.exe
```

Those paths are configured in [electron/config.cjs](./electron/config.cjs). In packaged releases, the app can also resolve bundled binaries from `resources/bin`.

## Install

```bash
npm install
```

## Run In Development

```bash
npm run dev
```

This starts the Vite dev server and launches the Electron app against it.

## Run Without The Dev Server

Build the frontend:

```bash
npm run build
```

Then launch Electron against the built app:

```bash
npm run electron
```

## Packaging And Releases

The project now has two packaging paths:

- `npm run package` for a local portable build
- `npm run release` for a version-bumped release build

Both flows build the frontend first, then run `electron-builder` with the shared config in [scripts/electron-builder.cjs](./scripts/electron-builder.cjs).

### Local Package

```bash
npm run package
```

This creates a Windows portable `.exe` in `release/` for local testing.

Behavior:

- uses the current `package.json` version
- names the artifact like `ClipperV<major>.<minor>.exe`
- does not bundle `ffmpeg` or `ffprobe`
- expects local binaries to still exist at `C:\ffmpeg\bin\...`

### Release Build

```bash
npm run release
```

This is the release pipeline for Windows portable builds.

Behavior:

- bumps the app version by incrementing the minor version in `package.json` and `package-lock.json`
- builds the frontend
- creates a portable Windows `.exe`
- bundles `ffmpeg.exe` and `ffprobe.exe` into the app under `resources/bin`
- names the artifact like `ClipperV<major>.<minor>-ffmpeg.exe`

Because the release script edits version files, you should commit those changes after running it if you want the version bump tracked in Git.

### Release Output Cleanup

After packaging, [scripts/cleanup-release.cjs](./scripts/cleanup-release.cjs) removes intermediate builder output and keeps the final `.exe` in `release/`.

## Project Scripts

- `npm run dev` - start Vite and Electron in development mode
- `npm run build` - build the frontend into `dist`
- `npm run electron` - run Electron using the built frontend
- `npm run package` - create a local portable Windows build without bundled `ffmpeg`
- `npm run release` - bump the minor version and create a release portable Windows build with bundled `ffmpeg`

## Project Structure

```text
electron/   Electron main process, IPC, ffmpeg services
scripts/    Packaging and release helpers
src/        Vue UI
dist/       Production frontend build output
release/    Final packaged .exe output
```

## Current Status

The app is functional for local use, packaging, and portable Windows releases. A few good next improvements would still be:

- clean up TypeScript declaration files
- add code signing for Windows builds
- add screenshots or usage examples to this README
