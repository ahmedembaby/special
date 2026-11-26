export interface ScryptOpts { N: number; r: number; p: number; dkLen?: number; maxmem?: number; asyncTick?: number; onProgress?: (progress: number) => void }
export function scrypt(password: Uint8Array, salt: Uint8Array, opts: ScryptOpts): Uint8Array;
export function scryptAsync(password: Uint8Array, salt: Uint8Array, opts: ScryptOpts): Promise<Uint8Array>;
