/**
 * Communication Graph Builder
 * Builds communication and interaction graphs between contracts
 * Focuses on actual runtime interactions rather than code structure
 */

import {
    FetchedContract,
    ContractNode,
    ContractEdge,
    ABIItem,
    RelationshipType
} from './types';
import {
    extractFunctionSignatures,
    extractEventSignatures,
    extractCallableFunctions,
    extractStateChangingFunctions
} from './abiExtractor';

/**
 * Communication pattern types
 */
export type CommunicationPattern = 
    | 'token_transfer'      // ERC20/721/1155 transfers
    | 'token_approval'      // Token approvals
    | 'swap'                // DEX swaps
    | 'liquidity'           // Add/remove liquidity
    | 'stake'               // Staking operations
    | 'governance'          // Governance voting
    | 'oracle'              // Oracle price feeds
    | 'bridge'              // Cross-chain bridge
    | 'lending'             // Lending/borrowing
    | 'nft_mint'            // NFT minting
    | 'callback'            // Callback functions
    | 'flash_loan'          // Flash loans
    | 'generic_call';       // Generic external calls

/**
 * Communication edge with detailed information
 */
export interface CommunicationEdge {
    source: string;
    target: string;
    pattern: CommunicationPattern;
    functions: string[];
    events: string[];
    bidirectional: boolean;
    frequency?: 'high' | 'medium' | 'low';
}

/**
 * Communication graph
 */
export interface CommunicationGraph {
    nodes: CommunicationNode[];
    edges: CommunicationEdge[];
    patterns: Record<CommunicationPattern, number>;
    metadata: {
        generatedAt: string;
        totalContracts: number;
        totalCommunications: number;
    };
}

/**
 * Communication node with role information
 */
export interface CommunicationNode {
    address: string;
    contractName: string;
    protocol: string;
    blockchain: string;
    role: ContractRole;
    communicationCount: number;
    inboundCount: number;
    outboundCount: number;
}

/**
 * Contract roles in the ecosystem
 */
export type ContractRole = 
    | 'token'
    | 'dex'
    | 'lending'
    | 'vault'
    | 'governance'
    | 'oracle'
    | 'bridge'
    | 'router'
    | 'factory'
    | 'proxy'
    | 'multisig'
    | 'unknown';

/**
 * Communication Graph Builder
 */
export class CommunicationGraphBuilder {
    private nodes: Map<string, CommunicationNode> = new Map();
    private edges: CommunicationEdge[] = [];
    private addressToContract: Map<string, FetchedContract> = new Map();
    
    /**
     * Add contracts to analyze
     */
    addContracts(contracts: FetchedContract[]): void {
        // Index contracts
        for (const contract of contracts) {
            this.addressToContract.set(contract.address.toLowerCase(), contract);
        }
        
        // Build nodes with role detection
        for (const contract of contracts) {
            const node = this.buildNode(contract);
            this.nodes.set(contract.address.toLowerCase(), node);
        }
        
        // Analyze communications
        for (const contract of contracts) {
            this.analyzeCommunications(contract);
        }
        
        // Update communication counts
        this.updateCommunicationCounts();
    }
    
    /**
     * Build a communication node
     */
    private buildNode(contract: FetchedContract): CommunicationNode {
        return {
            address: contract.address,
            contractName: contract.contractName,
            protocol: contract.protocol,
            blockchain: contract.blockchain,
            role: this.detectContractRole(contract),
            communicationCount: 0,
            inboundCount: 0,
            outboundCount: 0
        };
    }
    
    /**
     * Detect the role of a contract based on its ABI and name
     */
    private detectContractRole(contract: FetchedContract): ContractRole {
        const abi = contract.abi || [];
        const name = contract.contractName.toLowerCase();
        const functionNames = new Set(abi.filter(i => i.type === 'function').map(i => i.name?.toLowerCase()));
        
        // Token detection
        if (this.hasERC20Functions(functionNames) || name.includes('token')) {
            return 'token';
        }
        
        // DEX detection
        if (this.hasDEXFunctions(functionNames) || name.includes('swap') || name.includes('router')) {
            return 'dex';
        }
        
        // Router detection
        if (name.includes('router')) {
            return 'router';
        }
        
        // Factory detection
        if (functionNames.has('createpair') || functionNames.has('createpool') || name.includes('factory')) {
            return 'factory';
        }
        
        // Lending detection
        if (this.hasLendingFunctions(functionNames) || name.includes('lend') || name.includes('borrow')) {
            return 'lending';
        }
        
        // Vault detection
        if (functionNames.has('deposit') && functionNames.has('withdraw') && name.includes('vault')) {
            return 'vault';
        }
        
        // Governance detection
        if (this.hasGovernanceFunctions(functionNames) || name.includes('governance') || name.includes('governor')) {
            return 'governance';
        }
        
        // Oracle detection
        if (functionNames.has('latestanswer') || functionNames.has('getprice') || name.includes('oracle')) {
            return 'oracle';
        }
        
        // Bridge detection
        if (name.includes('bridge') || functionNames.has('sendmessage') || functionNames.has('receivemessage')) {
            return 'bridge';
        }
        
        // Proxy detection
        if (functionNames.has('implementation') || functionNames.has('upgradeto')) {
            return 'proxy';
        }
        
        // Multisig detection
        if (functionNames.has('submittransaction') || functionNames.has('confirmtransaction') || name.includes('multisig')) {
            return 'multisig';
        }
        
        return 'unknown';
    }
    
