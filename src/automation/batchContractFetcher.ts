/**
 * Batch Contract Fetcher
 * Fetches contract source code and ABIs in batches with rate limiting and resumability
 */

import * as fs from 'fs';
import * as path from 'path';
import axios, { AxiosError } from 'axios';
import {
    ContractEntry,
    FetchedContract,
    FetchOptions,
    ProcessingStatus,
    SourceFile,
    ABIItem,
    CHAIN_ID_MAP,
    DEFAULT_FETCH_OPTIONS
} from './types';
import { parseSourceCode, ParsedSource } from '../sourceParser';
import { ContractSourceResponse } from '../contractService';

/**
 * Event emitter for progress updates
 */
export type ProgressCallback = (status: ProcessingStatus, currentContract?: ContractEntry) => void;

/**
 * Batch Contract Fetcher class
 */
export class BatchContractFetcher {
    private options: FetchOptions;
    private status: ProcessingStatus;
    private onProgress?: ProgressCallback;
    
    constructor(options: Partial<FetchOptions> = {}) {
        this.options = { ...DEFAULT_FETCH_OPTIONS, ...options };
        this.status = {
            totalContracts: 0,
            processedContracts: 0,
            failedContracts: [],
            lastProcessedIndex: -1,
            startedAt: new Date().toISOString(),
            lastUpdatedAt: new Date().toISOString()
        };
    }
    
    /**
     * Set progress callback
     */
    setProgressCallback(callback: ProgressCallback): void {
        this.onProgress = callback;
    }
    
    /**
     * Fetch all contracts from a list
     */
    async fetchAll(contracts: ContractEntry[]): Promise<FetchedContract[]> {
        this.status.totalContracts = contracts.length;
        this.status.startedAt = new Date().toISOString();
        
        // Resume from last processed index if specified
        const startIndex = this.options.resumeFromIndex ?? 0;
        const results: FetchedContract[] = [];
        
        // Ensure output directory exists
        this.ensureOutputDir();
        
        // Load any previously fetched contracts if resuming
        if (startIndex > 0) {
            const previousResults = this.loadPreviousResults();
            results.push(...previousResults);
        }
        
        // Process contracts in batches
        for (let i = startIndex; i < contracts.length; i += this.options.batchSize) {
            const batch = contracts.slice(i, i + this.options.batchSize);
            const batchResults = await this.processBatch(batch, i);
            results.push(...batchResults);
            
            // Update status
            this.status.lastProcessedIndex = Math.min(i + this.options.batchSize - 1, contracts.length - 1);
            this.status.processedContracts = results.length;
            this.status.lastUpdatedAt = new Date().toISOString();
            
            // Save progress
            if (this.options.saveProgress) {
                this.saveProgress(results);
            }
            
            // Delay between batches
            if (i + this.options.batchSize < contracts.length) {
                await this.delay(this.options.delayBetweenBatches);
            }
        }
        
        return results;
    }
    
    /**
     * Process a batch of contracts
     */
    private async processBatch(batch: ContractEntry[], batchStartIndex: number): Promise<FetchedContract[]> {
        const results: FetchedContract[] = [];
        
        for (let i = 0; i < batch.length; i++) {
            const contract = batch[i];
            const globalIndex = batchStartIndex + i;
            
            try {
                // Notify progress
                if (this.onProgress) {
                    this.onProgress(this.status, contract);
                }
                
                const fetched = await this.fetchContractWithRetry(contract);
                if (fetched) {
                    results.push(fetched);
                    console.log(`[${globalIndex + 1}/${this.status.totalContracts}] Fetched: ${contract.contract_name} (${contract.address})`);
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error(`[${globalIndex + 1}/${this.status.totalContracts}] Failed: ${contract.contract_name} (${contract.address}): ${errorMsg}`);
                this.status.failedContracts.push(contract.address);
            }
            
            // Delay between requests within batch
            if (i < batch.length - 1) {
                await this.delay(this.options.delayBetweenRequests);
            }
        }
        
        return results;
    }
    
    /**
     * Fetch a single contract with retry logic
     */
    private async fetchContractWithRetry(contract: ContractEntry): Promise<FetchedContract | null> {
        let lastError: Error | null = null;
        
        for (let attempt = 0; attempt < this.options.maxRetries; attempt++) {
            try {
                return await this.fetchContract(contract);
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                
                // Don't retry on 404 or validation errors
                if (lastError.message.includes('not found') || lastError.message.includes('not verified')) {
                    throw lastError;
                }
                
                // Wait before retry with exponential backoff
                if (attempt < this.options.maxRetries - 1) {
                    await this.delay(this.options.delayBetweenRequests * Math.pow(2, attempt));
                }
            }
        }
        
        throw lastError;
    }
    
    /**
     * Fetch a single contract's source code and ABI
     */
    private async fetchContract(contract: ContractEntry): Promise<FetchedContract> {
        const chainId = CHAIN_ID_MAP[contract.blockchain];
        if (!chainId) {
            throw new Error(`Unsupported blockchain: ${contract.blockchain}`);
        }
        
        const url = `https://vscode.blockscan.com/srcapi/${chainId}/${contract.address}`;
        
        const response = await axios.get<ContractSourceResponse>(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'DNT': '1'
            }
        });
        
