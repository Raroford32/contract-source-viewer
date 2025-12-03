/**
 * Code Graph Builder
 * Builds relationship graphs between smart contracts
 */

import {
    FetchedContract,
    ContractNode,
    ContractEdge,
    CodeGraph,
    RelationshipType
} from './types';
import {
    analyzeContract,
    extractInheritance,
    extractImports,
    extractExternalCalls,
    extractInterfacesFromSource
} from './abiExtractor';

/**
 * Code Graph Builder class
 */
export class CodeGraphBuilder {
    private nodes: Map<string, ContractNode> = new Map();
    private edges: ContractEdge[] = [];
    private addressToContract: Map<string, FetchedContract> = new Map();
    private nameToAddresses: Map<string, string[]> = new Map();
    
    /**
     * Add contracts to the graph
     */
    addContracts(contracts: FetchedContract[]): void {
        // Index contracts
        for (const contract of contracts) {
            this.addressToContract.set(contract.address.toLowerCase(), contract);
            
            // Index by name for cross-referencing
            const normalizedName = contract.contractName.toLowerCase();
            const addresses = this.nameToAddresses.get(normalizedName) || [];
            addresses.push(contract.address.toLowerCase());
            this.nameToAddresses.set(normalizedName, addresses);
        }
        
        // Build nodes
        for (const contract of contracts) {
            const node = this.buildNode(contract);
            this.nodes.set(contract.address.toLowerCase(), node);
        }
        
        // Build edges
        for (const contract of contracts) {
            this.buildEdgesForContract(contract);
        }
    }
    
    /**
     * Build a node from a contract
     */
    private buildNode(contract: FetchedContract): ContractNode {
        const analysis = analyzeContract(contract);
        
        return {
            address: contract.address,
            blockchain: contract.blockchain,
            contractName: contract.contractName,
            protocol: contract.protocol,
            functions: analysis.functions.slice(0, 50), // Limit to top 50 functions
            events: analysis.events.slice(0, 20), // Limit to top 20 events
            hasProxy: analysis.isProxy,
            implementsInterfaces: analysis.interfaces
        };
    }
    
    /**
     * Build edges for a contract
     */
    private buildEdgesForContract(contract: FetchedContract): void {
        const sourceCode = contract.sources.map(s => s.content).join('\n');
        const contractAddress = contract.address.toLowerCase();
        
        // 1. Same protocol relationships
        this.buildSameProtocolEdges(contract);
        
        // 2. Inheritance relationships
        this.buildInheritanceEdges(contract, sourceCode);
        
        // 3. Import relationships
        this.buildImportEdges(contract, sourceCode);
        
        // 4. External call relationships
        this.buildExternalCallEdges(contract, sourceCode);
        
        // 5. Interface usage relationships
        this.buildInterfaceEdges(contract, sourceCode);
        
        // 6. Address reference relationships
        this.buildAddressReferenceEdges(contract, sourceCode);
    }
    
    /**
     * Build edges for contracts in the same protocol
     */
    private buildSameProtocolEdges(contract: FetchedContract): void {
        const contractAddress = contract.address.toLowerCase();
        
        for (const [address, node] of this.nodes) {
            if (address !== contractAddress && node.protocol === contract.protocol) {
                // Only add edge if not already present
                if (!this.hasEdge(contractAddress, address, 'same_protocol')) {
                    this.edges.push({
                        source: contractAddress,
                        target: address,
                        relationshipType: 'same_protocol'
                    });
                }
            }
        }
    }
    
    /**
     * Build inheritance edges
     */
    private buildInheritanceEdges(contract: FetchedContract, sourceCode: string): void {
        const inheritance = extractInheritance(sourceCode);
        const contractAddress = contract.address.toLowerCase();
        
        for (const inherited of inheritance) {
            const targetAddresses = this.findContractsByName(inherited);
            for (const targetAddress of targetAddresses) {
                if (targetAddress !== contractAddress) {
                    this.addEdge(contractAddress, targetAddress, 'inherits');
                }
            }
        }
    }
    
