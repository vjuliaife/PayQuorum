#!/bin/bash
# Extract ABIs from Hardhat artifacts into standalone JSON files
# Run from agentmesh/backend: bash src/abi/extract-abis.sh

ARTIFACTS="../contracts/artifacts/contracts"
OUT="src/abi"

for contract in TaskRegistry AgentEscrow Reputation BudgetController; do
  jq '.abi' "$ARTIFACTS/${contract}.sol/${contract}.json" > "$OUT/${contract}.json"
  echo "Extracted $contract ABI -> $OUT/${contract}.json"
done

echo "Done. ABIs ready for import."
