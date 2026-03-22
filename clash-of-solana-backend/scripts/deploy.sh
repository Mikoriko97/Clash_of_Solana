#!/bin/bash
# Deploy all Anchor programs to Solana devnet
# Run from project root: bash scripts/deploy.sh

set -e

echo "🔨 Building all programs..."
anchor build

echo "📡 Deploying to devnet..."
anchor deploy --provider.cluster devnet

echo "✅ All programs deployed!"
echo "Don't forget to update Program IDs in:"
echo "  - Anchor.toml"
echo "  - packages/sdk/src/constants.ts"
echo "  - Each programs/*/src/lib.rs declare_id!()"
