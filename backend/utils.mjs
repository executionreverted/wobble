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
