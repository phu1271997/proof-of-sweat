#!/usr/bin/env node
/**
 * deploy_studio_next.js
 *
 * Deploys the Proof of Sweat intelligent contract to GenLayer Studio Next (Chain ID 61997)
 * using the keystore private key from ~/.genlayer/env.sh (GENLAYER_PRIVATE_KEY).
 *
 * Usage:
 *   source ~/.genlayer/env.sh
 *   node scripts/deploy/deploy_studio_next.js
 */

const fs = require('fs');
const path = require('path');
const { createClient, createAccount } = require(path.resolve(__dirname, '../../frontend/node_modules/genlayer-js'));
const { studioDevnet } = require(path.resolve(__dirname, '../../frontend/node_modules/genlayer-js/dist/chains/index.cjs'));

let key = process.env.GENLAYER_PRIVATE_KEY || '';
if (!key) {
  console.error('Error: GENLAYER_PRIVATE_KEY is not set. Run: source ~/.genlayer/env.sh');
  process.exit(1);
}
if (!key.startsWith('0x')) key = '0x' + key;

const studioNext = {
  ...studioDevnet,
  id: 61997,
  name: 'GenLayer Studio Next',
  rpcUrls: {
    default: { http: ['https://studio-next.genlayer.com/api'] },
    public: { http: ['https://studio-next.genlayer.com/api'] },
  },
  blockExplorers: {
    default: { name: 'GenLayer Studio Next Explorer', url: 'https://explorer-studio-dev.genlayer.com' },
  },
};

const account = createAccount(key);
const client = createClient({ chain: studioNext, account });

async function main() {
  console.log('--- GenLayer Studio Next Deployment ---');
  console.log('Deployer address:', account.address);
  console.log('Chain ID:', studioNext.id);
  console.log('RPC Endpoint:', studioNext.rpcUrls.default.http[0]);

  const contractPath = path.resolve(__dirname, '../../contracts/proof_of_sweat_studio_next.py');
  console.log('Reading contract from:', contractPath);
  const code = fs.readFileSync(contractPath, 'utf8');

  console.log('Estimating transaction fees for Studio Next (Consensus v0.6)...');
  const fees = await client.estimateTransactionFees({});
  console.log('Fees estimated successfully.');

  console.log('Submitting deployContract transaction...');
  const hash = await client.deployContract({ code, args: [], fees });
  console.log('Deploy Tx Hash:', hash);
  console.log('Explorer Tx Link: https://explorer-studio-dev.genlayer.com/tx/' + hash);

  console.log('Waiting for consensus across validators...');
  const rcpt = await client.waitForTransactionReceipt({
    hash,
    waitUntil: 'decided',
    interval: 3000,
    retries: 60,
  });

  console.log('Transaction Status:', rcpt.status, '| Execution Result:', rcpt.txExecutionResultName);
  const contractAddress = rcpt.contractAddress || rcpt.data?.contract_address;

  if (rcpt.txExecutionResultName !== 'FINISHED_WITH_RETURN' || !contractAddress) {
    console.error('Deployment did not finish with return. Inspect tx details:');
    console.error(JSON.stringify(rcpt, null, 2));
    process.exit(1);
  }

  console.log('==================================================');
  console.log('CONTRACT DEPLOYED SUCCESSFULLY!');
  console.log('Contract Address:', contractAddress);
  console.log('Contract Explorer: https://explorer-studio-dev.genlayer.com/address/' + contractAddress);
  console.log('==================================================');

  console.log('Fetching contract schema to verify methods...');
  const schema = await client.getContractSchema(contractAddress);
  console.log('Available contract methods:', Object.keys(schema.methods || {}));
}

main().catch((err) => {
  console.error('Deployment error:', err);
  process.exit(1);
});
