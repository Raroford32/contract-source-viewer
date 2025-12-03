/**
 * Types for automated contract fetching and graph building
 */

/**
 * Contract entry from the JSON files (all_ethereum_contracts.json, cache_bnb.json)
 */
export interface ContractEntry {
    address: string;
    blockchain: string;
    contract_name: string;
    protocol: string;
}

/**
 * Chain ID mapping for different blockchains
 */
export const CHAIN_ID_MAP: Record<string, string> = {
    'ethereum': '1',
    'bnb': '56',
    'bsc': '56',
    'polygon': '137',
    'arbitrum': '42161',
    'optimism': '10',
    'base': '8453',
    'avalanche': '43114',
    'fantom': '250',
    'abstract': '2741'
};

/**
 * Fetched contract data with source code and ABI
 */
export interface FetchedContract {
    address: string;
    blockchain: string;
    chainId: string;
    contractName: string;
    protocol: string;
    sourceCode: string;
    abi: ABIItem[] | null;
    fetchedAt: string;
    sources: SourceFile[];
    compilerVersion?: string;
    optimizationUsed?: boolean;
    runs?: number;
}

/**
 * Source file from multi-file contracts
 */
export interface SourceFile {
    filename: string;
    content: string;
}

/**
 * ABI item structure
 */
export interface ABIItem {
    type: 'function' | 'event' | 'constructor' | 'fallback' | 'receive' | 'error';
    name?: string;
    inputs?: ABIParameter[];
    outputs?: ABIParameter[];
    stateMutability?: 'pure' | 'view' | 'nonpayable' | 'payable';
    anonymous?: boolean;
}

/**
 * ABI parameter structure
 */
export interface ABIParameter {
    name: string;
    type: string;
    indexed?: boolean;
    components?: ABIParameter[];
    internalType?: string;
}

/**
 * Contract relationship types
 */
export type RelationshipType = 
    | 'inherits'           // Contract A inherits from Contract B
    | 'imports'            // Contract A imports Contract B
    | 'calls'              // Contract A calls functions on Contract B
    | 'creates'            // Contract A creates/deploys Contract B
    | 'uses_interface'     // Contract A uses interface defined by Contract B
    | 'same_protocol'      // Contracts belong to the same protocol
    | 'similar_code';      // Contracts have similar code patterns

/**
 * Edge in the contract graph
 */
export interface ContractEdge {
    source: string;        // Source contract address
    target: string;        // Target contract address
    relationshipType: RelationshipType;
    metadata?: {
        functionName?: string;
        eventName?: string;
        similarity?: number;
    };
}

/**
 * Node in the contract graph
 */
export interface ContractNode {
    address: string;
    blockchain: string;
    contractName: string;
    protocol: string;
    functions: string[];
    events: string[];
    hasProxy?: boolean;
    implementsInterfaces?: string[];
}

/**
 * Complete code graph
 */
export interface CodeGraph {
    nodes: ContractNode[];
    edges: ContractEdge[];
    metadata: {
        generatedAt: string;
        totalContracts: number;
        totalRelationships: number;
        protocols: string[];
        blockchains: string[];
    };
}

/**
 * Processing status for resumability
 */
export interface ProcessingStatus {
    totalContracts: number;
    processedContracts: number;
    failedContracts: string[];
    lastProcessedIndex: number;
    startedAt: string;
    lastUpdatedAt: string;
}

/**
 * Fetch options for batch processing
 */
export interface FetchOptions {
    batchSize: number;
    delayBetweenRequests: number;      // milliseconds
    delayBetweenBatches: number;       // milliseconds
    maxRetries: number;
    resumeFromIndex?: number;
    outputDir: string;
    saveProgress: boolean;
}

/**
 * Default fetch options
 */
export const DEFAULT_FETCH_OPTIONS: FetchOptions = {
    batchSize: 10,
    delayBetweenRequests: 200,         // 200ms between requests
    delayBetweenBatches: 2000,         // 2s between batches
    maxRetries: 3,
    outputDir: './contract_data',
    saveProgress: true
};
