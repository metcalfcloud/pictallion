
interface LogLevel {
}

const LOG_LEVELS: LogLevel = {
};

class Logger {
  private level: number = LOG_LEVELS.INFO;

  constructor() {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    if (envLevel && envLevel in LOG_LEVELS) {
      this.level = LOG_LEVELS[envLevel as keyof LogLevel];
    }
  }

  private log(level: keyof LogLevel, message: string, ...args: any[]) {
    if (LOG_LEVELS[level] <= this.level) {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [${level}]`;
      console.log(prefix, message, ...args);
    }
  }

  error(message: string, ...args: any[]) {
    this.log('ERROR', message, ...args);
  }

  warn(message: string, ...args: any[]) {
    this.log('WARN', message, ...args);
  }

  info(message: string, ...args: any[]) {
    this.log('INFO', message, ...args);
  }

  debug(message: string, ...args: any[]) {
    this.log('DEBUG', message, ...args);
  }
}

export const logger = new Logger();
