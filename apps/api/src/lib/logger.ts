// Logger minimal et centralisé, pour éviter les `console.log` dispersés.

type Level = 'info' | 'warn' | 'error';

function emit(level: Level, message: string, meta?: unknown): void {
  const time = new Date().toISOString();
  const line = `[${time}] [api] [${level.toUpperCase()}] ${message}`;
  if (level === 'error') {
    console.error(line, meta ?? '');
  } else if (level === 'warn') {
    console.warn(line, meta ?? '');
  } else {
    console.info(line, meta ?? '');
  }
}

export const logger = {
  info: (message: string, meta?: unknown) => emit('info', message, meta),
  warn: (message: string, meta?: unknown) => emit('warn', message, meta),
  error: (message: string, meta?: unknown) => emit('error', message, meta),
};
