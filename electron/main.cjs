// electron/main.cjs
const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");
const { registerHandlers } = require("./ipc/registerHandlers.cjs");

const runningJobs = new Map(); // jobId -> ChildProcess (current pass)

function createWindow() {
  const win = new BrowserWindow({
    width: 1350,
    height: 860,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;

  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  // IPC wiring
  registerHandlers({ ipcMain: require("electron").ipcMain, app, runningJobs });

  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});


