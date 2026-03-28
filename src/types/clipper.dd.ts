export { };

declare global {
  interface Window {
    clipper: {
      ping: () => Promise<{ ok: boolean; name: string }>;
      enqueueJobs: (payload: any) => Promise<any>;
    };
  }
}
