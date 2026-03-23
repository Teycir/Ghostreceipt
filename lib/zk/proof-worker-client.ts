export function createProofWorker(): Worker {
  return new Worker(new URL('./proof-worker.ts', import.meta.url), {
    type: 'module',
  });
}
