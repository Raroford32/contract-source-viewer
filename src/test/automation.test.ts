import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import {
    ContractEntry,
    CHAIN_ID_MAP,
    FetchedContract,
    ABIItem
} from '../automation/types';
import {
    removeDuplicates,
    getContractListStats,
    filterContractsByBlockchain,
    filterContractsByProtocol
} from '../automation/contractListLoader';
import {
    extractFunctionSignatures,
    extractEventSignatures,
    isERC20,
    isERC721,
    detectProxyPattern,
    extractInheritance,
    extractImports
} from '../automation/abiExtractor';
import { CodeGraphBuilder } from '../automation/codeGraphBuilder';
import { CommunicationGraphBuilder } from '../automation/communicationGraphBuilder';

suite('Contract List Loader', () => {
    test('removes duplicate contracts', () => {
        const contracts: ContractEntry[] = [
            { address: '0x1234567890123456789012345678901234567890', blockchain: 'ethereum', contract_name: 'Token', protocol: 'test' },
            { address: '0x1234567890123456789012345678901234567890', blockchain: 'ethereum', contract_name: 'Token', protocol: 'test' },
            { address: '0x0987654321098765432109876543210987654321', blockchain: 'ethereum', contract_name: 'Other', protocol: 'test' }
        ];
        
        const unique = removeDuplicates(contracts);
        assert.strictEqual(unique.length, 2);
    });
    
    test('filters by blockchain', () => {
        const contracts: ContractEntry[] = [
            { address: '0x1234567890123456789012345678901234567890', blockchain: 'ethereum', contract_name: 'Token', protocol: 'test' },
            { address: '0x0987654321098765432109876543210987654321', blockchain: 'bnb', contract_name: 'Token', protocol: 'test' }
        ];
        
        const filtered = filterContractsByBlockchain(contracts, 'ethereum');
        assert.strictEqual(filtered.length, 1);
        assert.strictEqual(filtered[0].blockchain, 'ethereum');
    });
    
    test('filters by protocol', () => {
        const contracts: ContractEntry[] = [
            { address: '0x1234567890123456789012345678901234567890', blockchain: 'ethereum', contract_name: 'Token', protocol: 'aave' },
            { address: '0x0987654321098765432109876543210987654321', blockchain: 'ethereum', contract_name: 'Token', protocol: 'uniswap' }
        ];
        
        const filtered = filterContractsByProtocol(contracts, 'aave');
        assert.strictEqual(filtered.length, 1);
        assert.strictEqual(filtered[0].protocol, 'aave');
    });
    
    test('gets contract list stats', () => {
        const contracts: ContractEntry[] = [
            { address: '0x1234567890123456789012345678901234567890', blockchain: 'ethereum', contract_name: 'Token', protocol: 'aave' },
            { address: '0x0987654321098765432109876543210987654321', blockchain: 'bnb', contract_name: 'Token', protocol: 'uniswap' }
        ];
        
        const stats = getContractListStats(contracts);
        assert.strictEqual(stats.totalContracts, 2);
        assert.strictEqual(stats.uniqueContracts, 2);
        assert.strictEqual(stats.protocols, 2);
        assert.strictEqual(stats.blockchains, 2);
    });
});

