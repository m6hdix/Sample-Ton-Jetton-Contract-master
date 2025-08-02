import { Address, TonClient, WalletContractV4, beginCell } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { SampleJetton } from "../wrappers/SampleJetton";

// Configuration
const MNEMONIC = "muscle lock elbow muffin voice slow snow doll inner area mechanic aerobic awful nation slim core tobacco swarm pact tornado donate win wish actual"; // Replace with your wallet mnemonic
const CONTRACT_ADDRESS = "kQBQO0INqtYKtgYUW5RhJNLjtAKbuRokvMuowof6vdsoqEFL"; // Replace with your deployed contract address

// Initialize client
const client = new TonClient({
    endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
    apiKey: '0bc1cd188a8f350b0f79145ef2cfa59664e206eb22a965cc22497909bbbc5983' // Optional: get from toncenter.com
});

// Initialize wallet
async function getWallet() {
    const key = await mnemonicToPrivateKey(MNEMONIC.split(" "));
    const wallet = WalletContractV4.create({ publicKey: key.publicKey, workchain: 0 });
    const contract = client.open(wallet);
    return { wallet, contract, key };
}

// Get contract instance
async function getJettonContract() {
    const address = Address.parse(CONTRACT_ADDRESS);
    return client.open(SampleJetton.fromAddress(address));
}

// Lock transfers
export async function lockTransfers() {
    try {
        console.log("🔒 Locking transfers...");
        
        const { contract } = await getWallet();
        const jettonContract = await getJettonContract();
        
        const result = await jettonContract.send(contract.sender({ value: "0.05" }), {
            $$type: 'SetTransferLock',
            locked: true
        });

        console.log("✅ Transfers locked successfully!");
        console.log("Transaction hash:", result.hash.toString('hex'));
        
        return result;
    } catch (error) {
        console.error("❌ Error locking transfers:", error);
        throw error;
    }
}

// Unlock transfers
export async function unlockTransfers() {
    try {
        console.log("🔓 Unlocking transfers...");
        
        const { contract } = await getWallet();
        const jettonContract = await getJettonContract();
        
        const result = await jettonContract.send(contract.sender({ value: "0.05" }), {
            $$type: 'SetTransferLock',
            locked: false
        });

        console.log("✅ Transfers unlocked successfully!");
        console.log("Transaction hash:", result.hash.toString('hex'));
        
        return result;
    } catch (error) {
        console.error("❌ Error unlocking transfers:", error);
        throw error;
    }
}

// Check transfer lock status
export async function getTransferLockStatus() {
    try {
        console.log("🔍 Checking transfer lock status...");
        
        const jettonContract = await getJettonContract();
        const data = await jettonContract.getGetJettonData();
        
        const isLocked = data.transfer_locked;
        console.log(`📊 Transfer lock status: ${isLocked ? "LOCKED" : "UNLOCKED"}`);
        
        return {
            locked: isLocked,
            totalSupply: data.totalSupply,
            mintable: data.mintable,
            owner: data.owner.toString()
        };
    } catch (error) {
        console.error("❌ Error checking lock status:", error);
        throw error;
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
        case 'lock':
            await lockTransfers();
            break;
        case 'unlock':
            await unlockTransfers();
            break;
        case 'status':
            await getTransferLockStatus();
            break;
        default:
            console.log(`
Usage:
  npm run lock     - Lock transfers
  npm run unlock   - Unlock transfers
  npm run status   - Check lock status

Make sure to update MNEMONIC and CONTRACT_ADDRESS in this file first!
            `);
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}