    /**
     * Check for ERC20 functions
     */
    private hasERC20Functions(functions: Set<string | undefined>): boolean {
        return functions.has('transfer') && functions.has('approve') && functions.has('balanceof');
    }
    
    /**
     * Check for DEX functions
     */
    private hasDEXFunctions(functions: Set<string | undefined>): boolean {
        return functions.has('swap') || 
               functions.has('swapexacttokensfortokens') || 
               functions.has('addliquidity') ||
               functions.has('removeliquidity');
    }
    
    /**
     * Check for lending functions
     */
    private hasLendingFunctions(functions: Set<string | undefined>): boolean {
        return functions.has('borrow') || 
               functions.has('repay') || 
               functions.has('liquidate') ||
               (functions.has('supply') && functions.has('withdraw'));
    }
    
    /**
     * Check for governance functions
     */
    private hasGovernanceFunctions(functions: Set<string | undefined>): boolean {
        return functions.has('propose') || 
               functions.has('castvote') || 
               functions.has('queue') ||
               functions.has('execute');
    }
    
    /**
     * Analyze communications for a contract
     */
    private analyzeCommunications(contract: FetchedContract): void {
        const sourceCode = contract.sources.map(s => s.content).join('\n');
        const contractAddress = contract.address.toLowerCase();
        const abi = contract.abi || [];
        
        // Find referenced addresses using matchAll for better performance
        const addressPattern = /0x[a-fA-F0-9]{40}/g;
        const referencedAddresses = new Set<string>();
        const matches = sourceCode.matchAll(addressPattern);
        
        for (const match of matches) {
            const address = match[0].toLowerCase();
            if (address !== contractAddress && this.nodes.has(address)) {
                referencedAddresses.add(address);
            }
        }
        
        // Analyze each referenced address
        for (const targetAddress of referencedAddresses) {
            const targetContract = this.addressToContract.get(targetAddress);
            if (targetContract) {
                const pattern = this.detectCommunicationPattern(contract, targetContract, sourceCode);
                const functions = this.findRelatedFunctions(contract, targetContract, sourceCode);
                const events = this.findRelatedEvents(contract, targetContract);
                
                this.addEdge({
                    source: contractAddress,
                    target: targetAddress,
                    pattern,
                    functions,
                    events,
                    bidirectional: this.checkBidirectional(contractAddress, targetAddress)
                });
            }
        }
        
        // Analyze by function patterns
        this.analyzeByFunctionPatterns(contract);
    }
    
    /**
     * Detect communication pattern between contracts
     */
    private detectCommunicationPattern(source: FetchedContract, target: FetchedContract, sourceCode: string): CommunicationPattern {
        const targetName = target.contractName.toLowerCase();
        const targetRole = this.detectContractRole(target);
        
        // Token operations
        if (targetRole === 'token') {
            if (sourceCode.includes('.transfer(') || sourceCode.includes('.transferFrom(')) {
                return 'token_transfer';
            }
            if (sourceCode.includes('.approve(')) {
                return 'token_approval';
            }
        }
        
        // DEX operations
        if (targetRole === 'dex' || targetRole === 'router') {
            if (sourceCode.includes('swap') || sourceCode.includes('Swap')) {
                return 'swap';
            }
            if (sourceCode.includes('addLiquidity') || sourceCode.includes('removeLiquidity')) {
                return 'liquidity';
            }
        }
        
        // Lending operations
        if (targetRole === 'lending') {
            return 'lending';
        }
        
        // Oracle operations
        if (targetRole === 'oracle') {
            return 'oracle';
        }
        
        // Bridge operations
        if (targetRole === 'bridge') {
            return 'bridge';
        }
        
        // Governance operations
        if (targetRole === 'governance') {
            return 'governance';
        }
        
        // Callback detection
        if (sourceCode.includes('Callback') || sourceCode.includes('callback')) {
            return 'callback';
        }
        
        // Flash loan detection
        if (sourceCode.includes('flashLoan') || sourceCode.includes('FlashLoan')) {
            return 'flash_loan';
        }
        
        return 'generic_call';
    }
    
