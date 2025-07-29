/**
 * Simple logging utility for consistent error handling
 * Replace console.* calls with proper logging in production
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  
  private log(level: LogLevel, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    if (this.isDevelopment) {
      // In development, still use console for immediate feedback
      console[level === 'debug' ? 'log' : level](prefix, message, data || '');
    } else {
      // In production, you would integrate with a proper logging service
      // For now, only log errors and warnings to console
      if (level === 'error' || level === 'warn') {
        console[level](prefix, message, data || '');
      }
    }
  }
  
  debug(message: string, data?: any) {
    this.log('debug', message, data);
  }
  
  info(message: string, data?: any) {
    this.log('info', message, data);
  }
  
  warn(message: string, data?: any) {
    this.log('warn', message, data);
  }
  
  error(message: string, error?: any) {
    this.log('error', message, error);
  }
}

export const logger = new Logger();