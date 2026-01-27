import { DefaultNamingStrategy, NamingStrategyInterface, Table } from 'typeorm';

/**
 * TypeORM naming strategy that converts camelCase entity/column names to snake_case
 * for PostgreSQL compatibility with existing production database schema.
 */
export class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
    tableName(targetName: string, userSpecifiedName: string | undefined): string {
        return userSpecifiedName || this.toSnakeCase(targetName);
    }

    columnName(propertyName: string, customName: string | undefined, embeddedPrefixes: string[]): string {
        return customName || this.toSnakeCase([...embeddedPrefixes, propertyName].join('_'));
    }

    relationName(propertyName: string): string {
        return this.toSnakeCase(propertyName);
    }

    joinColumnName(relationName: string, referencedColumnName: string): string {
        return this.toSnakeCase(relationName + '_' + referencedColumnName);
    }

    joinTableName(firstTableName: string, secondTableName: string, firstPropertyName: string, secondPropertyName: string): string {
        return this.toSnakeCase(firstTableName + '_' + firstPropertyName.replace(/\./gi, '_') + '_' + secondTableName);
    }

    joinTableColumnName(tableName: string, propertyName: string, columnName?: string): string {
        return this.toSnakeCase(tableName + '_' + (columnName || propertyName));
    }

    classTableInheritanceParentColumnName(parentTableName: any, parentTableIdPropertyName: any): string {
        return this.toSnakeCase(parentTableName + '_' + parentTableIdPropertyName);
    }

    private toSnakeCase(str: string): string {
        return str
            .replace(/\.?([A-Z]+)/g, (x, y) => '_' + y.toLowerCase())
            .replace(/^_/, '');
    }
}
