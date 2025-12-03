#!/usr/bin/env node
/**
 * CLI Runner for Contract Automation
 * Provides command-line interface to fetch contracts and build graphs
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
    loadContractsFromFile, 
    removeDuplicates, 
    getContractListStats,
    filterContractsByBlockchain,
    filterContractsByProtocol
} from './contractListLoader';
import { BatchContractFetcher } from './batchContractFetcher';
import { CodeGraphBuilder, buildCodeGraph } from './codeGraphBuilder';
import { CommunicationGraphBuilder, buildCommunicationGraph } from './communicationGraphBuilder';
import { DataPersistence } from './dataPersistence';
import { ContractEntry, FetchOptions, DEFAULT_FETCH_OPTIONS } from './types';

/**
 * CLI Configuration
 */
interface CLIConfig {
    inputFiles: string[];
    outputDir: string;
    blockchain?: string;
    protocol?: string;
    batchSize: number;
    delayBetweenRequests: number;
    delayBetweenBatches: number;
    maxRetries: number;
    resumeFromIndex?: number;
    limit?: number;
    skipFetch: boolean;
    generateGraphs: boolean;
    saveSourceFiles: boolean;
    verbose: boolean;
}

/**
 * Default CLI configuration
 */
const DEFAULT_CONFIG: CLIConfig = {
    inputFiles: [],
    outputDir: './contract_data',
    batchSize: 10,
    delayBetweenRequests: 200,
    delayBetweenBatches: 2000,
    maxRetries: 3,
    skipFetch: false,
    generateGraphs: true,
    saveSourceFiles: false,
    verbose: true
};

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): Partial<CLIConfig> {
    const config: Partial<CLIConfig> = {};
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        switch (arg) {
            case '--input':
            case '-i':
                config.inputFiles = config.inputFiles || [];
                config.inputFiles.push(args[++i]);
                break;
            case '--output':
            case '-o':
                config.outputDir = args[++i];
                break;
            case '--blockchain':
            case '-b':
                config.blockchain = args[++i];
                break;
            case '--protocol':
            case '-p':
                config.protocol = args[++i];
                break;
            case '--batch-size':
                config.batchSize = parseInt(args[++i], 10);
                break;
            case '--delay':
                config.delayBetweenRequests = parseInt(args[++i], 10);
                break;
            case '--batch-delay':
                config.delayBetweenBatches = parseInt(args[++i], 10);
                break;
            case '--retries':
                config.maxRetries = parseInt(args[++i], 10);
                break;
            case '--resume':
                config.resumeFromIndex = parseInt(args[++i], 10);
                break;
            case '--limit':
                config.limit = parseInt(args[++i], 10);
                break;
            case '--skip-fetch':
                config.skipFetch = true;
                break;
            case '--no-graphs':
                config.generateGraphs = false;
                break;
            case '--save-sources':
                config.saveSourceFiles = true;
                break;
            case '--quiet':
            case '-q':
                config.verbose = false;
                break;
            case '--help':
            case '-h':
                printHelp();
                process.exit(0);
        }
    }
    
    return config;
}

/**
 * Print help message
 */
function printHelp(): void {
    console.log(`
Contract Automation CLI
=======================

Usage: npx ts-node src/automation/cli.ts [options]

Options:
  -i, --input <file>       Input JSON file(s) with contract list (can be used multiple times)
  -o, --output <dir>       Output directory (default: ./contract_data)
  -b, --blockchain <name>  Filter by blockchain (e.g., ethereum, bnb)
  -p, --protocol <name>    Filter by protocol
  --batch-size <n>         Number of contracts to fetch per batch (default: 10)
  --delay <ms>             Delay between requests in ms (default: 200)
  --batch-delay <ms>       Delay between batches in ms (default: 2000)
  --retries <n>            Max retries per contract (default: 3)
  --resume <n>             Resume from contract index
  --limit <n>              Limit number of contracts to process
  --skip-fetch             Skip fetching, use existing data
  --no-graphs              Skip graph generation
  --save-sources           Save individual source files
  -q, --quiet              Reduce output verbosity
  -h, --help               Show this help message

Examples:
  # Fetch all Ethereum contracts and build graphs
  npx ts-node src/automation/cli.ts -i all_ethereum_contracts.json -o ./output

  # Fetch only AAVE protocol contracts
  npx ts-node src/automation/cli.ts -i all_ethereum_contracts.json -p aave

  # Resume from index 1000
  npx ts-node src/automation/cli.ts -i all_ethereum_contracts.json --resume 1000

  # Build graphs from existing data
  npx ts-node src/automation/cli.ts --skip-fetch -o ./existing_data
`);
}

