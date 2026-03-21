#!/bin/bash

# Circuit compilation script for receipt.circom
# Requires: circom, snarkjs

set -e

CIRCUIT_NAME="receipt"
CIRCUIT_DIR="circuits"
BUILD_DIR="public/zk"
PTAU_FILE="powersOfTau28_hez_final_14.ptau"

echo "🔧 Compiling circuit: $CIRCUIT_NAME"

# Create build directory
mkdir -p $BUILD_DIR

# Step 1: Compile circuit
echo "📝 Step 1: Compiling circuit to R1CS..."
circom $CIRCUIT_DIR/$CIRCUIT_NAME.circom \
  --r1cs \
  --wasm \
  --sym \
  -o $BUILD_DIR

# Step 2: Generate witness calculator
echo "📝 Step 2: Generating witness calculator..."
# WASM is already generated in step 1

# Step 3: Download Powers of Tau (if not exists)
if [ ! -f "$BUILD_DIR/$PTAU_FILE" ]; then
  echo "📥 Step 3: Downloading Powers of Tau..."
  wget -P $BUILD_DIR https://hermez.s3-eu-west-1.amazonaws.com/$PTAU_FILE
else
  echo "✅ Step 3: Powers of Tau already exists"
fi

# Step 4: Generate zkey (proving key)
echo "🔑 Step 4: Generating proving key..."
snarkjs groth16 setup \
  $BUILD_DIR/$CIRCUIT_NAME.r1cs \
  $BUILD_DIR/$PTAU_FILE \
  $BUILD_DIR/${CIRCUIT_NAME}_0000.zkey

# Step 5: Contribute to phase 2 ceremony
echo "🎲 Step 5: Contributing to phase 2 ceremony..."
snarkjs zkey contribute \
  $BUILD_DIR/${CIRCUIT_NAME}_0000.zkey \
  $BUILD_DIR/${CIRCUIT_NAME}_final.zkey \
  --name="First contribution" \
  -v \
  -e="$(openssl rand -hex 32)"

# Step 6: Export verification key
echo "📤 Step 6: Exporting verification key..."
snarkjs zkey export verificationkey \
  $BUILD_DIR/${CIRCUIT_NAME}_final.zkey \
  $BUILD_DIR/verification_key.json

# Step 7: Generate Solidity verifier (optional, for on-chain verification)
echo "📜 Step 7: Generating Solidity verifier..."
snarkjs zkey export solidityverifier \
  $BUILD_DIR/${CIRCUIT_NAME}_final.zkey \
  $BUILD_DIR/Verifier.sol

# Cleanup intermediate files
echo "🧹 Cleaning up..."
rm -f $BUILD_DIR/${CIRCUIT_NAME}_0000.zkey
rm -f $BUILD_DIR/$PTAU_FILE

echo "✅ Circuit compilation complete!"
echo ""
echo "Generated files:"
echo "  - $BUILD_DIR/$CIRCUIT_NAME.wasm (witness calculator)"
echo "  - $BUILD_DIR/${CIRCUIT_NAME}_final.zkey (proving key)"
echo "  - $BUILD_DIR/verification_key.json (verification key)"
echo "  - $BUILD_DIR/Verifier.sol (Solidity verifier)"
echo ""
echo "Circuit info:"
snarkjs r1cs info $BUILD_DIR/$CIRCUIT_NAME.r1cs