    /**
     * Find related functions between contracts
     */
    private findRelatedFunctions(source: FetchedContract, target: FetchedContract, sourceCode: string): string[] {
        const targetAbi = target.abi || [];
        const targetFunctions = targetAbi
            .filter(i => i.type === 'function' && i.name)
            .map(i => i.name as string);
        
        const usedFunctions: string[] = [];
        
        for (const fn of targetFunctions) {
            // Check if function is called in source code
            if (sourceCode.includes(`.${fn}(`) || sourceCode.includes(`${fn}(`)) {
                usedFunctions.push(fn);
            }
        }
        
        return usedFunctions;
    }
    
    /**
     * Find related events
     */
    private findRelatedEvents(source: FetchedContract, target: FetchedContract): string[] {
        const sourceAbi = source.abi || [];
        return sourceAbi
            .filter(i => i.type === 'event' && i.name)
            .map(i => i.name as string)
            .slice(0, 10); // Limit to 10 events
    }
    
    /**
     * Check if communication is bidirectional
     */
    private checkBidirectional(address1: string, address2: string): boolean {
        return this.edges.some(e => e.source === address2 && e.target === address1);
    }
    
    /**
     * Analyze communications by function patterns
     */
    private analyzeByFunctionPatterns(contract: FetchedContract): void {
        const abi = contract.abi || [];
        const contractAddress = contract.address.toLowerCase();
        
        // Look for callback functions that indicate inbound communications
        const callbacks = abi.filter(i => 
            i.type === 'function' && 
            i.name && 
            (i.name.toLowerCase().includes('callback') || 
             i.name.toLowerCase().includes('onreceive') ||
             i.name.toLowerCase().includes('hook'))
        );
        
        // These indicate the contract receives calls from other contracts
        // Mark as potential inbound communication
    }
    
    /**
     * Add an edge
     */
    private addEdge(edge: CommunicationEdge): void {
        // Check for duplicate
        const exists = this.edges.some(e => 
            e.source === edge.source && 
            e.target === edge.target && 
            e.pattern === edge.pattern
        );
        
        if (!exists) {
            this.edges.push(edge);
        }
    }
    
    /**
     * Update communication counts for all nodes
     */
    private updateCommunicationCounts(): void {
        for (const node of this.nodes.values()) {
            node.outboundCount = this.edges.filter(e => e.source === node.address.toLowerCase()).length;
            node.inboundCount = this.edges.filter(e => e.target === node.address.toLowerCase()).length;
            node.communicationCount = node.outboundCount + node.inboundCount;
        }
    }
    
    /**
     * Build the final communication graph
     */
    build(): CommunicationGraph {
        const patterns: Record<CommunicationPattern, number> = {
            token_transfer: 0,
            token_approval: 0,
            swap: 0,
            liquidity: 0,
            stake: 0,
            governance: 0,
            oracle: 0,
            bridge: 0,
            lending: 0,
            nft_mint: 0,
            callback: 0,
            flash_loan: 0,
            generic_call: 0
        };
        
        for (const edge of this.edges) {
            patterns[edge.pattern]++;
        }
        
        return {
            nodes: Array.from(this.nodes.values()),
            edges: this.edges,
            patterns,
            metadata: {
                generatedAt: new Date().toISOString(),
                totalContracts: this.nodes.size,
                totalCommunications: this.edges.length
            }
        };
    }
    
    /**
     * Get hub contracts (most connections)
     */
    getHubs(limit: number = 10): CommunicationNode[] {
        return Array.from(this.nodes.values())
            .sort((a, b) => b.communicationCount - a.communicationCount)
            .slice(0, limit);
    }
    
    /**
     * Get contracts by role
     */
    getContractsByRole(role: ContractRole): CommunicationNode[] {
        return Array.from(this.nodes.values()).filter(n => n.role === role);
    }
    
    /**
     * Export to JSON
     */
    toJSON(): string {
        return JSON.stringify(this.build(), null, 2);
    }
    
    /**
     * Export to D3.js force-directed graph format
     */
    toD3Format(): {
        nodes: Array<{ id: string; group: string; role: string; size: number }>;
        links: Array<{ source: string; target: string; pattern: string; value: number }>;
    } {
        const graph = this.build();
        
        return {
            nodes: graph.nodes.map(n => ({
                id: n.address,
                group: n.protocol,
                role: n.role,
                size: n.communicationCount + 1
            })),
            links: graph.edges.map(e => ({
                source: e.source,
                target: e.target,
                pattern: e.pattern,
                value: e.functions.length + 1
            }))
        };
    }
}

/**
 * Build a communication graph from fetched contracts
 */
export function buildCommunicationGraph(contracts: FetchedContract[]): CommunicationGraph {
    const builder = new CommunicationGraphBuilder();
    builder.addContracts(contracts);
    return builder.build();
}
