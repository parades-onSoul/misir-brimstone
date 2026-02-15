/**
 * Lightweight structured logger for Misir Extension
 * 
 * Features:
 * - Log levels (debug, info, warn, error)
 * - Namespaced logging for different modules
 * - Timestamp prefixes
 * - Collapsible groups for complex objects
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
    namespace: string;
    minLevel?: LogLevel;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
    debug: '#6B7280', // gray
    info: '#3B82F6',  // blue
    warn: '#F59E0B',  // amber
    error: '#EF4444', // red
};

class Logger {
    private namespace: string;
    private minLevel: LogLevel;

    constructor(config: LoggerConfig) {
        this.namespace = config.namespace;
        this.minLevel = config.minLevel || 'info';
    }

    private shouldLog(level: LogLevel): boolean {
        return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.minLevel];
    }

    private formatMessage(level: LogLevel, message: string): string {
        const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
        return `[${timestamp}] [${this.namespace}] ${message}`;
    }

    private log(level: LogLevel, message: string, ...args: any[]): void {
        if (!this.shouldLog(level)) return;

        const formattedMessage = this.formatMessage(level, message);
        const color = LEVEL_COLORS[level];

        const consoleMethod = level === 'debug' ? 'log' : level;

        console[consoleMethod](
            `%c${formattedMessage}`,
            `color: ${color}; font-weight: ${level === 'error' || level === 'warn' ? 'bold' : 'normal'}`,
            ...args
        );
    }

    debug(message: string, ...args: any[]): void {
        this.log('debug', message, ...args);
    }

    info(message: string, ...args: any[]): void {
        this.log('info', message, ...args);
    }

    warn(message: string, ...args: any[]): void {
        this.log('warn', message, ...args);
    }

    error(message: string, ...args: any[]): void {
        this.log('error', message, ...args);
    }

    /**
     * Log a group with collapsible details
     */
    group(title: string, level: LogLevel = 'info', fn: () => void): void {
        if (!this.shouldLog(level)) return;

        const formattedTitle = this.formatMessage(level, title);
        console.group(formattedTitle);
        fn();
        console.groupEnd();
    }

    /**
     * Log a collapsed group
     */
    groupCollapsed(title: string, level: LogLevel = 'info', fn: () => void): void {
        if (!this.shouldLog(level)) return;

        const formattedTitle = this.formatMessage(level, title);
        console.groupCollapsed(formattedTitle);
        fn();
        console.groupEnd();
    }
}

/**
 * Create a logger for a specific namespace
 */
export function createLogger(namespace: string, minLevel?: LogLevel): Logger {
    return new Logger({ namespace, minLevel });
}

/**
 * Pre-configured loggers for common use cases
 */
export const loggers = {
    background: createLogger('Background', 'info'),
    capture: createLogger('Capture', 'info'),
    queue: createLogger('Queue', 'info'),
    navigation: createLogger('Navigation', 'debug'),
    storage: createLogger('Storage', 'debug'),
    api: createLogger('API', 'info'),
    content: createLogger('Content', 'info'),
};
