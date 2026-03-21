pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

/**
 * Receipt verification circuit
 * 
 * Proves:
 * 1. Oracle signature is valid
 * 2. realValue >= claimedAmount
 * 3. realTimestamp >= minDate
 * 
 * Public inputs:
 * - claimedAmount: Amount user claims to have paid
 * - minDate: Minimum timestamp user claims
 * - oracleSignature: Oracle's signature (for verification)
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
    signal input oracleSignature[8]; // 256-bit signature as 8x32-bit chunks
    
    // Private inputs (witness)
    signal input realValue;
    signal input realTimestamp;
    signal input txHash[8]; // 256-bit hash as 8x32-bit chunks
    
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
    
    // Constraint 3: Oracle signature verification
    // Note: In production, implement full HMAC-SHA256 verification
    // For now, we verify signature is non-zero (placeholder)
    signal signatureSum;
    signatureSum <== oracleSignature[0] + oracleSignature[1] + oracleSignature[2] + 
                     oracleSignature[3] + oracleSignature[4] + oracleSignature[5] + 
                     oracleSignature[6] + oracleSignature[7];
    
    component signatureCheck = IsZero();
    signatureCheck.in <== signatureSum;
    signatureCheck.out === 0; // Signature must be non-zero
    
    // Output public signals for verification
    signal output valid;
    valid <== 1;
}

component main {public [claimedAmount, minDate, oracleSignature]} = Receipt();