suite('ABI Extractor', () => {
    test('extracts function signatures', () => {
        const abi: ABIItem[] = [
            { type: 'function', name: 'transfer', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable' }
        ];
        
        const signatures = extractFunctionSignatures(abi);
        assert.strictEqual(signatures.length, 1);
        assert.ok(signatures[0].includes('transfer'));
    });
    
    test('extracts event signatures', () => {
        const abi: ABIItem[] = [
            { type: 'event', name: 'Transfer', inputs: [{ name: 'from', type: 'address', indexed: true }, { name: 'to', type: 'address', indexed: true }, { name: 'value', type: 'uint256' }] }
        ];
        
        const events = extractEventSignatures(abi);
        assert.strictEqual(events.length, 1);
        assert.ok(events[0].includes('Transfer'));
    });
    
    test('detects ERC20 contracts', () => {
        const erc20Abi: ABIItem[] = [
            { type: 'function', name: 'name' },
            { type: 'function', name: 'symbol' },
            { type: 'function', name: 'decimals' },
            { type: 'function', name: 'totalSupply' },
            { type: 'function', name: 'balanceOf' },
            { type: 'function', name: 'transfer' },
            { type: 'function', name: 'approve' },
            { type: 'function', name: 'allowance' },
            { type: 'function', name: 'transferFrom' }
        ];
        
        assert.strictEqual(isERC20(erc20Abi), true);
    });
    
    test('detects ERC721 contracts', () => {
        const erc721Abi: ABIItem[] = [
            { type: 'function', name: 'balanceOf' },
            { type: 'function', name: 'ownerOf' },
            { type: 'function', name: 'safeTransferFrom' },
            { type: 'function', name: 'transferFrom' },
            { type: 'function', name: 'approve' },
            { type: 'function', name: 'getApproved' },
            { type: 'function', name: 'setApprovalForAll' },
            { type: 'function', name: 'isApprovedForAll' }
        ];
        
        assert.strictEqual(isERC721(erc721Abi), true);
    });
    
    test('detects proxy contracts', () => {
        const proxyAbi: ABIItem[] = [
            { type: 'function', name: 'implementation' },
            { type: 'function', name: 'upgradeTo' }
        ];
        
        assert.strictEqual(detectProxyPattern(proxyAbi), true);
    });
    
    test('extracts inheritance from source', () => {
        const source = 'contract MyToken is ERC20, Ownable { }';
        const inheritance = extractInheritance(source);
        
        assert.ok(inheritance.includes('ERC20'));
        assert.ok(inheritance.includes('Ownable'));
    });
    
    test('extracts imports from source', () => {
        const source = `
            import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
            import { Ownable } from "./Ownable.sol";
        `;
        const imports = extractImports(source);
        
        assert.ok(imports.length >= 1);
    });
});

suite('Code Graph Builder', () => {
    test('builds graph from contracts', () => {
        const contracts: FetchedContract[] = [
            {
                address: '0x1234567890123456789012345678901234567890',
                blockchain: 'ethereum',
                chainId: '1',
                contractName: 'Token',
                protocol: 'test',
                sourceCode: '',
                abi: [],
                fetchedAt: new Date().toISOString(),
                sources: [{ filename: 'Token.sol', content: 'contract Token { }' }]
            }
        ];
        
        const builder = new CodeGraphBuilder();
        builder.addContracts(contracts);
        const graph = builder.build();
        
        assert.strictEqual(graph.nodes.length, 1);
        assert.strictEqual(graph.metadata.totalContracts, 1);
    });
    
    test('creates same_protocol edges', () => {
        const contracts: FetchedContract[] = [
            {
                address: '0x1234567890123456789012345678901234567890',
                blockchain: 'ethereum',
                chainId: '1',
                contractName: 'Token1',
                protocol: 'test',
                sourceCode: '',
                abi: [],
                fetchedAt: new Date().toISOString(),
                sources: []
            },
            {
                address: '0x0987654321098765432109876543210987654321',
                blockchain: 'ethereum',
                chainId: '1',
                contractName: 'Token2',
                protocol: 'test',
                sourceCode: '',
                abi: [],
                fetchedAt: new Date().toISOString(),
                sources: []
            }
        ];
        
        const builder = new CodeGraphBuilder();
        builder.addContracts(contracts);
        const graph = builder.build();
        
        const sameProtocolEdges = graph.edges.filter(e => e.relationshipType === 'same_protocol');
        assert.ok(sameProtocolEdges.length > 0);
    });
    
    test('exports to GraphML', () => {
        const contracts: FetchedContract[] = [
            {
                address: '0x1234567890123456789012345678901234567890',
                blockchain: 'ethereum',
                chainId: '1',
                contractName: 'Token',
                protocol: 'test',
                sourceCode: '',
                abi: [],
                fetchedAt: new Date().toISOString(),
                sources: []
            }
        ];
        
        const builder = new CodeGraphBuilder();
        builder.addContracts(contracts);
        const graphml = builder.toGraphML();
        
        assert.ok(graphml.includes('<?xml'));
        assert.ok(graphml.includes('<graphml'));
        assert.ok(graphml.includes('0x1234567890123456789012345678901234567890'));
    });
});

suite('Communication Graph Builder', () => {
    test('builds communication graph', () => {
        const contracts: FetchedContract[] = [
            {
                address: '0x1234567890123456789012345678901234567890',
                blockchain: 'ethereum',
                chainId: '1',
                contractName: 'Token',
                protocol: 'test',
                sourceCode: '',
                abi: [
                    { type: 'function', name: 'transfer' },
                    { type: 'function', name: 'approve' },
                    { type: 'function', name: 'balanceOf' }
                ],
                fetchedAt: new Date().toISOString(),
                sources: []
            }
        ];
        
        const builder = new CommunicationGraphBuilder();
        builder.addContracts(contracts);
        const graph = builder.build();
        
        assert.strictEqual(graph.nodes.length, 1);
        assert.strictEqual(graph.nodes[0].role, 'token');
    });
    
    test('detects contract roles', () => {
        const dexContract: FetchedContract = {
            address: '0x1234567890123456789012345678901234567890',
            blockchain: 'ethereum',
            chainId: '1',
            contractName: 'Router',
            protocol: 'uniswap',
            sourceCode: '',
            abi: [
                { type: 'function', name: 'swapExactTokensForTokens' },
                { type: 'function', name: 'addLiquidity' }
            ],
            fetchedAt: new Date().toISOString(),
            sources: []
        };
        
        const builder = new CommunicationGraphBuilder();
        builder.addContracts([dexContract]);
        const graph = builder.build();
        
        // Router with swap functions should be detected as dex or router
        assert.ok(['dex', 'router'].includes(graph.nodes[0].role));
    });
    
    test('exports to D3 format', () => {
        const contracts: FetchedContract[] = [
            {
                address: '0x1234567890123456789012345678901234567890',
                blockchain: 'ethereum',
                chainId: '1',
                contractName: 'Token',
                protocol: 'test',
                sourceCode: '',
                abi: [],
                fetchedAt: new Date().toISOString(),
                sources: []
            }
        ];
        
        const builder = new CommunicationGraphBuilder();
        builder.addContracts(contracts);
        const d3 = builder.toD3Format();
        
        assert.ok(Array.isArray(d3.nodes));
        assert.ok(Array.isArray(d3.links));
        assert.strictEqual(d3.nodes.length, 1);
    });
});

suite('Types', () => {
    test('has correct chain ID mappings', () => {
        assert.strictEqual(CHAIN_ID_MAP['ethereum'], '1');
        assert.strictEqual(CHAIN_ID_MAP['bnb'], '56');
        assert.strictEqual(CHAIN_ID_MAP['polygon'], '137');
        assert.strictEqual(CHAIN_ID_MAP['arbitrum'], '42161');
    });
});
