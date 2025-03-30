export const sanitizeTextForTerminal = (text) => {
  if (!text) return '';

  return text
    // Replace tabs with visible indicators
    .replace(/\t/g, '→   ')
    // Handle carriage returns
    .replace(/\r/g, '␍')
    .replace(/\n/, '␍')
    .replace(/\n/g, '↵')

    // Strip ANSI color/control sequences
    .replace(/\u001b\[\d+(;\d+)*m/g, '')

    // Replace null bytes
    .replace(/\0/g, '␀')

    // Replace non-printable control characters
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, (c) => {
      if (c === '\n') return c; // Keep newlines
      return `␛${c.charCodeAt(0).toString(16).padStart(2, '0')}`;
    })

    // Replace unicode "replacement character" that appears for invalid sequences
    .replace(/\uFFFD/g, '�');
};


// Utility function to generate a UUID since crypto.randomUUID might not be available
export function generateUUID() {
  // Create random bytes
  const randomBytes = crypto.randomBytes(16);

  // Set version bits (Version 4 = random UUID)
  randomBytes[6] = (randomBytes[6] & 0x0f) | 0x40; // Version 4
  randomBytes[8] = (randomBytes[8] & 0x3f) | 0x80; // Variant

  // Convert to hex string with dashes
  const hexString = b4a.toString(randomBytes, 'hex');
  return [
    hexString.substring(0, 8),
    hexString.substring(8, 12),
    hexString.substring(12, 16),
    hexString.substring(16, 20),
    hexString.substring(20, 32)
  ].join('-');
}
