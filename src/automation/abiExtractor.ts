/**
 * ABI Extractor
 * Extracts and analyzes ABI from contract source code and responses
 */

import { ABIItem, ABIParameter, FetchedContract } from './types';

/**
 * Extract function signatures from ABI
 */
export function extractFunctionSignatures(abi: ABIItem[]): string[] {
    return abi
        .filter(item => item.type === 'function' && item.name)
        .map(item => {
            const inputs = item.inputs?.map(formatParameter).join(', ') || '';
            const outputs = item.outputs?.map(formatParameter).join(', ') || '';
            const mutability = item.stateMutability ? ` ${item.stateMutability}` : '';
            return `${item.name}(${inputs})${mutability}${outputs ? ` returns (${outputs})` : ''}`;
        });
}

/**
 * Extract event signatures from ABI
 */
export function extractEventSignatures(abi: ABIItem[]): string[] {
    return abi
        .filter(item => item.type === 'event' && item.name)
        .map(item => {
            const inputs = item.inputs?.map(param => {
                const indexed = param.indexed ? ' indexed' : '';
                return `${param.type}${indexed} ${param.name}`;
            }).join(', ') || '';
            return `event ${item.name}(${inputs})`;
        });
}

/**
 * Format ABI parameter
 */
function formatParameter(param: ABIParameter): string {
    if (param.components && param.type.includes('tuple')) {
        const components = param.components.map(formatParameter).join(', ');
        const tupleType = param.type.replace('tuple', `(${components})`);
        return param.name ? `${tupleType} ${param.name}` : tupleType;
    }
    return param.name ? `${param.type} ${param.name}` : param.type;
}

/**
 * Extract external/public functions that can be called
 */
export function extractCallableFunctions(abi: ABIItem[]): ABIItem[] {
    return abi.filter(item => 
        item.type === 'function' && 
        (item.stateMutability === 'nonpayable' || 
         item.stateMutability === 'payable' ||
         item.stateMutability === 'view' ||
         item.stateMutability === 'pure')
    );
}

/**
 * Extract state-changing functions
 */
export function extractStateChangingFunctions(abi: ABIItem[]): ABIItem[] {
    return abi.filter(item => 
        item.type === 'function' && 
        (item.stateMutability === 'nonpayable' || item.stateMutability === 'payable')
    );
}

/**
 * Extract view/pure functions
 */
export function extractReadOnlyFunctions(abi: ABIItem[]): ABIItem[] {
    return abi.filter(item => 
        item.type === 'function' && 
        (item.stateMutability === 'view' || item.stateMutability === 'pure')
    );
}

/**
 * Check if contract is ERC20
 */
export function isERC20(abi: ABIItem[]): boolean {
    const requiredFunctions = ['name', 'symbol', 'decimals', 'totalSupply', 'balanceOf', 'transfer', 'approve', 'allowance', 'transferFrom'];
    const functionNames = new Set(abi.filter(item => item.type === 'function').map(item => item.name));
    return requiredFunctions.every(fn => functionNames.has(fn));
}

/**
 * Check if contract is ERC721
 */
export function isERC721(abi: ABIItem[]): boolean {
    const requiredFunctions = ['balanceOf', 'ownerOf', 'safeTransferFrom', 'transferFrom', 'approve', 'getApproved', 'setApprovalForAll', 'isApprovedForAll'];
    const functionNames = new Set(abi.filter(item => item.type === 'function').map(item => item.name));
    return requiredFunctions.every(fn => functionNames.has(fn));
}

/**
 * Check if contract is ERC1155
 */
export function isERC1155(abi: ABIItem[]): boolean {
    const requiredFunctions = ['balanceOf', 'balanceOfBatch', 'setApprovalForAll', 'isApprovedForAll', 'safeTransferFrom', 'safeBatchTransferFrom'];
    const functionNames = new Set(abi.filter(item => item.type === 'function').map(item => item.name));
    return requiredFunctions.every(fn => functionNames.has(fn));
}

