import { groth16 } from 'snarkjs';
import type { ReceiptWitness } from '@ghostreceipt/zk-core';

interface ProveRequestMessage {
  id: number;
  type: 'prove';
  witness: ReceiptWitness;
  wasmPath: string;
  zkeyPath: string;
}

interface ProveSuccessMessage {
  id: number;
  proof: unknown;
  publicSignals: string[];
  type: 'prove_success';
}

interface ProveErrorMessage {
  error: string;
  id: number;
  type: 'prove_error';
}

type WorkerRequestMessage = ProveRequestMessage;
type WorkerResponseMessage = ProveSuccessMessage | ProveErrorMessage;

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequestMessage>) => void) | null;
  postMessage: (message: WorkerResponseMessage) => void;
};

workerScope.onmessage = async (event: MessageEvent<WorkerRequestMessage>): Promise<void> => {
  const message = event.data;
  if (!message || message.type !== 'prove') {
    return;
  }

  try {
    const { proof, publicSignals } = await groth16.fullProve(
      message.witness as any,
      message.wasmPath,
      message.zkeyPath
    );
    const successMessage: ProveSuccessMessage = {
      id: message.id,
      proof,
      publicSignals: publicSignals as string[],
      type: 'prove_success',
    };
    workerScope.postMessage(successMessage satisfies WorkerResponseMessage);
  } catch (error) {
    const errorMessage: ProveErrorMessage = {
      error: error instanceof Error ? error.message : 'Unknown worker prove error',
      id: message.id,
      type: 'prove_error',
    };
    workerScope.postMessage(errorMessage satisfies WorkerResponseMessage);
  }
};

export {};
