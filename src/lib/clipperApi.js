// src/lib/clipperApi.js
export const clipperApi = {
  ping() {
    return window.clipper.ping();
  },

  getOutputDir() {
    return window.clipper.getOutputDir();
  },

  estimate(cfg) {
    return window.clipper.estimate(cfg);
  },

  enqueueJobs(payload) {
    return window.clipper.enqueueJobs(payload);
  },

  cancelJob(jobId) {
    return window.clipper.cancelJob(jobId);
  },

  pathForFile(file) {
    return window.clipper.pathForFile(file);
  },

  onJobStatus(cb) {
    return window.clipper.onJobStatus(cb);
  },
};
