const ALPHA_TOKENS = new Set([
  'arcane-judge-7k2m',
  'arcane-judge-9p4q',
  'test-token' // For us to test
]);

export function isJudgeEnabled(): boolean {
  const token = localStorage.getItem('mtg-judge-alpha-token');
  return token !== null && ALPHA_TOKENS.has(token);
}

export function setAlphaToken(token: string): boolean {
  if (ALPHA_TOKENS.has(token)) {
    localStorage.setItem('mtg-judge-alpha-token', token);
    return true;
  }
  return false;
}

export function getAlphaToken(): string | null {
  return localStorage.getItem('mtg-judge-alpha-token');
}

export function getDeviceId(): string {
  let id = localStorage.getItem('mtg-device-id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('mtg-device-id', id);
  }
  return id;
}
