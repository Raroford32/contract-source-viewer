/**
 * Data Persistence Layer
 * Handles saving and loading fetched contracts and graphs
 */

import * as fs from 'fs';
import * as path from 'path';
import { FetchedContract, CodeGraph, ProcessingStatus } from './types';
import { CommunicationGraph } from './communicationGraphBuilder';

/**
 * Data persistence class
 */
export class DataPersistence {
    private outputDir: string;
    
    constructor(outputDir: string = './contract_data') {
        this.outputDir = outputDir;
        this.ensureDir(this.outputDir);
    }
    
    /**
     * Ensure directory exists
     */
    private ensureDir(dir: string): void {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    
    /**
     * Save fetched contracts
     */
    saveContracts(contracts: FetchedContract[], filename: string = 'contracts.json'): void {
        const filePath = path.join(this.outputDir, filename);
        fs.writeFileSync(filePath, JSON.stringify(contracts, null, 2));
        console.log(`Saved ${contracts.length} contracts to ${filePath}`);
    }
    
    /**
     * Save contracts incrementally (append mode)
     */
    appendContract(contract: FetchedContract, filename: string = 'contracts.jsonl'): void {
        const filePath = path.join(this.outputDir, filename);
        const line = JSON.stringify(contract) + '\n';
        fs.appendFileSync(filePath, line);
    }
    
    /**
     * Load fetched contracts
     */
    loadContracts(filename: string = 'contracts.json'): FetchedContract[] {
        const filePath = path.join(this.outputDir, filename);
        
        if (!fs.existsSync(filePath)) {
            return [];
        }
        
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content) as FetchedContract[];
    }
    
    /**
     * Load contracts from JSONL file
     */
    loadContractsJsonl(filename: string = 'contracts.jsonl'): FetchedContract[] {
        const filePath = path.join(this.outputDir, filename);
        
        if (!fs.existsSync(filePath)) {
            return [];
        }
        
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line.trim());
        
