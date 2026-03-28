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

By default, the app expects:

```text
C:\ffmpeg\bin\ffmpeg.exe
C:\ffmpeg\bin\ffprobe.exe
```

Those paths are configured in [electron/config.cjs](./electron/config.cjs).

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

## Package A Portable Windows Build

```bash
npm run package
```

This currently creates a Windows portable build via `electron-builder`.

## Important Packaging Note

Packaging is set up, but the app is not fully self-contained yet.

Right now, the packaged app still depends on:
- `C:\ffmpeg\bin\ffmpeg.exe`
- `C:\ffmpeg\bin\ffprobe.exe`

So on another machine, the app will only work if those binaries exist at the same paths. A better next step would be bundling `ffmpeg` and `ffprobe` with the app and resolving them relative to the packaged application.

## Project Scripts

- `npm run dev` - start Vite and Electron in development mode
- `npm run build` - build the frontend into `dist`
- `npm run electron` - run Electron using the built frontend
- `npm run package` - build and package a portable Windows app

## Project Structure

```text
electron/   Electron main process, IPC, ffmpeg services
src/        Vue UI
dist/       Production frontend build output
```

## Current Status

The app is functional for local use and basic packaging, but there are still a few rough edges you may want to improve:

- bundle `ffmpeg` / `ffprobe` with the app
- clean up TypeScript declaration files
- add a proper release pipeline
- add screenshots or usage examples to this README