    /**
     * Build import edges
     */
    private buildImportEdges(contract: FetchedContract, sourceCode: string): void {
        const imports = extractImports(sourceCode);
        const contractAddress = contract.address.toLowerCase();
        
        for (const importPath of imports) {
            // Extract contract name from import path
            const match = importPath.match(/\/([^/]+)\.sol$/);
            if (match) {
                const contractName = match[1];
                const targetAddresses = this.findContractsByName(contractName);
                for (const targetAddress of targetAddresses) {
                    if (targetAddress !== contractAddress) {
                        this.addEdge(contractAddress, targetAddress, 'imports');
                    }
                }
            }
        }
    }
    
    /**
     * Build external call edges
     */
    private buildExternalCallEdges(contract: FetchedContract, sourceCode: string): void {
        const calls = extractExternalCalls(sourceCode);
        const contractAddress = contract.address.toLowerCase();
        
        for (const call of calls) {
            const [interfaceName, functionName] = call.split('.');
            const targetAddresses = this.findContractsByName(interfaceName);
            
            for (const targetAddress of targetAddresses) {
                if (targetAddress !== contractAddress) {
                    this.addEdge(contractAddress, targetAddress, 'calls', { functionName });
                }
            }
        }
    }
    
    /**
     * Build interface usage edges
     */
    private buildInterfaceEdges(contract: FetchedContract, sourceCode: string): void {
        const interfaces = extractInterfacesFromSource(sourceCode);
        const contractAddress = contract.address.toLowerCase();
        
        for (const interfaceName of interfaces) {
            const targetAddresses = this.findContractsByName(interfaceName);
            for (const targetAddress of targetAddresses) {
                if (targetAddress !== contractAddress) {
                    this.addEdge(contractAddress, targetAddress, 'uses_interface');
                }
            }
        }
    }
    
    /**
     * Build edges for direct address references in source code
     */
    private buildAddressReferenceEdges(contract: FetchedContract, sourceCode: string): void {
        const contractAddress = contract.address.toLowerCase();
        
        // Find all address patterns in source code
        const addressPattern = /0x[a-fA-F0-9]{40}/g;
        let match;
        const foundAddresses = new Set<string>();
        
        while ((match = addressPattern.exec(sourceCode)) !== null) {
            const address = match[0].toLowerCase();
            if (address !== contractAddress && this.nodes.has(address)) {
                foundAddresses.add(address);
            }
        }
        
        for (const targetAddress of foundAddresses) {
            this.addEdge(contractAddress, targetAddress, 'calls');
        }
    }
    
    /**
     * Find contracts by name (case-insensitive)
     */
    private findContractsByName(name: string): string[] {
        const normalizedName = name.toLowerCase();
        return this.nameToAddresses.get(normalizedName) || [];
    }
    
    /**
     * Add an edge if it doesn't exist
     */
    private addEdge(
        source: string,
        target: string,
        relationshipType: RelationshipType,
        metadata?: { functionName?: string; eventName?: string; similarity?: number }
    ): void {
        if (!this.hasEdge(source, target, relationshipType)) {
            this.edges.push({ source, target, relationshipType, metadata });
        }
    }
    
    /**
     * Check if an edge exists
     */
    private hasEdge(source: string, target: string, relationshipType: RelationshipType): boolean {
        return this.edges.some(e => 
            e.source === source && 
            e.target === target && 
            e.relationshipType === relationshipType
        );
    }
    
    /**
     * Build the final code graph
     */
    build(): CodeGraph {
        const protocols = [...new Set(Array.from(this.nodes.values()).map(n => n.protocol))];
        const blockchains = [...new Set(Array.from(this.nodes.values()).map(n => n.blockchain))];
        
        return {
            nodes: Array.from(this.nodes.values()),
            edges: this.edges,
            metadata: {
                generatedAt: new Date().toISOString(),
                totalContracts: this.nodes.size,
                totalRelationships: this.edges.length,
                protocols,
                blockchains
            }
        };
    }
    
