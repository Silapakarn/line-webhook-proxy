const SECRET_KEY = process.env.CRYPTO_SECRET_KEY || 'secret';

export function encryptData(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length));
  }
  return Buffer.from(result).toString('base64');
}

export function decryptData(encrypted: string): string {
  const text = Buffer.from(encrypted, 'base64').toString();
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length));
  }
  return result;
}
