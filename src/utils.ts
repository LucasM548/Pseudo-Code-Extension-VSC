/**
 * Fonctions utilitaires réutilisables
 */

import { TYPE_MAPPING } from './constants';

/**
 * Normalise un type (gère les variantes avec/sans accent)
 */
export function normalizeType(rawType: string): string {
    const normalized = TYPE_MAPPING[rawType.toLowerCase()];
    return normalized || rawType;
}

/**
 * Découpe intelligemment une chaîne d'arguments en tenant compte des parenthèses, crochets et quotes
 */
export function smartSplitArgs(argsStr: string): string[] {
    if (!argsStr.trim()) return [];

    const args: string[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < argsStr.length; i++) {
        const char = argsStr[i];
        const prevChar = argsStr[i - 1];

        if (!inString && (char === '"' || char === "'")) {
            inString = true;
            stringChar = char;
            current += char;
        } else if (inString && char === stringChar && prevChar !== '\\') {
            inString = false;
            current += char;
        } else if (!inString && '([{'.includes(char)) {
            depth++;
            current += char;
        } else if (!inString && ')]}'.includes(char)) {
            depth--;
            current += char;
        } else if (!inString && char === ',' && depth === 0) {
            args.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    if (current.trim()) {
        args.push(current.trim());
    }

    return args;
}

/**
 * Trouve la parenthèse fermante correspondante
 */
export function findMatchingParen(str: string, startPos: number): number {
    let depth = 1;
    for (let i = startPos + 1; i < str.length; i++) {
        if (str[i] === '(') depth++;
        else if (str[i] === ')') {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

/**
 * Nettoie une ligne des commentaires
 */
export function cleanLineFromComments(lineText: string, initialInBlockComment: boolean): { text: string; inBlockComment: boolean } {
    let nonCommentText = '';
    let currentIndex = 0;
    let inBlockComment = initialInBlockComment;

    if (inBlockComment) {
        const endCommentIndex = lineText.indexOf('*/');
        if (endCommentIndex !== -1) {
            inBlockComment = false;
            currentIndex = endCommentIndex + 2;
        } else {
            return { text: '', inBlockComment: true };
        }
    }

    while (currentIndex < lineText.length) {
        const startBlockIndex = lineText.indexOf('/*', currentIndex);
        const startLineIndex = lineText.indexOf('//', currentIndex);

        if (startBlockIndex !== -1 && (startLineIndex === -1 || startBlockIndex < startLineIndex)) {
            nonCommentText += lineText.substring(currentIndex, startBlockIndex);
            const endBlockIndex = lineText.indexOf('*/', startBlockIndex + 2);
            if (endBlockIndex !== -1) {
                currentIndex = endBlockIndex + 2;
            } else {
                inBlockComment = true;
                break;
            }
        } else if (startLineIndex !== -1) {
            nonCommentText += lineText.substring(currentIndex, startLineIndex);
            break;
        } else {
            nonCommentText += lineText.substring(currentIndex);
            break;
        }
    }

    return { text: nonCommentText, inBlockComment };
}

/**
 * Supprime les strings d'une expression pour éviter de les analyser
 */
export function maskStrings(text: string): string {
    return text
        .replace(/"[^"]*"/g, match => ' '.repeat(match.length))
        .replace(/'(?:\\.|[^\\'])'/g, match => ' '.repeat(match.length));
}

/**
 * Supprime les accès aux champs (obj.field) pour ne garder que les variables de base
 */
export function maskFieldAccess(text: string): string {
    let result = text;
    let changed = true;

    while (changed) {
        const before = result;

        // Remplacer variable.champ
        result = result.replace(/([\p{L}_][\p{L}0-9_]*)\.([\p{L}_][\p{L}0-9_]*)/gu,
            (match, base, field) => base + ' '.repeat(field.length + 1));

        // Remplacer ].champ
        result = result.replace(/(\])\.([\p{L}_][\p{L}0-9_]*)/gu,
            (match, bracket, field) => bracket + ' '.repeat(field.length + 1));

        // Supprimer .champ restants
        result = result.replace(/\.[\p{L}_][\p{L}0-9_]*/gu,
            match => ' '.repeat(match.length));

        changed = (before !== result);
    }

    return result;
}

/**
 * Vérifie si un identifiant est simple (pas d'index ou d'accès aux champs)
 */
export function isSimpleIdentifier(identifier: string): boolean {
    return /^[\p{L}_][\p{L}0-9_]*$/u.test(identifier);
}

/**
 * Extrait les paramètres d'une signature de fonction
 */
export function extractFunctionParams(paramsString: string): Array<{ name: string; isInOut: boolean }> {
    if (!paramsString.trim()) return [];

    // Trouver la parenthèse fermante qui correspond à l'ouverture des paramètres
    let depth = 0;
    let endOfParams = -1;
    for (let i = 0; i < paramsString.length; i++) {
        if (paramsString[i] === '(') depth++;
        else if (paramsString[i] === ')') {
            depth--;
            if (depth < 0) {
                endOfParams = i;
                break;
            }
        }
    }

    // Si on a trouvé une parenthèse fermante, on ne prend que ce qui est avant
    if (endOfParams !== -1) {
        paramsString = paramsString.substring(0, endOfParams);
    }

    const params: Array<{ name: string; isInOut: boolean }> = [];
    const parts = smartSplitArgs(paramsString);

    for (const part of parts) {
        const [namePart] = part.split(':').map(s => s.trim());
        const isInOut = /\bInOut\b/i.test(namePart);
        const name = namePart.replace(/\bInOut\b/i, '').trim();

        if (name) {
            params.push({ name, isInOut });
        }
    }

    return params;
}