/**
 * Main automation runner
 */
export async function runAutomation(config: CLIConfig): Promise<void> {
    const startTime = Date.now();
    const persistence = new DataPersistence(config.outputDir);
    
    console.log('='.repeat(60));
    console.log('Contract Automation Started');
    console.log('='.repeat(60));
    console.log(`Output directory: ${config.outputDir}`);
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log('');
    
    let contracts: ContractEntry[] = [];
    
    // Load contracts from input files
    if (!config.skipFetch && config.inputFiles.length > 0) {
        console.log('Loading contracts from input files...');
        
        for (const file of config.inputFiles) {
            try {
                const loaded = loadContractsFromFile(file);
                console.log(`  - ${file}: ${loaded.length} contracts`);
                contracts.push(...loaded);
            } catch (error) {
                console.error(`  - Error loading ${file}: ${error}`);
            }
        }
        
        // Remove duplicates
        contracts = removeDuplicates(contracts);
        console.log(`Total unique contracts: ${contracts.length}`);
        
        // Apply filters
        if (config.blockchain) {
            contracts = filterContractsByBlockchain(contracts, config.blockchain);
            console.log(`After blockchain filter (${config.blockchain}): ${contracts.length} contracts`);
        }
        
        if (config.protocol) {
            contracts = filterContractsByProtocol(contracts, config.protocol);
            console.log(`After protocol filter (${config.protocol}): ${contracts.length} contracts`);
        }
        
        // Apply limit
        if (config.limit && config.limit > 0) {
            contracts = contracts.slice(0, config.limit);
            console.log(`After limit: ${contracts.length} contracts`);
        }
        
        // Print statistics
        const stats = getContractListStats(contracts);
        console.log('\nContract Statistics:');
        console.log(`  - Protocols: ${stats.protocols}`);
        console.log(`  - Blockchains: ${stats.blockchains}`);
        console.log('');
    }
    
    // Fetch contracts
    let fetchedContracts = persistence.loadContracts();
    
    if (!config.skipFetch && contracts.length > 0) {
        console.log('Fetching contract source code and ABIs...');
        console.log(`Batch size: ${config.batchSize}`);
        console.log(`Delay between requests: ${config.delayBetweenRequests}ms`);
        console.log('');
        
        const fetchOptions: FetchOptions = {
            batchSize: config.batchSize,
            delayBetweenRequests: config.delayBetweenRequests,
            delayBetweenBatches: config.delayBetweenBatches,
            maxRetries: config.maxRetries,
            resumeFromIndex: config.resumeFromIndex,
            outputDir: config.outputDir,
            saveProgress: true
        };
        
        const fetcher = new BatchContractFetcher(fetchOptions);
        
        // Set progress callback
        fetcher.setProgressCallback((status, currentContract) => {
            if (config.verbose && currentContract) {
                const percent = ((status.processedContracts / status.totalContracts) * 100).toFixed(1);
                process.stdout.write(`\r[${percent}%] Processing: ${currentContract.contract_name} (${currentContract.address.slice(0, 10)}...)     `);
            }
        });
        
        try {
            fetchedContracts = await fetcher.fetchAll(contracts);
            console.log(`\n\nFetched ${fetchedContracts.length} contracts successfully`);
            
            const status = fetcher.getStatus();
            if (status.failedContracts.length > 0) {
                console.log(`Failed to fetch ${status.failedContracts.length} contracts`);
            }
            
            // Save contracts
            persistence.saveContracts(fetchedContracts);
            
            // Optionally save individual source files
            if (config.saveSourceFiles) {
                console.log('\nSaving individual source files...');
                for (const contract of fetchedContracts) {
                    persistence.saveContractSources(contract);
                }
            }
        } catch (error) {
            console.error(`\nFetch error: ${error}`);
        }
    }
    
    // Generate graphs
    if (config.generateGraphs && fetchedContracts.length > 0) {
        console.log('\n' + '='.repeat(60));
        console.log('Building Code Graph...');
        
        const codeGraphBuilder = new CodeGraphBuilder();
        codeGraphBuilder.addContracts(fetchedContracts);
        const codeGraph = codeGraphBuilder.build();
        
        const codeStats = codeGraphBuilder.getStats();
        console.log(`  - Nodes: ${codeStats.totalNodes}`);
        console.log(`  - Edges: ${codeStats.totalEdges}`);
        console.log(`  - Average edges per node: ${codeStats.averageEdgesPerNode.toFixed(2)}`);
        
        persistence.saveCodeGraph(codeGraph);
        persistence.saveGraphML(codeGraphBuilder.toGraphML());
        persistence.saveD3Format(codeGraphBuilder.toD3Format(), 'code_graph_d3.json');
        
        console.log('\nBuilding Communication Graph...');
        
        const commGraphBuilder = new CommunicationGraphBuilder();
        commGraphBuilder.addContracts(fetchedContracts);
        const commGraph = commGraphBuilder.build();
        
        console.log(`  - Nodes: ${commGraph.nodes.length}`);
        console.log(`  - Communications: ${commGraph.edges.length}`);
        console.log('  - Top patterns:');
        const sortedPatterns = Object.entries(commGraph.patterns)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);
        for (const [pattern, count] of sortedPatterns) {
            console.log(`    - ${pattern}: ${count}`);
        }
        
        persistence.saveCommunicationGraph(commGraph);
        persistence.saveD3Format(commGraphBuilder.toD3Format(), 'communication_graph_d3.json');
        
        // Get hub contracts
        const hubs = commGraphBuilder.getHubs(10);
        console.log('\nTop 10 Hub Contracts:');
        for (const hub of hubs) {
            console.log(`  - ${hub.contractName} (${hub.role}): ${hub.communicationCount} connections`);
        }
        
        // Generate summary report
        persistence.saveSummaryReport(fetchedContracts, codeGraph, commGraph);
    }
    
    // Print completion summary
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(60));
    console.log('Automation Complete');
    console.log('='.repeat(60));
    console.log(`Elapsed time: ${elapsedTime} seconds`);
    console.log(`Contracts processed: ${fetchedContracts.length}`);
    console.log(`Output directory: ${path.resolve(config.outputDir)}`);
    console.log('\nGenerated files:');
    const files = persistence.listFiles();
    for (const file of files) {
        console.log(`  - ${file}`);
    }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        printHelp();
        return;
    }
    
    const parsedConfig = parseArgs(args);
    const config: CLIConfig = { ...DEFAULT_CONFIG, ...parsedConfig };
    
    // If no input files specified and not skipping fetch, use default files
    if (config.inputFiles.length === 0 && !config.skipFetch) {
        const defaultFiles = ['all_ethereum_contracts.json', 'cache_bnb.json'];
        for (const file of defaultFiles) {
            if (fs.existsSync(file)) {
                config.inputFiles.push(file);
            }
        }
        
        if (config.inputFiles.length === 0) {
            console.error('No input files found. Please specify input files with -i option.');
            process.exit(1);
        }
    }
    
    try {
        await runAutomation(config);
    } catch (error) {
        console.error('Automation failed:', error);
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}

export { parseArgs, CLIConfig, DEFAULT_CONFIG };
