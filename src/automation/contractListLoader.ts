/**
 * Contract List Loader
 * Loads and parses contract lists from JSON files
 */

import * as fs from 'fs';
import * as path from 'path';
import { ContractEntry, CHAIN_ID_MAP } from './types';

/**
 * Load contracts from a JSON file
 */
export function loadContractsFromFile(filePath: string): ContractEntry[] {
    try {
        const absolutePath = path.resolve(filePath);
        const content = fs.readFileSync(absolutePath, 'utf-8');
        const contracts = JSON.parse(content) as ContractEntry[];
        
        // Validate and normalize contracts
        return contracts.map(normalizeContractEntry).filter(isValidContractEntry);
    } catch (error) {
        throw new Error(`Failed to load contracts from ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Load contracts from multiple JSON files
 */
export function loadContractsFromFiles(filePaths: string[]): ContractEntry[] {
    const allContracts: ContractEntry[] = [];
    
    for (const filePath of filePaths) {
        const contracts = loadContractsFromFile(filePath);
        allContracts.push(...contracts);
    }
    
    return allContracts;
}

/**
 * Normalize a contract entry (trim whitespace, lowercase address, etc.)
 */
function normalizeContractEntry(entry: ContractEntry): ContractEntry {
    return {
        address: entry.address?.toLowerCase().trim() || '',
        blockchain: entry.blockchain?.toLowerCase().trim() || '',
        contract_name: entry.contract_name?.trim() || 'Unknown',
        protocol: entry.protocol?.trim() || 'Unknown'
    };
}

/**
 * Validate a contract entry
 */
function isValidContractEntry(entry: ContractEntry): boolean {
    // Must have a valid Ethereum-style address
    if (!entry.address || !/^0x[a-f0-9]{40}$/i.test(entry.address)) {
        return false;
    }
    
    // Must have a supported blockchain
    if (!entry.blockchain || !CHAIN_ID_MAP[entry.blockchain]) {
        return false;
    }
    
    return true;
}

/**
 * Get unique protocols from contract list
 */
export function getUniqueProtocols(contracts: ContractEntry[]): string[] {
    const protocols = new Set(contracts.map(c => c.protocol));
    return Array.from(protocols).sort();
}

/**
 * Get unique blockchains from contract list
 */
export function getUniqueBlockchains(contracts: ContractEntry[]): string[] {
    const blockchains = new Set(contracts.map(c => c.blockchain));
    return Array.from(blockchains).sort();
}

/**
 * Group contracts by protocol
 */
export function groupContractsByProtocol(contracts: ContractEntry[]): Map<string, ContractEntry[]> {
    const grouped = new Map<string, ContractEntry[]>();
    
    for (const contract of contracts) {
        const existing = grouped.get(contract.protocol) || [];
        existing.push(contract);
        grouped.set(contract.protocol, existing);
    }
    
    return grouped;
}

/**
 * Group contracts by blockchain
 */
export function groupContractsByBlockchain(contracts: ContractEntry[]): Map<string, ContractEntry[]> {
    const grouped = new Map<string, ContractEntry[]>();
    
    for (const contract of contracts) {
        const existing = grouped.get(contract.blockchain) || [];
        existing.push(contract);
        grouped.set(contract.blockchain, existing);
    }
    
    return grouped;
}

/**
 * Filter contracts by blockchain
 */
export function filterContractsByBlockchain(contracts: ContractEntry[], blockchain: string): ContractEntry[] {
    return contracts.filter(c => c.blockchain.toLowerCase() === blockchain.toLowerCase());
}

/**
 * Filter contracts by protocol
 */
export function filterContractsByProtocol(contracts: ContractEntry[], protocol: string): ContractEntry[] {
    return contracts.filter(c => c.protocol.toLowerCase() === protocol.toLowerCase());
}

/**
 * Remove duplicate contracts (same address on same blockchain)
 */
export function removeDuplicates(contracts: ContractEntry[]): ContractEntry[] {
    const seen = new Set<string>();
    const unique: ContractEntry[] = [];
    
    for (const contract of contracts) {
        const key = `${contract.blockchain}:${contract.address}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(contract);
        }
    }
    
    return unique;
}

/**
 * Get contract list statistics
 */
export function getContractListStats(contracts: ContractEntry[]): {
    totalContracts: number;
    uniqueContracts: number;
    protocols: number;
    blockchains: number;
    byBlockchain: Record<string, number>;
    byProtocol: Record<string, number>;
} {
    const unique = removeDuplicates(contracts);
    const byBlockchain: Record<string, number> = {};
    const byProtocol: Record<string, number> = {};
    
    for (const contract of unique) {
        byBlockchain[contract.blockchain] = (byBlockchain[contract.blockchain] || 0) + 1;
        byProtocol[contract.protocol] = (byProtocol[contract.protocol] || 0) + 1;
    }
    
    return {
        totalContracts: contracts.length,
        uniqueContracts: unique.length,
        protocols: Object.keys(byProtocol).length,
        blockchains: Object.keys(byBlockchain).length,
        byBlockchain,
        byProtocol
    };
}
