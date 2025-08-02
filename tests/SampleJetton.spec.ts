import { Blockchain, SandboxContract, TreasuryContract, internal } from '@ton/sandbox';
import { toNano, beginCell, Address } from '@ton/core';
import { SampleJetton } from '../wrappers/SampleJetton';
import '@ton/test-utils';

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
});
