/**
 * [SOVEREIGN LOGGER] - Dedicated Telemetry & Debugging Utility
 * 
 * Provides centralized logging with level filtering and stylized output.
 * Designed to clear browser console noise while maintaining forensic traceability.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'neural';

class SovereignLogger {
    private isProduction = import.meta.env.PROD;
    private minLevel: LogLevel = 'info';

    private colors = {
        debug: '#7f8c8d',
        info: '#3498db',
        warn: '#f1c40f',
        error: '#e74c3c',
        neural: '#9b59b6'
    };

    setLevel(level: LogLevel) {
        this.minLevel = level;
    }

    private shouldLog(level: LogLevel): boolean {
        const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'neural'];
        return levels.indexOf(level) >= levels.indexOf(this.minLevel);
    }

    log(level: LogLevel, context: string, message: string, ...args: any[]) {
        if (this.isProduction && level === 'debug') return;
        if (!this.shouldLog(level)) return;

        const color = this.colors[level];
        const timestamp = new Date().toLocaleTimeString();
        
        console.log(
            `%c[${timestamp}] [${context.toUpperCase()}] %c${message}`,
            `color: ${color}; font-weight: bold;`,
            `color: inherit; font-weight: normal;`,
            ...args
        );
    }

    debug(context: string, message: string, ...args: any[]) { this.log('debug', context, message, ...args); }
    info(context: string, message: string, ...args: any[]) { this.log('info', context, message, ...args); }
    warn(context: string, message: string, ...args: any[]) { this.log('warn', context, message, ...args); }
    error(context: string, message: string, ...args: any[]) { this.log('error', context, message, ...args); }
    neural(context: string, message: string, ...args: any[]) { this.log('neural', context, message, ...args); }
}

export const Logger = new SovereignLogger();
export default Logger;
