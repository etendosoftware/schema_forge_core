import { createHash } from 'node:crypto';

export function computeChecksum(data) {
  return createHash('sha256')
    .update(typeof data === 'string' ? data : JSON.stringify(data))
    .digest('hex')
    .substring(0, 8);
}

export function generateVersion() {
  return '0.1.0';
}

export function toCamelCase(columnName) {
  // Split on underscores first
  const underscoreParts = columnName.split('_').filter(Boolean);

  // Split each part on PascalCase boundaries (e.g. DocumentNo -> Document, No)
  const words = underscoreParts.flatMap((part) =>
    part.replace(/([a-z])([A-Z])/g, '$1_$2').split('_')
  );

  // Join as camelCase: first word lowercase, rest capitalized
  return words
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i === 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}
