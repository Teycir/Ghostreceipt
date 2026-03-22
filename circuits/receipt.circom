pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

/**
 * Receipt verification circuit
 * 
 * Proves:
 * 1. Oracle commitment matches private tx facts
 * 2. realValue >= claimedAmount
 * 3. realTimestamp >= minDate
 * 
 * Public inputs:
 * - claimedAmount: Amount user claims to have paid
 * - minDate: Minimum timestamp user claims
 * - oracleCommitment: Poseidon commitment over oracle tx facts
 * 
 * Private inputs:
 * - realValue: Actual transaction value (from oracle)
 * - realTimestamp: Actual transaction timestamp (from oracle)
 * - txHash: Transaction hash (kept private)
 */
template Receipt() {
    // Public inputs
    signal input claimedAmount;
    signal input minDate;
    signal input oracleCommitment;
    
    // Private inputs (witness)
    signal input realValue;
    signal input realTimestamp;
    signal input txHash[8]; // 256-bit hash as 8x32-bit chunks
    signal input chainId; // 0 = bitcoin, 1 = ethereum
    
    // Constraint 1: realValue >= claimedAmount
    component valueCheck = GreaterEqThan(252); // 252-bit comparison
    valueCheck.in[0] <== realValue;
    valueCheck.in[1] <== claimedAmount;
    valueCheck.out === 1;
    
    // Constraint 2: realTimestamp >= minDate
    component timestampCheck = GreaterEqThan(64); // Unix timestamp fits in 64 bits
    timestampCheck.in[0] <== realTimestamp;
    timestampCheck.in[1] <== minDate;
    timestampCheck.out === 1;
    
    // Constraint 3: Chain ID must be boolean (0/1)
    chainId * (chainId - 1) === 0;

    // Constraint 4: Oracle commitment must match private tx facts.
    component txHashPoseidon = Poseidon(8);
    for (var i = 0; i < 8; i++) {
        txHashPoseidon.inputs[i] <== txHash[i];
    }

    component oracleCommitmentPoseidon = Poseidon(4);
    oracleCommitmentPoseidon.inputs[0] <== realValue;
    oracleCommitmentPoseidon.inputs[1] <== realTimestamp;
    oracleCommitmentPoseidon.inputs[2] <== txHashPoseidon.out;
    oracleCommitmentPoseidon.inputs[3] <== chainId;
    oracleCommitmentPoseidon.out === oracleCommitment;
    
    // Output public signals for verification
    signal output valid;
    valid <== 1;
}

component main {public [claimedAmount, minDate, oracleCommitment]} = Receipt();
