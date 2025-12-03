/**
 * Contract Automation Module
 * 
 * This module provides automated fetching of smart contract source code and ABIs,
 * and builds comprehensive code and communication graphs.
 * 
 * Features:
 * - Load contract lists from JSON files
 * - Batch fetch source code and ABIs with rate limiting
 * - Extract and analyze contract ABIs
 * - Build code relationship graphs (inheritance, imports, calls)
 * - Build communication graphs (token transfers, swaps, etc.)
 * - Export to various formats (JSON, GraphML, D3.js)
 * - Resumable processing with progress saving
 * 
 * Usage:
 * 
 * CLI:
 *   npx ts-node src/automation/cli.ts -i contracts.json -o ./output
 * 
 * Programmatic:
 *   import { runAutomation } from './automation';
 *   await runAutomation({ inputFiles: ['contracts.json'], outputDir: './output' });
 */

// Types
export * from './types';

// Contract list loader
export {
    loadContractsFromFile,
    loadContractsFromFiles,
    getUniqueProtocols,
    getUniqueBlockchains,
    groupContractsByProtocol,
    groupContractsByBlockchain,
    filterContractsByBlockchain,
    filterContractsByProtocol,
    removeDuplicates,
    getContractListStats
} from './contractListLoader';

// Batch contract fetcher
export {
    BatchContractFetcher,
    fetchSingleContract,
    ProgressCallback
} from './batchContractFetcher';

// ABI extractor
export {
    extractFunctionSignatures,
    extractEventSignatures,
    extractCallableFunctions,
    extractStateChangingFunctions,
    extractReadOnlyFunctions,
    isERC20,
    isERC721,
    isERC1155,
    detectProxyPattern,
    extractInterfacesFromSource,
    extractInheritance,
    extractExternalCalls,
    extractImports,
    analyzeContract
} from './abiExtractor';

// Code graph builder
export {
    CodeGraphBuilder,
    buildCodeGraph
} from './codeGraphBuilder';

// Communication graph builder
export {
    CommunicationGraphBuilder,
    buildCommunicationGraph,
    CommunicationPattern,
    CommunicationEdge,
    CommunicationGraph,
    CommunicationNode,
    ContractRole
} from './communicationGraphBuilder';

// Data persistence
export {
    DataPersistence,
    createDataPersistence
} from './dataPersistence';

// CLI
export {
    runAutomation,
    parseArgs,
    CLIConfig,
    DEFAULT_CONFIG
} from './cli';