/**
 * Detect proxy patterns
 */
export function detectProxyPattern(abi: ABIItem[]): boolean {
    const proxyIndicators = ['implementation', 'upgradeTo', 'upgradeToAndCall', '_implementation'];
    const functionNames = new Set(abi.filter(item => item.type === 'function').map(item => item.name?.toLowerCase()));
    return proxyIndicators.some(indicator => functionNames.has(indicator));
}

/**
 * Extract interface implementations from source code
 */
export function extractInterfacesFromSource(sourceCode: string): string[] {
    const interfaces: string[] = [];
    
    // Match "is InterfaceName" patterns
    const isPattern = /\bis\s+(\w+)/g;
    let match;
    while ((match = isPattern.exec(sourceCode)) !== null) {
        if (match[1].startsWith('I') || match[1].startsWith('IERC')) {
            interfaces.push(match[1]);
        }
    }
    
    // Match import statements for interfaces
    const importPattern = /import\s+.*?["'].*?\/(\w+)\.sol["']/g;
    while ((match = importPattern.exec(sourceCode)) !== null) {
        if (match[1].startsWith('I') || match[1].startsWith('IERC')) {
            interfaces.push(match[1]);
        }
    }
    
    return [...new Set(interfaces)];
}

/**
 * Extract contract inheritance from source code
 */
export function extractInheritance(sourceCode: string): string[] {
    const inherited: string[] = [];
    
    // Match "contract X is A, B, C" pattern
    const contractPattern = /contract\s+\w+\s+is\s+([^{]+)\{/g;
    let match;
    while ((match = contractPattern.exec(sourceCode)) !== null) {
        const inheritList = match[1].split(',').map(s => s.trim().split('(')[0].trim());
        inherited.push(...inheritList);
    }
    
    return [...new Set(inherited)];
}

/**
 * Extract external contract calls from source code
 */
export function extractExternalCalls(sourceCode: string): string[] {
    const calls: string[] = [];
    
    // Match interface calls like IERC20(address).function()
    const interfaceCallPattern = /(\w+)\s*\(\s*[^)]+\s*\)\s*\.\s*(\w+)\s*\(/g;
    let match;
    while ((match = interfaceCallPattern.exec(sourceCode)) !== null) {
        if (match[1].startsWith('I') || match[1].includes('Interface')) {
            calls.push(`${match[1]}.${match[2]}`);
        }
    }
    
    return [...new Set(calls)];
}

/**
 * Extract imported contracts from source code
 */
export function extractImports(sourceCode: string): string[] {
    const imports: string[] = [];
    
    // Match import statements
    const importPattern = /import\s+(?:["']([^"']+)["']|{[^}]+}\s+from\s+["']([^"']+)["'])/g;
    let match;
    while ((match = importPattern.exec(sourceCode)) !== null) {
        const importPath = match[1] || match[2];
        if (importPath) {
            imports.push(importPath);
        }
    }
    
    return [...new Set(imports)];
}

/**
 * Analyze a fetched contract and extract metadata
 */
export function analyzeContract(contract: FetchedContract): {
    functions: string[];
    events: string[];
    isERC20: boolean;
    isERC721: boolean;
    isERC1155: boolean;
    isProxy: boolean;
    interfaces: string[];
    inheritance: string[];
    externalCalls: string[];
    imports: string[];
} {
    const abi = contract.abi || [];
    const sourceCode = contract.sources.map(s => s.content).join('\n');
    
    return {
        functions: extractFunctionSignatures(abi),
        events: extractEventSignatures(abi),
        isERC20: isERC20(abi),
        isERC721: isERC721(abi),
        isERC1155: isERC1155(abi),
        isProxy: detectProxyPattern(abi),
        interfaces: extractInterfacesFromSource(sourceCode),
        inheritance: extractInheritance(sourceCode),
        externalCalls: extractExternalCalls(sourceCode),
        imports: extractImports(sourceCode)
    };
}
