import { DataSource } from 'typeorm';

/**
 * Database utilities for handling PostgreSQL/SQLite dialect differences.
 * 
 * PostgreSQL is used in production (Railway), SQLite in development.
 */

/**
 * Check if the current database is PostgreSQL
 */
export function isPostgres(dataSource: DataSource): boolean {
    return dataSource.options.type === 'postgres';
}

/**
 * Get the current timestamp function for the database dialect
 */
export function getNowFunction(isPostgres: boolean): string {
    return isPostgres ? 'NOW()' : "datetime('now')";
}

/**
 * Get the date interval expression for filtering recent records
 * @param days Number of days to look back
 */
export function getDateInterval(isPostgres: boolean, days: number): string {
    return isPostgres
        ? `NOW() - INTERVAL '${days} days'`
        : `datetime('now', '-${days} days')`;
}

/**
 * Build a parameterized query with the correct placeholder syntax
 * PostgreSQL uses $1, $2, etc. SQLite uses ?
 */
export function buildParams(isPostgres: boolean, count: number): string[] {
    if (isPostgres) {
        return Array.from({ length: count }, (_, i) => `$${i + 1}`);
    }
    return Array(count).fill('?');
}

/**
 * Get the INSERT ... ON CONFLICT syntax for upserts
 */
export function getUpsertQuery(
    isPostgres: boolean,
    table: string,
    columns: string[],
    conflictColumns: string[],
    paramCount: number
): string {
    const params = buildParams(isPostgres, paramCount);
    const columnsStr = columns.join(', ');
    const valuesStr = params.join(', ');
    const conflictStr = conflictColumns.join(', ');

    if (isPostgres) {
        return `INSERT INTO ${table} (${columnsStr}) VALUES (${valuesStr}) ON CONFLICT (${conflictStr}) DO NOTHING`;
    }
    return `INSERT OR IGNORE INTO ${table} (${columnsStr}) VALUES (${valuesStr})`;
}

/**
 * Get the CAST syntax for converting types
 */
export function castAs(isPostgres: boolean, expression: string, type: 'TEXT' | 'INTEGER'): string {
    if (isPostgres) {
        const pgType = type === 'TEXT' ? 'text' : 'integer';
        return `${expression}::${pgType}`;
    }
    return `CAST(${expression} AS ${type})`;
}

/**
 * Helper class that holds dialect information and provides query building methods
 */
export class DbDialect {
    public readonly isPostgres: boolean;
    private paramIndex = 0;

    constructor(dataSource: DataSource) {
        this.isPostgres = isPostgres(dataSource);
    }

    /**
     * Get the next parameter placeholder and increment the counter
     */
    param(): string {
        this.paramIndex++;
        return this.isPostgres ? `$${this.paramIndex}` : '?';
    }

    /**
     * Reset parameter counter (call before building a new query)
     */
    reset(): this {
        this.paramIndex = 0;
        return this;
    }

    /**
     * Get current timestamp function
     */
    now(): string {
        return getNowFunction(this.isPostgres);
    }

    /**
     * Get date interval for filtering
     */
    interval(days: number): string {
        return getDateInterval(this.isPostgres, days);
    }

    /**
     * Build CAST expression
     */
    cast(expr: string, type: 'TEXT' | 'INTEGER'): string {
        return castAs(this.isPostgres, expr, type);
    }

    /**
     * Build upsert query
     */
    upsert(table: string, columns: string[], conflictColumns: string[]): string {
        const params = columns.map(() => this.param());
        const columnsStr = columns.join(', ');
        const valuesStr = params.join(', ');
        const conflictStr = conflictColumns.join(', ');

        if (this.isPostgres) {
            return `INSERT INTO ${table} (${columnsStr}) VALUES (${valuesStr}) ON CONFLICT (${conflictStr}) DO NOTHING`;
        }
        return `INSERT OR IGNORE INTO ${table} (${columnsStr}) VALUES (${valuesStr})`;
    }
}