    /**
     * Get statistics about the graph
     */
    getStats(): {
        totalNodes: number;
        totalEdges: number;
        edgesByType: Record<string, number>;
        nodesByProtocol: Record<string, number>;
        nodesByBlockchain: Record<string, number>;
        averageEdgesPerNode: number;
    } {
        const edgesByType: Record<string, number> = {};
        const nodesByProtocol: Record<string, number> = {};
        const nodesByBlockchain: Record<string, number> = {};
        
        for (const edge of this.edges) {
            edgesByType[edge.relationshipType] = (edgesByType[edge.relationshipType] || 0) + 1;
        }
        
        for (const node of this.nodes.values()) {
            nodesByProtocol[node.protocol] = (nodesByProtocol[node.protocol] || 0) + 1;
            nodesByBlockchain[node.blockchain] = (nodesByBlockchain[node.blockchain] || 0) + 1;
        }
        
        return {
            totalNodes: this.nodes.size,
            totalEdges: this.edges.length,
            edgesByType,
            nodesByProtocol,
            nodesByBlockchain,
            averageEdgesPerNode: this.nodes.size > 0 ? this.edges.length / this.nodes.size : 0
        };
    }
    
    /**
     * Export graph to JSON
     */
    toJSON(): string {
        return JSON.stringify(this.build(), null, 2);
    }
    
    /**
     * Export graph to GraphML format
     */
    toGraphML(): string {
        const graph = this.build();
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">\n';
        
        // Define attributes
        xml += '  <key id="contractName" for="node" attr.name="contractName" attr.type="string"/>\n';
        xml += '  <key id="protocol" for="node" attr.name="protocol" attr.type="string"/>\n';
        xml += '  <key id="blockchain" for="node" attr.name="blockchain" attr.type="string"/>\n';
        xml += '  <key id="relationshipType" for="edge" attr.name="relationshipType" attr.type="string"/>\n';
        
        xml += '  <graph id="G" edgedefault="directed">\n';
        
        // Add nodes
        for (const node of graph.nodes) {
            xml += `    <node id="${node.address}">\n`;
            xml += `      <data key="contractName">${this.escapeXml(node.contractName)}</data>\n`;
            xml += `      <data key="protocol">${this.escapeXml(node.protocol)}</data>\n`;
            xml += `      <data key="blockchain">${this.escapeXml(node.blockchain)}</data>\n`;
            xml += '    </node>\n';
        }
        
        // Add edges
        for (let i = 0; i < graph.edges.length; i++) {
            const edge = graph.edges[i];
            xml += `    <edge id="e${i}" source="${edge.source}" target="${edge.target}">\n`;
            xml += `      <data key="relationshipType">${edge.relationshipType}</data>\n`;
            xml += '    </edge>\n';
        }
        
        xml += '  </graph>\n';
        xml += '</graphml>';
        
        return xml;
    }
    
    /**
     * Export to D3.js compatible format
     */
    toD3Format(): { nodes: Array<{ id: string; group: string; label: string }>; links: Array<{ source: string; target: string; type: string }> } {
        const graph = this.build();
        
        return {
            nodes: graph.nodes.map(n => ({
                id: n.address,
                group: n.protocol,
                label: n.contractName
            })),
            links: graph.edges.map(e => ({
                source: e.source,
                target: e.target,
                type: e.relationshipType
            }))
        };
    }
    
    /**
     * Escape XML special characters
     */
    private escapeXml(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
}

/**
 * Build a code graph from fetched contracts
 */
export function buildCodeGraph(contracts: FetchedContract[]): CodeGraph {
    const builder = new CodeGraphBuilder();
    builder.addContracts(contracts);
    return builder.build();
}
