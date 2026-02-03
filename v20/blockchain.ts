// [FILE: V13/lib/blockchain.ts]
import { ethers } from 'ethers';

// =================================================================
// CONFIGURATION & CONSTANTS
// =================================================================

// RPC URL for Polygon Mainnet (Use a high-quality provider like Alchemy/Infura in production)
const RPC_URL = process.env.POLYGON_RPC_URL || "https://polygon-rpc.com";

// The Admin Private Key (Server-Side Only). MUST have MATIC for gas fees.
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;

// The Deployed Escrow Smart Contract Address
const ESCROW_CONTRACT_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS;

// Polygon USDT Contract Address (Mainnet)
const USDT_CONTRACT_ADDRESS = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";

// Standard ERC20 ABI (Minimal required functions)
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint amount) returns (boolean)"
];

// Custom Escrow Contract ABI (Matches the solidity contract)
const ESCROW_ABI = [
  "function projects(string) view returns (uint256 totalBudget, uint256 lockedAmount, address client, address freelancer, bool isFunded)",
  "function release(string projectId, uint256 amount) external",
  "function refund(string projectId) external",
  "function deposit(string projectId, address freelancer, uint256 amount) external"
];

// =================================================================
// INITIALIZATION
// =================================================================

if (!ADMIN_PRIVATE_KEY) {
    console.error("CRITICAL: ADMIN_PRIVATE_KEY is not set in .env.local");
}
if (!ESCROW_CONTRACT_ADDRESS) {
    console.error("CRITICAL: ESCROW_CONTRACT_ADDRESS is not set in .env.local");
}

// Singleton Provider Instance
const provider = new ethers.JsonRpcProvider(RPC_URL);

// Admin Wallet Instance (Signer)
const adminWallet = ADMIN_PRIVATE_KEY 
    ? new ethers.Wallet(ADMIN_PRIVATE_KEY, provider) 
    : null;

// Escrow Contract Instance (Read/Write)
const escrowContract = (ESCROW_CONTRACT_ADDRESS && adminWallet)
    ? new ethers.Contract(ESCROW_CONTRACT_ADDRESS, ESCROW_ABI, adminWallet)
    : null;

// =================================================================
// BLOCKCHAIN FUNCTIONS
// =================================================================

/**
 * 1. Check Real Escrow Balance
 * Queries the Smart Contract to see how much is strictly locked for a specific project.
 * * @param projectId - The internal UUID of the project
 * @returns number - The locked amount in USDT (Float)
 */
export const checkRealEscrowBalance = async (projectId: string): Promise<number> => {
  try {
    if (!escrowContract) throw new Error("Escrow Contract not initialized");

    // Query the mapping: projects(projectId)
    // Returns: [totalBudget, lockedAmount, client, freelancer, isFunded]
    const projectData = await escrowContract.projects(projectId);
    
    // We are interested in the 'lockedAmount' (index 1)
    // USDT has 6 decimals on Polygon
    const lockedAmountWei = projectData[1];
    const lockedAmountUSDT = parseFloat(ethers.formatUnits(lockedAmountWei, 6));

    console.log(`[Blockchain] Checked Balance for ${projectId}: ${lockedAmountUSDT} USDT`);
    return lockedAmountUSDT;

  } catch (error: any) {
    console.error("[Blockchain] checkRealEscrowBalance Error:", error);
    // Return 0 so the UI simply says "Not Funded" rather than crashing
    return 0; 
  }
};

/**
 * 2. Release Funds (Milestone Payout)
 * Triggers the 'release' function on the Smart Contract.
 * Only the Admin Wallet (owner) or the Client can call this, but here we use Admin as the relayer.
 * * @param projectId - The project UUID
 * @param amount - Amount to release in USDT
 * @returns Transaction Receipt
 */
export const releaseOnChain = async (projectId: string, amount: number) => {
    try {
        if (!escrowContract) throw new Error("Escrow Contract not initialized");

        console.log(`[Blockchain] Initiating Release: ${amount} USDT for ${projectId}`);

        // Convert amount to Wei (6 decimals for USDT)
        const amountWei = ethers.parseUnits(amount.toString(), 6);

        // Send Transaction
        // Note: The Admin Wallet pays the GAS for this transaction.
        const tx = await escrowContract.release(projectId, amountWei);
        
        console.log(`[Blockchain] Transaction Sent: ${tx.hash}. Waiting for confirmation...`);

        // Wait for 1 block confirmation
        const receipt = await tx.wait(1);

        console.log(`[Blockchain] Transaction Confirmed: Block ${receipt.blockNumber}`);
        return { success: true, txHash: receipt.hash };

    } catch (error: any) {
        console.error("[Blockchain] releaseOnChain Error:", error);
        throw new Error("Blockchain Release Failed: " + (error.reason || error.message));
    }
};

/**
 * 3. Refund Funds (Admin Override/Cancellation)
 * Returns the remaining locked funds to the Client.
 * * @param projectId - The project UUID
 */
export const refundOnChain = async (projectId: string) => {
    try {
        if (!escrowContract) throw new Error("Escrow Contract not initialized");

        console.log(`[Blockchain] Initiating Refund for ${projectId}`);

        const tx = await escrowContract.refund(projectId);
        const receipt = await tx.wait(1);

        return { success: true, txHash: receipt.hash };

    } catch (error: any) {
        console.error("[Blockchain] refundOnChain Error:", error);
        throw new Error("Blockchain Refund Failed: " + (error.reason || error.message));
    }
};

/**
 * 4. Verify Generic Transaction (Utility)
 * Checks if a txHash exists and is successful.
 */
export const verifyTransactionOnChain = async (txHash: string) => {
    try {
        const tx = await provider.getTransaction(txHash);
        const receipt = await provider.getTransactionReceipt(txHash);

        if (!tx || !receipt) return { valid: false, reason: "Transaction not found" };
        if (receipt.status !== 1) return { valid: false, reason: "Transaction failed on-chain" };

        return { valid: true, blockNumber: receipt.blockNumber };
    } catch (error: any) {
        return { valid: false, reason: error.message };
    }
}