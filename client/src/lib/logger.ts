export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  data?: any;
}

export class ClientLogger {
  private static instance: ClientLogger;
  private level: LogLevel;
  private isProduction: boolean;

  private constructor() {
    this.isProduction = import.meta.env.PROD;
    this.level = this.isProduction ? 'warn' : 'debug';
  }

  public static getInstance(): ClientLogger {
    if (!ClientLogger.instance) {
      ClientLogger.instance = new ClientLogger();
    }
    return ClientLogger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private formatMessage(level: LogLevel, message: string, context?: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? `[${context}]` : '';
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    
    if (this.isProduction) {
      // Structured logging for production
      return JSON.stringify({
        timestamp,
        level,
        message,
        context,
        data
      });
    } else {
      // Human-readable logging for development
      const time = new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      return `${time} ${contextStr} [${level.toUpperCase()}] ${message}${dataStr}`;
    }
  }

  public debug(message: string, context?: string, data?: any): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, context, data));
    }
  }

  public info(message: string, context?: string, data?: any): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, context, data));
    }
  }

  public warn(message: string, context?: string, data?: any): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, context, data));
    }
  }

  public error(message: string, context?: string, data?: any): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, context, data));
    }
  }

  // Legacy console.log replacement
  public log(message: string, context?: string, data?: any): void {
    this.info(message, context, data);
  }

  public setLevel(level: LogLevel): void {
    this.level = level;
  }
}

// Export singleton instance
export const logger = ClientLogger.getInstance();

// Export convenience functions for easy migration
export const log = (message: string, context?: string, data?: any) => logger.log(message, context, data);
export const debug = (message: string, context?: string, data?: any) => logger.debug(message, context, data);
export const info = (message: string, context?: string, data?: any) => logger.info(message, context, data);
export const warn = (message: string, context?: string, data?: any) => logger.warn(message, context, data);
export const error = (message: string, context?: string, data?: any) => logger.error(message, context, data);