        if (response.data.status !== '1') {
            throw new Error(response.data.message || 'Contract not found or not verified');
        }
        
        if (!response.data.result) {
            throw new Error('No source code found');
        }
        
        // Parse source code
        const parsedSources = parseSourceCode(response.data);
        const sources: SourceFile[] = parsedSources.map((ps: ParsedSource) => ({
            filename: ps.filename,
            content: ps.content
        }));
        
        // Extract ABI from the response
        const abi = this.extractABI(response.data);
        
        return {
            address: contract.address,
            blockchain: contract.blockchain,
            chainId,
            contractName: contract.contract_name,
            protocol: contract.protocol,
            sourceCode: response.data.result,
            abi,
            fetchedAt: new Date().toISOString(),
            sources
        };
    }
    
    /**
     * Extract ABI from contract response
     * The ABI is typically included in the API response or embedded in the source
     */
    private extractABI(response: ContractSourceResponse): ABIItem[] | null {
        try {
            // Try to parse ABI from the result if it's JSON with ABI field
            const parsed = JSON.parse(response.result);
            
            // Check for ABI in various common locations
            if (parsed.abi && Array.isArray(parsed.abi)) {
                return parsed.abi;
            }
            
            if (parsed.output?.abi && Array.isArray(parsed.output.abi)) {
                return parsed.output.abi;
            }
            
            return null;
        } catch {
            // If not JSON or no ABI field, try to find ABI in the raw response
            return null;
        }
    }
    
    /**
     * Ensure output directory exists
     */
    private ensureOutputDir(): void {
        if (!fs.existsSync(this.options.outputDir)) {
            fs.mkdirSync(this.options.outputDir, { recursive: true });
        }
    }
    
    /**
     * Save progress to disk
     */
    private saveProgress(results: FetchedContract[]): void {
        const statusPath = path.join(this.options.outputDir, 'processing_status.json');
        const contractsPath = path.join(this.options.outputDir, 'fetched_contracts.json');
        
        // Save status
        fs.writeFileSync(statusPath, JSON.stringify(this.status, null, 2));
        
        // Save fetched contracts synchronously for reliability
        // For very large datasets, consider using streaming with proper error handling
        try {
            const jsonContent = JSON.stringify(results, null, 2);
            fs.writeFileSync(contractsPath, jsonContent);
        } catch (error) {
            console.error(`Failed to save contracts: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    /**
     * Load previous results from disk
     */
    private loadPreviousResults(): FetchedContract[] {
        const contractsPath = path.join(this.options.outputDir, 'fetched_contracts.json');
        
        if (fs.existsSync(contractsPath)) {
            try {
                const content = fs.readFileSync(contractsPath, 'utf-8');
                return JSON.parse(content) as FetchedContract[];
            } catch {
                return [];
            }
        }
        
        return [];
    }
    
    /**
     * Load processing status from disk
     */
    loadStatus(): ProcessingStatus | null {
        const statusPath = path.join(this.options.outputDir, 'processing_status.json');
        
        if (fs.existsSync(statusPath)) {
            try {
                const content = fs.readFileSync(statusPath, 'utf-8');
                return JSON.parse(content) as ProcessingStatus;
            } catch {
                return null;
            }
        }
        
        return null;
    }
    
    /**
     * Get current status
     */
    getStatus(): ProcessingStatus {
        return { ...this.status };
    }
    
    /**
     * Delay helper
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Fetch a single contract (convenience function)
 */
export async function fetchSingleContract(
    address: string,
    blockchain: string,
    contractName: string = 'Unknown',
    protocol: string = 'Unknown'
): Promise<FetchedContract> {
    const fetcher = new BatchContractFetcher({ maxRetries: 3 });
    const results = await fetcher.fetchAll([{
        address,
        blockchain,
        contract_name: contractName,
        protocol
    }]);
    
    if (results.length === 0) {
        throw new Error('Failed to fetch contract');
    }
    
    return results[0];
}
