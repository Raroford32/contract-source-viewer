# Contract Source Viewer

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/junaire.contract-source-viewer?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=junaire.contract-source-viewer)
[![Visual Studio Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/junaire.contract-source-viewer?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=junaire.contract-source-viewer)
[![License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)

A simple VSCode extension that allows you to fetch and view smart contract source code directly from blockchain explorers. Perfect for developers, auditors, and anyone working with smart contracts.

![Demo](images/demo.gif)

## ✨ Features

- 🔍 **Multi-Chain Support**: Fetch contracts from 8 major blockchains
- 📄 **Smart Parsing**: Handles both single-file and multi-file Solidity contracts
- 🎨 **Syntax Highlighting**: Full Solidity syntax highlighting with VSCode's built-in support
- 📁 **Project Structure**: Automatically creates proper folder structure for complex contracts
- ⚡ **Fast & Reliable**: Quick fetching with proper error handling
- ✅ **Input Validation**: Validates chain IDs and contract addresses
- 🔄 **Real-time Progress**: Progress indicators for all operations
- 🤖 **Batch Automation**: Fetch thousands of contracts automatically
- 📊 **Graph Building**: Build code and communication relationship graphs

## 🚀 Quick Start

1. **Install** the extension from VSCode Marketplace
2. **Open Command Palette** (`Cmd+Shift+P` on Mac, `Ctrl+Shift+P` on Windows/Linux)
3. **Search** for "Fetch Contract Source Code"
4. **Select blockchain** from the dropdown
5. **Enter contract address** (0x...)
6. **View source code** in a new VSCode window

## 🌐 Supported Networks

| Network | Chain ID | Example Contract |
|---------|----------|------------------|
| **Ethereum** | 1 | `0xA0b86a33E6a5a5d7a2f...` |
| **BSC** | 56 | `0xD89C46F8ee42d3078E6...` |
| **Polygon** | 137 | `0x8f3Cf7ad23Cd3CaDbD9...` |
| **Arbitrum** | 42161 | `0x912CE59144191C1204E...` |
| **Optimism** | 10 | `0x4200000000000000000...` |
| **Base** | 8453 | `0x833589fCD6eDb6E08f4...` |
| **Avalanche** | 43114 | `0xB31f66AA3C1e785363F...` |
| **Fantom** | 250 | `0x21be370D5312f44cB42...` |

## 🤖 Batch Automation

This project includes a powerful automation system for fetching large numbers of contracts and building relationship graphs.

### Quick Start

```bash
# Fetch all contracts from Ethereum and BNB chains
npm run automation:fetch

# Or run with custom options
npm run automation -- -i all_ethereum_contracts.json -o ./output --limit 100
```

### CLI Options

```
Usage: npm run automation -- [options]

Options:
  -i, --input <file>       Input JSON file(s) with contract list
  -o, --output <dir>       Output directory (default: ./contract_data)
  -b, --blockchain <name>  Filter by blockchain (e.g., ethereum, bnb)
  -p, --protocol <name>    Filter by protocol
  --batch-size <n>         Number of contracts per batch (default: 10)
  --delay <ms>             Delay between requests in ms (default: 200)
  --batch-delay <ms>       Delay between batches in ms (default: 2000)
  --retries <n>            Max retries per contract (default: 3)
  --resume <n>             Resume from contract index
  --limit <n>              Limit number of contracts to process
  --skip-fetch             Skip fetching, use existing data
  --no-graphs              Skip graph generation
  --save-sources           Save individual source files
  -q, --quiet              Reduce output verbosity
  -h, --help               Show help message
```

### Examples

```bash
# Fetch only AAVE protocol contracts
npm run automation -- -i all_ethereum_contracts.json -p aave

# Resume from index 1000 after interruption
npm run automation -- -i all_ethereum_contracts.json --resume 1000

# Build graphs from existing fetched data
npm run automation -- --skip-fetch -o ./existing_data

# Fetch first 500 Ethereum contracts with source files
npm run automation -- -i all_ethereum_contracts.json --limit 500 --save-sources
```

### Input File Format

The automation expects JSON files with contract entries in this format:

```json
[
  {
    "address": "0x1234567890123456789012345678901234567890",
    "blockchain": "ethereum",
    "contract_name": "MyToken",
    "protocol": "my_protocol"
  }
]
```

### Output Files

The automation generates several output files:

- `contracts.json` - All fetched contract data with source code and ABIs
- `code_graph.json` - Code relationship graph (inheritance, imports, calls)
- `code_graph.graphml` - GraphML format for visualization tools
- `code_graph_d3.json` - D3.js compatible format
- `communication_graph.json` - Contract communication patterns
- `communication_graph_d3.json` - D3.js format for communication graph
- `summary_report.json` - Statistics and summary

### Graph Types

#### Code Graph
Shows structural relationships between contracts:
- **inherits** - Contract A inherits from Contract B
- **imports** - Contract A imports Contract B
- **calls** - Contract A calls functions on Contract B
- **uses_interface** - Contract A uses interface from Contract B
- **same_protocol** - Contracts in the same protocol

#### Communication Graph
Shows runtime interaction patterns:
- **token_transfer** - ERC20/721/1155 token transfers
- **swap** - DEX swap operations
- **liquidity** - Add/remove liquidity
- **lending** - Lending/borrowing operations
- **oracle** - Price feed queries
- **governance** - Governance voting
- And more...

### Programmatic Usage

```typescript
import { 
  loadContractsFromFile,
  BatchContractFetcher,
  CodeGraphBuilder,
  CommunicationGraphBuilder,
  DataPersistence 
} from './src/automation';

// Load contracts
const contracts = loadContractsFromFile('all_ethereum_contracts.json');

// Fetch source code and ABIs
const fetcher = new BatchContractFetcher({ batchSize: 10 });
const fetchedContracts = await fetcher.fetchAll(contracts);

// Build code graph
const codeBuilder = new CodeGraphBuilder();
codeBuilder.addContracts(fetchedContracts);
const codeGraph = codeBuilder.build();

// Build communication graph
const commBuilder = new CommunicationGraphBuilder();
commBuilder.addContracts(fetchedContracts);
const commGraph = commBuilder.build();

// Save results
const persistence = new DataPersistence('./output');
persistence.saveCodeGraph(codeGraph);
persistence.saveCommunicationGraph(commGraph);
```

### Development Setup
```bash
# Clone repository
git clone https://github.com/junaire/contract-source-viewer.git
cd contract-source-viewer

# Install dependencies
npm install

# Compile
npm run compile

# Run in development mode
# Press F5 in VSCode to launch Extension Development Host
```

## 🤝 Contributing

We welcome contributions!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Bug Reports & Feature Requests

Please use the [GitHub Issues](https://github.com/junaire/contract-source-viewer/issues) page to:
- Report bugs
- Request new features
- Ask questions

## ⭐ Show Your Support

If you find this extension helpful, please:
- ⭐ Star the repository
- 📝 Leave a review on VSCode Marketplace
- 🐦 Share with your network

---

**Made with ❤️ by [Jun Zhang (junaire)](https://github.com/junaire)**
