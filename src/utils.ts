/**
 * Shared utility functions for the contract source viewer
 */

/**
 * Ethereum address validation regex pattern
 * Matches addresses in the format: 0x followed by 40 hexadecimal characters
 */
export const ETHEREUM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

/**
 * Validate an Ethereum-style address
 * @param address The address to validate
 * @returns true if the address is valid, false otherwise
 */
export function isValidAddress(address: string): boolean {
    if (!address) {
        return false;
    }
    return ETHEREUM_ADDRESS_PATTERN.test(address);
}

/**
 * Normalize an Ethereum address (lowercase, trimmed)
 * @param address The address to normalize
 * @returns The normalized address
 */
export function normalizeAddress(address: string): string {
    return address.toLowerCase().trim();
}

/**
 * Validate and return an error message if invalid
 * @param address The address to validate
 * @returns Error message if invalid, null if valid
 */
export function validateAddressWithMessage(address: string): string | null {
    if (!address) {
        return 'Address cannot be empty';
    }
    if (!ETHEREUM_ADDRESS_PATTERN.test(address)) {
        return 'Please enter a valid Ethereum address (0x followed by 40 hex characters)';
    }
    return null;
}
