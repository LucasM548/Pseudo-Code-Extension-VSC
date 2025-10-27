/**
 * Gestion des types composites (structures personnalisées)
 */

import { PATTERNS } from './constants';
import { smartSplitArgs, findMatchingParen } from './utils';

export interface CompositeField {
    name: string;
    type: string;
}

export interface CompositeType {
    name: string;
    fields: CompositeField[];
}

/**
 * Registre global des types composites
 */
export class CompositeTypeRegistry {
    private types = new Map<string, CompositeType>();

    /**
     * Collecte tous les types composites du code source
     */
    collect(pscCode: string): void {
        this.types.clear();
        const lines = pscCode.split('\n');

        for (const line of lines) {
            const trimmedLine = line.trim();
            const match = PATTERNS.COMPOSITE_TYPE.exec(trimmedLine);

            if (match) {
                const typeName = match[1];
                const fieldsStr = match[2];
                const fields: CompositeField[] = [];

                const fieldParts = fieldsStr.split(',');
                for (const fieldPart of fieldParts) {
                    const fieldMatch = PATTERNS.COMPOSITE_FIELD.exec(fieldPart.trim());
                    if (fieldMatch) {
                        fields.push({
                            name: fieldMatch[1],
                            type: fieldMatch[2].trim()
                        });
                    }
                }

                // Stocker avec clé en minuscules pour recherche insensible à la casse
                this.types.set(typeName.toLowerCase(), { name: typeName, fields });
            }
        }
    }

    /**
     * Récupère un type composite par son nom
     */
    get(typeName: string): CompositeType | undefined {
        return this.types.get(typeName.toLowerCase());
    }

    /**
     * Vérifie si un type existe
     */
    has(typeName: string): boolean {
        return this.types.has(typeName.toLowerCase());
    }

    /**
     * Trouve un type composite correspondant au nombre de champs
     */
    findByFieldCount(fieldCount: number): CompositeType | undefined {
        for (const type of this.types.values()) {
            if (type.fields.length === fieldCount) {
                return type;
            }
        }
        return undefined;
    }

    /**
     * Transforme les constructeurs de types composites en tables Lua
     * TypeName(val1, val2) -> {field1 = val1, field2 = val2}
     */
    transformConstructors(expression: string): string {
        let result = expression;
        let changed = true;

        // Répéter pour gérer les constructeurs imbriqués
        while (changed) {
            changed = false;

            for (const compositeType of this.types.values()) {
                const typeName = compositeType.name;
                const regex = new RegExp(`\\b${typeName}\\s*\\(`, 'gi');
                let match: RegExpExecArray | null;

                while ((match = regex.exec(result)) !== null) {
                    const startPos = match.index;
                    const openParenPos = match.index + match[0].length - 1;
                    const closeParenPos = findMatchingParen(result, openParenPos);

                    if (closeParenPos !== -1) {
                        const argsStr = result.substring(openParenPos + 1, closeParenPos);
                        const args = smartSplitArgs(argsStr);

                        const fieldAssignments = compositeType.fields.map((field, index) => {
                            const value = args[index] || 'nil';
                            return `${field.name} = ${value}`;
                        });

                        const replacement = `__PSC_TABLE_START__{${fieldAssignments.join(', ')}}__PSC_TABLE_END__`;
                        result = result.substring(0, startPos) + replacement + result.substring(closeParenPos + 1);

                        changed = true;
                        break;
                    }
                }

                if (changed) break;
            }
        }

        return result;
    }

    /**
     * Transforme les littéraux <val1, val2> en tables Lua
     */
    transformLiterals(expression: string): string {
        return expression.replace(PATTERNS.COMPOSITE_LITERAL, (match, content) => {
            const trimmedContent = content.trim();

            // Vérifier si c'est un littéral de structure
            if (trimmedContent.includes(',') ||
                trimmedContent.match(/^["'{]/) ||
                trimmedContent.match(/^\w+\s*\(/)) {

                const args = smartSplitArgs(content);
                const matchingType = this.findByFieldCount(args.length);

                if (matchingType) {
                    // Table avec champs nommés
                    const fieldAssignments = matchingType.fields.map((field, index) => {
                        const value = args[index] || 'nil';
                        return `${field.name} = ${value}`;
                    });
                    return `__PSC_TABLE_START__{${fieldAssignments.join(', ')}}__PSC_TABLE_END__`;
                }

                // Table avec indices numériques
                return `__PSC_TABLE_START__{${content}}__PSC_TABLE_END__`;
            }

            return match; // Pas un littéral
        });
    }

    /**
     * Transforme une expression complète (constructeurs + littéraux)
     */
    transform(expression: string): string {
        let result = this.transformConstructors(expression);
        result = this.transformLiterals(result);
        return result;
    }

    /**
     * Nettoie les marqueurs temporaires
     */
    static cleanMarkers(code: string): string {
        return code
            .replace(/__PSC_TABLE_START__/g, '')
            .replace(/__PSC_TABLE_END__/g, '');
    }

    /**
     * Retourne tous les noms de types (en minuscules)
     */
    getAllTypeNames(): Set<string> {
        return new Set(this.types.keys());
    }
}