        return lines.map(line => JSON.parse(line) as FetchedContract);
    }
    
    /**
     * Save code graph
     */
    saveCodeGraph(graph: CodeGraph, filename: string = 'code_graph.json'): void {
        const filePath = path.join(this.outputDir, filename);
        fs.writeFileSync(filePath, JSON.stringify(graph, null, 2));
        console.log(`Saved code graph to ${filePath}`);
    }
    
    /**
     * Load code graph
     */
    loadCodeGraph(filename: string = 'code_graph.json'): CodeGraph | null {
        const filePath = path.join(this.outputDir, filename);
        
        if (!fs.existsSync(filePath)) {
            return null;
        }
        
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content) as CodeGraph;
    }
    
    /**
     * Save communication graph
     */
    saveCommunicationGraph(graph: CommunicationGraph, filename: string = 'communication_graph.json'): void {
        const filePath = path.join(this.outputDir, filename);
        fs.writeFileSync(filePath, JSON.stringify(graph, null, 2));
        console.log(`Saved communication graph to ${filePath}`);
    }
    
    /**
     * Load communication graph
     */
    loadCommunicationGraph(filename: string = 'communication_graph.json'): CommunicationGraph | null {
        const filePath = path.join(this.outputDir, filename);
        
        if (!fs.existsSync(filePath)) {
            return null;
        }
        
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content) as CommunicationGraph;
    }
    
    /**
     * Save processing status
     */
    saveStatus(status: ProcessingStatus, filename: string = 'status.json'): void {
        const filePath = path.join(this.outputDir, filename);
        fs.writeFileSync(filePath, JSON.stringify(status, null, 2));
    }
    
    /**
     * Load processing status
     */
    loadStatus(filename: string = 'status.json'): ProcessingStatus | null {
        const filePath = path.join(this.outputDir, filename);
        
        if (!fs.existsSync(filePath)) {
            return null;
        }
        
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content) as ProcessingStatus;
    }
    
    /**
     * Save GraphML file
     */
    saveGraphML(graphml: string, filename: string = 'code_graph.graphml'): void {
        const filePath = path.join(this.outputDir, filename);
        fs.writeFileSync(filePath, graphml);
        console.log(`Saved GraphML to ${filePath}`);
    }
    
    /**
     * Save D3.js format
     */
    saveD3Format(data: object, filename: string = 'd3_graph.json'): void {
        const filePath = path.join(this.outputDir, filename);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`Saved D3 format to ${filePath}`);
    }
    
    /**
     * Save contract source files
     */
    saveContractSources(contract: FetchedContract): void {
        const contractDir = path.join(
            this.outputDir,
            'sources',
            contract.blockchain,
            contract.protocol,
            `${contract.contractName}_${contract.address.slice(0, 10)}`
        );
        
        this.ensureDir(contractDir);
        
        // Save each source file
        for (const source of contract.sources) {
            const filePath = path.join(contractDir, source.filename);
            const fileDir = path.dirname(filePath);
            this.ensureDir(fileDir);
            fs.writeFileSync(filePath, source.content);
        }
        
        // Save ABI
        if (contract.abi) {
            const abiPath = path.join(contractDir, 'abi.json');
            fs.writeFileSync(abiPath, JSON.stringify(contract.abi, null, 2));
        }
        
        // Save metadata
        const metadataPath = path.join(contractDir, 'metadata.json');
        fs.writeFileSync(metadataPath, JSON.stringify({
            address: contract.address,
            blockchain: contract.blockchain,
            chainId: contract.chainId,
            contractName: contract.contractName,
            protocol: contract.protocol,
            fetchedAt: contract.fetchedAt,
            compilerVersion: contract.compilerVersion,
            optimizationUsed: contract.optimizationUsed,
            runs: contract.runs
        }, null, 2));
    }
    
    /**
     * Generate summary report
     */
    generateSummaryReport(
        contracts: FetchedContract[],
        codeGraph: CodeGraph,
        commGraph: CommunicationGraph
    ): string {
        const report = {
            generatedAt: new Date().toISOString(),
            summary: {
                totalContracts: contracts.length,
                totalProtocols: [...new Set(contracts.map(c => c.protocol))].length,
                totalBlockchains: [...new Set(contracts.map(c => c.blockchain))].length
            },
            codeGraph: {
                totalNodes: codeGraph.nodes.length,
                totalEdges: codeGraph.edges.length,
                relationshipsByType: this.countByKey(codeGraph.edges, 'relationshipType')
            },
            communicationGraph: {
                totalNodes: commGraph.nodes.length,
                totalEdges: commGraph.edges.length,
                patterns: commGraph.patterns,
                roleDistribution: this.countByKey(commGraph.nodes, 'role')
            },
            contractsByProtocol: this.countByKey(contracts, 'protocol'),
            contractsByBlockchain: this.countByKey(contracts, 'blockchain')
        };
        
        return JSON.stringify(report, null, 2);
    }
    
    /**
     * Save summary report
     */
    saveSummaryReport(
        contracts: FetchedContract[],
        codeGraph: CodeGraph,
        commGraph: CommunicationGraph,
        filename: string = 'summary_report.json'
    ): void {
        const report = this.generateSummaryReport(contracts, codeGraph, commGraph);
        const filePath = path.join(this.outputDir, filename);
        fs.writeFileSync(filePath, report);
        console.log(`Saved summary report to ${filePath}`);
    }
    
    /**
     * Count items by key
     */
    private countByKey<T>(items: T[], key: keyof T): Record<string, number> {
        const counts: Record<string, number> = {};
        for (const item of items) {
            const value = String(item[key]);
            counts[value] = (counts[value] || 0) + 1;
        }
        return counts;
    }
    
    /**
     * Get output directory
     */
    getOutputDir(): string {
        return this.outputDir;
    }
    
    /**
     * Check if output exists
     */
    outputExists(filename: string): boolean {
        return fs.existsSync(path.join(this.outputDir, filename));
    }
    
    /**
     * List all saved files
     */
    listFiles(): string[] {
        if (!fs.existsSync(this.outputDir)) {
            return [];
        }
        return fs.readdirSync(this.outputDir);
    }
    
    /**
     * Clean output directory
     */
    clean(): void {
        if (fs.existsSync(this.outputDir)) {
            fs.rmSync(this.outputDir, { recursive: true, force: true });
        }
        this.ensureDir(this.outputDir);
    }
}

/**
 * Create a new data persistence instance
 */
export function createDataPersistence(outputDir: string = './contract_data'): DataPersistence {
    return new DataPersistence(outputDir);
}
