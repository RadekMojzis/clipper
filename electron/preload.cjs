const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("clipper", {
  // sanity check
  ping: () => ipcRenderer.invoke("app:ping"),

  // paths
  getOutputDir: () => ipcRenderer.invoke("paths:outputDir"),
  pickVideoFiles: () => ipcRenderer.invoke("paths:pickVideoFiles"),

  // encoding
  enqueueJobs: (payload) => ipcRenderer.invoke("jobs:enqueue", payload),
  cancelJob: (jobId) => ipcRenderer.invoke("jobs:cancel", jobId),

  // estimation
  estimate: (cfg) => ipcRenderer.invoke("estimate", cfg),

  // drag & drop helper
  pathForFile: (file) => webUtils.getPathForFile(file),

  // job progress events
  onJobStatus: (cb) => {
    const handler = (_event, data) => cb(data);
    ipcRenderer.on("jobs:status", handler);
    return () => ipcRenderer.removeListener("jobs:status", handler);
  },
  copyFileToClipboard: (filePath) => ipcRenderer.invoke("paths:copyFileToClipboard", filePath),
  
  openOutputDir: () => ipcRenderer.invoke("paths:openOutputDir"),
});
