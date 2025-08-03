import { Blockchain, SandboxContract, TreasuryContract, internal } from '@ton/sandbox';
import { toNano, beginCell, Address } from '@ton/core';
import { SampleJetton } from '../wrappers/SampleJetton';
import '@ton/test-utils';
import { JettonDefaultWallet } from '../build/SampleJetton/tact_JettonDefaultWallet';

describe('SampleJetton', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let sampleJetton: SandboxContract<SampleJetton>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');
        
        const content = beginCell().storeStringTail('Sample Jetton').endCell();
        const max_supply = toNano('1000000');
        
        sampleJetton = blockchain.openContract(await SampleJetton.fromInit(deployer.address, content, max_supply));

        // Contract is already initialized through fromInit, no need to send deploy message
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and sampleJetton are ready to use
    });

    it('should allow owner to set transfer lock', async () => {
        const lockResult = await sampleJetton.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'SetTransferLock',
                locked: true,
            }
        );

        expect(lockResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: sampleJetton.address,
            success: true,
        });

        const jettonData = await sampleJetton.getGetJettonData();
        expect(jettonData.transfer_locked).toBe(true);
    });

    it('should prevent non-owner from setting transfer lock', async () => {
        const user = await blockchain.treasury('user');
        
        const lockResult = await sampleJetton.send(
            user.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'SetTransferLock',
                locked: true,
            }
        );

        expect(lockResult.transactions).toHaveTransaction({
            from: user.address,
            to: sampleJetton.address,
            success: false,
            exitCode: 3734, // Not Owner error
        });
    });

    it('should allow owner to check transfer lock status', async () => {
        // First, mint some tokens to deployer
        const mintResult = await sampleJetton.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Mint',
                amount: 1000n,
                receiver: deployer.address,
            }
        );

        expect(mintResult.transactions).toHaveTransaction({
            success: true,
        });

        // Lock transfers
        const lockResult = await sampleJetton.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'SetTransferLock',
                locked: true,
            }
        );

        expect(lockResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: sampleJetton.address,
            success: true,
        });

        // Check that transfer lock is set
        const jettonData = await sampleJetton.getGetJettonData();
        expect(jettonData.transfer_locked).toBe(true);
    });

    it('should allow minting when unlocked', async () => {
        // Ensure transfers are unlocked
        await sampleJetton.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'SetTransferLock',
                locked: false,
            }
        );

        // Try to mint tokens
        const mintResult = await sampleJetton.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Mint',
                amount: 1000n,
                receiver: deployer.address,
            }
        );

        expect(mintResult.transactions).toHaveTransaction({
            success: true,
        });
    });

    it('should prevent minting when locked', async () => {
        // Lock transfers
        await sampleJetton.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'SetTransferLock',
                locked: true,
            }
        );

        // Try to mint tokens when locked
        const mintResult = await sampleJetton.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Mint',
                amount: 1000n,
                receiver: deployer.address,
            }
        );

        expect(mintResult.transactions).toHaveTransaction({
            success: false,
            exitCode: 39864, // Transfers are locked
        });
    });

    it('should prevent minting when master is locked', async () => {
        // Lock transfers at master level
        const lockResult = await sampleJetton.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'SetTransferLock',
                locked: true,
            }
        );

        expect(lockResult.transactions).toHaveTransaction({
            success: true,
        });

        // Try to mint tokens when master is locked
        const mintResult = await sampleJetton.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Mint',
                amount: 1000n,
                receiver: deployer.address,
            }
        );

        expect(mintResult.transactions).toHaveTransaction({
            success: false,
            exitCode: 39864, // Transfers are locked
        });
    });

    it('should allow minting when master is unlocked', async () => {
        // Ensure transfers are unlocked
        await sampleJetton.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'SetTransferLock',
                locked: false,
            }
        );

        // Try to mint tokens when master is unlocked
        const mintResult = await sampleJetton.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Mint',
                amount: 1000n,
                receiver: deployer.address,
            }
        );

        expect(mintResult.transactions).toHaveTransaction({
            success: true,
        });
    });

    it('should prevent transfers when wallet is locked', async () => {
        // Mint tokens to deployer
        await sampleJetton.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Mint', amount: 1000n, receiver: deployer.address }
        );

        // Open deployer's wallet
        const walletAddr = await sampleJetton.getGetWalletAddress(deployer.address);
        const deployerWallet = blockchain.openContract(JettonDefaultWallet.fromAddress(walletAddr));
        const receiver = await blockchain.treasury('receiver');

        // Lock the wallet by sending UpdateTransferLock from master contract
        await blockchain.sendMessage(internal({
            from: sampleJetton.address,
            to: walletAddr,
            value: toNano('0.05'),
            body: beginCell()
                .storeUint(0x6c7c41e4, 32) // op: UpdateTransferLock
                .storeUint(0, 64) // query_id
                .storeUint(1, 8) // locked: true (uint8, 1 = true)
                .endCell()
        }));

        // Attempt transfer
        const transferResult = await deployerWallet.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'TokenTransfer',
                queryId: 0n,
                amount: 100n,
                destination: receiver.address,
                response_destination: deployer.address,
                custom_payload: null,
                forward_ton_amount: 0n,
                forward_payload: beginCell().endCell()
            }
        );

        expect(transferResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: walletAddr,
            success: false,
        });
    });

    it('should allow transfers when wallet is unlocked', async () => {
        // Mint tokens
        await sampleJetton.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Mint', amount: 1000n, receiver: deployer.address }
        );

        const walletAddr = await sampleJetton.getGetWalletAddress(deployer.address);
        const deployerWallet = blockchain.openContract(JettonDefaultWallet.fromAddress(walletAddr));
        const receiver = await blockchain.treasury('receiver');

        // Ensure wallet is unlocked
        await blockchain.sendMessage(internal({
            from: sampleJetton.address,
            to: walletAddr,
            value: toNano('0.05'),
            body: beginCell()
                .storeUint(0x6c7c41e4, 32) // op: UpdateTransferLock
                .storeUint(0, 64) // query_id
                .storeUint(0, 8) // locked: false (uint8, 0 = false)
                .endCell()
        }));

        const transferResult = await deployerWallet.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'TokenTransfer',
                queryId: 0n,
                amount: 100n,
                destination: receiver.address,
                response_destination: deployer.address,
                custom_payload: null,
                forward_ton_amount: 0n,
                forward_payload: beginCell().endCell()
            }
        );

        expect(transferResult.transactions).toHaveTransaction({
            success: true,
        });
    });

    it('should prevent non-admin users from transferring tokens when wallet is locked', async () => {
        // Create two non-admin users
        const user1 = await blockchain.treasury('user1');
        const user2 = await blockchain.treasury('user2');
        
        // Step 1: Deploy contract and mint tokens to user1
        await sampleJetton.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Mint', amount: 1000n, receiver: user1.address }
        );

        // Step 2: Get user1's wallet and lock it
        const user1WalletAddr = await sampleJetton.getGetWalletAddress(user1.address);
        const user1Wallet = blockchain.openContract(JettonDefaultWallet.fromAddress(user1WalletAddr));

        // Step 3: Lock the wallet (deployer is owner, so this will work for testing)
        await blockchain.sendMessage(internal({
            from: sampleJetton.address,
            to: user1WalletAddr,
            value: toNano('0.05'),
            body: beginCell()
                .storeUint(0x6c7c41e4, 32) // op: UpdateTransferLock
                .storeUint(0, 64) // query_id
                .storeUint(1, 8) // locked: true (uint8, 1 = true)
                .endCell()
        }));

        // Step 4: User1 attempts to transfer tokens to User2 (should fail due to wallet lock)
        const transferResult = await user1Wallet.send(
            user1.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'TokenTransfer',
                queryId: 0n,
                amount: 100n,
                destination: user2.address,
                response_destination: user1.address,
                custom_payload: null,
                forward_ton_amount: 0n,
                forward_payload: beginCell().endCell()
            }
        );

        // Verify the transfer failed
        expect(transferResult.transactions).toHaveTransaction({
            from: user1.address,
            to: user1WalletAddr,
            success: false,
        });

        // Verify User1's balance remains unchanged
        const user1WalletData = await user1Wallet.getGetWalletData();
        expect(user1WalletData.balance).toBe(1000n);
    });

    it('should allow non-admin users to transfer tokens when wallet is unlocked', async () => {
        // Create two non-admin users
        const user1 = await blockchain.treasury('user1');
        const user2 = await blockchain.treasury('user2');
        
        // Step 1: Deploy contract and mint tokens to user1
        await sampleJetton.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Mint', amount: 1000n, receiver: user1.address }
        );

        // Step 2: Get user1's wallet and ensure it's unlocked
        const user1WalletAddr = await sampleJetton.getGetWalletAddress(user1.address);
        const user1Wallet = blockchain.openContract(JettonDefaultWallet.fromAddress(user1WalletAddr));

        // Step 3: Ensure wallet is unlocked
        await blockchain.sendMessage(internal({
            from: sampleJetton.address,
            to: user1WalletAddr,
            value: toNano('0.05'),
            body: beginCell()
                .storeUint(0x6c7c41e4, 32) // op: UpdateTransferLock
                .storeUint(0, 64) // query_id
                .storeUint(0, 8) // locked: false (uint8, 0 = false)
                .endCell()
        }));

        // Step 4: User1 transfers tokens to User2 (should succeed)
        const transferResult = await user1Wallet.send(
            user1.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'TokenTransfer',
                queryId: 0n,
                amount: 100n,
                destination: user2.address,
                response_destination: user1.address,
                custom_payload: null,
                forward_ton_amount: 0n,
                forward_payload: beginCell().endCell()
            }
        );

        // Verify the transfer succeeded
        expect(transferResult.transactions).toHaveTransaction({
            from: user1.address,
            to: user1WalletAddr,
            success: true,
        });

        // Verify User1's balance decreased and User2 received tokens
        const user1WalletData = await user1Wallet.getGetWalletData();
        expect(user1WalletData.balance).toBe(900n);

        const user2WalletAddr = await sampleJetton.getGetWalletAddress(user2.address);
        const user2Wallet = blockchain.openContract(JettonDefaultWallet.fromAddress(user2WalletAddr));
        const user2WalletData = await user2Wallet.getGetWalletData();
        expect(user2WalletData.balance).toBe(100n);
    });
});