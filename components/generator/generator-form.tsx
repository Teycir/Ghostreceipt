'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ReceiptSuccess } from './receipt-success';
import { announceToScreenReader } from '@/lib/accessibility';
import type { Chain, OraclePayload } from '@/lib/validation/schemas';

interface FormData {
  chain: Chain;
  txHash: string;
  claimedAmount: string;
  minDate: string;
}

type GeneratorState = 'idle' | 'fetching' | 'validating' | 'generating' | 'success' | 'error';

interface FormErrors {
  chain?: string;
  txHash?: string;
  claimedAmount?: string;
  minDate?: string;
}

interface ProofData {
  proof: string;
  chain: Chain;
  claimedAmount: string;
  minDate: string;
}

interface ApiErrorPayload {
  error?: {
    message?: string;
    details?: {
      retryAfterSeconds?: number;
    };
  };
}

export function GeneratorForm(): React.JSX.Element {
  const [formData, setFormData] = useState<FormData>({
    chain: 'bitcoin',
    txHash: '',
    claimedAmount: '',
    minDate: '',
  });
  const [state, setState] = useState<GeneratorState>('idle');
  const [errors, setErrors] = useState<FormErrors>({});
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [proofData, setProofData] = useState<ProofData | null>(null);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.txHash.trim()) {
      newErrors.txHash = 'Transaction hash is required';
    } else if (formData.chain === 'bitcoin' && !/^[a-fA-F0-9]{64}$/.test(formData.txHash)) {
      newErrors.txHash = 'Invalid Bitcoin transaction hash (64 hex characters)';
    } else if (formData.chain === 'ethereum' && !/^0x[a-fA-F0-9]{64}$/.test(formData.txHash)) {
      newErrors.txHash = 'Invalid Ethereum transaction hash (0x + 64 hex characters)';
    }

    if (!formData.claimedAmount.trim()) {
      newErrors.claimedAmount = 'Claimed amount is required';
    } else if (isNaN(Number(formData.claimedAmount)) || Number(formData.claimedAmount) <= 0) {
      newErrors.claimedAmount = 'Amount must be a positive number';
    }

    if (!formData.minDate) {
      newErrors.minDate = 'Minimum date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setState('fetching');
      setErrorMessage('');
      announceToScreenReader('Fetching transaction data');

      const response = await fetch('/api/oracle/fetch-tx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain: formData.chain,
          txHash: formData.txHash,
        }),
      });

      const data = (await response.json()) as {
        data?: OraclePayload;
      } & ApiErrorPayload;

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfterSeconds = data.error?.details?.retryAfterSeconds;
          const waitSeconds =
            typeof retryAfterSeconds === 'number' && retryAfterSeconds > 0
              ? Math.ceil(retryAfterSeconds)
              : 60;
          const waitLabel = waitSeconds === 1 ? '1 second' : `${waitSeconds} seconds`;
          throw new Error(`Rate limit reached. Please wait ${waitLabel} and try again.`);
        }

        throw new Error(data.error?.message || 'Failed to fetch transaction');
      }

      setState('validating');
      announceToScreenReader('Validating transaction data');

      if (!data.data) {
        throw new Error('Invalid response: missing oracle payload');
      }
      
      // Build witness from oracle payload and user claim
      const { buildWitness, validateWitness } = await import('@/lib/zk/witness');
      const witness = buildWitness(data.data, {
        claimedAmount: formData.claimedAmount,
        minDate: Math.floor(new Date(formData.minDate).getTime() / 1000),
      });
      
      // Validate witness constraints
      const validation = validateWitness(witness);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      setState('generating');
      announceToScreenReader('Generating zero-knowledge proof');
      
      // Generate proof
      const { createProofGenerator } = await import('@/lib/zk/prover');
      const prover = createProofGenerator();
      const proofResult = await prover.generateProof(witness);
      
      // Export shareable proof
      const shareableProof = prover.exportProof(proofResult, {
        expiresAt: data.data.expiresAt,
        messageHash: data.data.messageHash,
        nonce: data.data.nonce,
        oracleSignature: data.data.oracleSignature,
        oraclePubKeyId: data.data.oraclePubKeyId,
        signedAt: data.data.signedAt,
      });
      
      // Store proof for display
      setProofData({
        proof: shareableProof,
        chain: formData.chain,
        claimedAmount: formData.claimedAmount,
        minDate: formData.minDate,
      });

      setState('success');
      announceToScreenReader('Receipt generated successfully');
    } catch (error) {
      setState('error');
      announceToScreenReader(`Error: ${error instanceof Error ? error.message : 'An unexpected error occurred'}`);
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('An unexpected error occurred');
      }
    }
  };

  const handleRetry = (): void => {
    setState('idle');
    setErrorMessage('');
  };

  const pasteFromClipboard = async (field: keyof FormData): Promise<void> => {
    try {
      const text = await navigator.clipboard.readText();
      setFormData({ ...formData, [field]: text.trim() });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        setErrorMessage('Clipboard access denied');
        return;
      }
      setErrorMessage('Failed to read from clipboard');
    }
  };

  const getStateMessage = (): string => {
    switch (state) {
      case 'fetching':
        return 'Fetching transaction...';
      case 'validating':
        return 'Validating oracle data...';
      case 'generating':
        return 'Generating proof...';
      case 'success':
        return 'Receipt generated successfully!';
      default:
        return '';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select
        label="Chain"
        value={formData.chain}
        onChange={(e) => setFormData({ ...formData, chain: e.target.value as Chain })}
        disabled={state !== 'idle' && state !== 'error'}
        error={errors.chain}
      >
        <option value="bitcoin">Bitcoin</option>
        <option value="ethereum">Ethereum</option>
      </Select>

      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-foreground">
            Transaction Hash
          </label>
          <button
            type="button"
            onClick={() => {
              void pasteFromClipboard('txHash');
            }}
            className="px-2 py-1 text-xs bg-white/5 border border-white/10 rounded text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors"
          >
            📋 Paste
          </button>
        </div>
        <Input
          type="text"
          placeholder={formData.chain === 'bitcoin' ? '64 hex characters' : '0x + 64 hex characters'}
          value={formData.txHash}
          onChange={(value) => setFormData({ ...formData, txHash: value })}
          disabled={state !== 'idle' && state !== 'error'}
          error={errors.txHash}
        />
      </div>

      <Input
        label={`Claimed Amount ${formData.chain === 'bitcoin' ? '(satoshis)' : '(wei)'}`}
        type="text"
        placeholder="Enter amount"
        value={formData.claimedAmount}
        onChange={(value) => setFormData({ ...formData, claimedAmount: value.replace(/[^0-9]/g, '') })}
        disabled={state !== 'idle' && state !== 'error'}
        error={errors.claimedAmount}
      />

      <Input
        label="Minimum Date"
        type="date"
        value={formData.minDate}
        onChange={(value) => setFormData({ ...formData, minDate: value })}
        disabled={state !== 'idle' && state !== 'error'}
        error={errors.minDate}
      />

      {(state === 'fetching' || state === 'validating' || state === 'generating') && (
        <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4 text-sm text-blue-300">
          {getStateMessage()}
        </div>
      )}

      {state === 'success' && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-sm text-green-400">
          {getStateMessage()}
        </div>
      )}

      {state === 'error' && (
        <div className="space-y-3">
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
            {errorMessage}
          </div>
          <Button type="button" onClick={handleRetry} variant="secondary" className="w-full">
            Retry
          </Button>
        </div>
      )}

      {state === 'success' && proofData && (
        <ReceiptSuccess
          proof={proofData.proof}
          chain={proofData.chain}
          claimedAmount={proofData.claimedAmount}
          minDate={proofData.minDate}
        />
      )}

      {(state === 'idle' || state === 'error') && (
        <Button type="submit" variant="primary" className="w-full">
          Generate Receipt
        </Button>
      )}
    </form>
  );
}
