type LogLevel = 'info' | 'warn' | 'error';

function log(level: LogLevel, fields: Record<string, unknown>): void {
  const entry = { level, timestamp: new Date().toISOString(), ...fields };
  if (level === 'error') console.error(JSON.stringify(entry));
  else if (level === 'warn') console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

export const logger = {
  info:  (fields: Record<string, unknown>) => log('info',  fields),
  warn:  (fields: Record<string, unknown>) => log('warn',  fields),
  error: (fields: Record<string, unknown>) => log('error', fields),
};
