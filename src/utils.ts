/**
 * Fonctions utilitaires réutilisables
 */

import { TYPE_MAPPING } from './constants';

// ═══════════════════════════════════════════════════════════════════════════════
// REGEX PRÉ-COMPILÉES (éviter la recompilation à chaque appel)
// ═══════════════════════════════════════════════════════════════════════════════
const REGEX_DOUBLE_QUOTES = /"[^"]*"/g;
const REGEX_SINGLE_QUOTES = /'(?:\\.|[^\\'])'/g;
const REGEX_FIELD_ACCESS = /([\p{L}_][\p{L}0-9_]*)\.([\p{L}_][\p{L}0-9_]*)/gu;
const REGEX_BRACKET_FIELD_ACCESS = /(\])\.([\p{L}_][\p{L}0-9_]*)/gu;
const REGEX_DOT_FIELD = /\.[\p{L}_][\p{L}0-9_]*/gu;
const REGEX_SIMPLE_IDENTIFIER = /^[\p{L}_][\p{L}0-9_]*$/u;
const REGEX_INOUT = /\bInOut\b/i;

const OPEN_BRACKETS = new Set(['(', '[', '{']);
const CLOSE_BRACKETS = new Set([')', ']', '}']);

/**
 * Normalise un type (gère les variantes avec/sans accent)
 */
export function normalizeType(rawType: string): string {
    return TYPE_MAPPING[rawType.toLowerCase()] || rawType;
}

/**
 * Découpe intelligemment une chaîne d'arguments en tenant compte des parenthèses, crochets et quotes
 */
export function smartSplitArgs(argsStr: string): string[] {
    const trimmed = argsStr.trim();
    if (!trimmed) return [];

    const args: string[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar = '';
    const len = argsStr.length;

    for (let i = 0; i < len; i++) {
        const char = argsStr[i];

        if (!inString) {
            if (char === '"' || char === "'") {
                inString = true;
                stringChar = char;
                current += char;
            } else if (OPEN_BRACKETS.has(char)) {
                depth++;
                current += char;
            } else if (CLOSE_BRACKETS.has(char)) {
                depth--;
                current += char;
            } else if (char === ',' && depth === 0) {
                args.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        } else {
            current += char;
            if (char === stringChar && argsStr[i - 1] !== '\\') {
                inString = false;
            }
        }
    }

    const final = current.trim();
    if (final) {
        args.push(final);
    }

    return args;
}

/**
 * Trouve la parenthèse fermante correspondante
 * OPTIMISÉ: Boucle simple sans regex
 */
export function findMatchingParen(str: string, startPos: number): number {
    let depth = 1;
    const len = str.length;
    for (let i = startPos + 1; i < len; i++) {
        const c = str[i];
        if (c === '(') depth++;
        else if (c === ')') {
            if (--depth === 0) return i;
        }
    }
    return -1;
}

/**
 * Nettoie une ligne des commentaires
 * OPTIMISÉ: Algorithme simplifié avec indexOf
 */
export function cleanLineFromComments(lineText: string, initialInBlockComment: boolean): { text: string; inBlockComment: boolean } {
    let currentIndex = 0;
    let inBlockComment = initialInBlockComment;

    // Gestion du commentaire bloc en cours
    if (inBlockComment) {
        const endCommentIndex = lineText.indexOf('*/');
        if (endCommentIndex !== -1) {
            inBlockComment = false;
            currentIndex = endCommentIndex + 2;
        } else {
            return { text: '', inBlockComment: true };
        }
    }

    // Cas simple: pas de commentaire dans la ligne restante
    const startBlockIndex = lineText.indexOf('/*', currentIndex);
    const startLineIndex = lineText.indexOf('//', currentIndex);

    if (startBlockIndex === -1 && startLineIndex === -1) {
        return { text: lineText.substring(currentIndex), inBlockComment: false };
    }

    // Construction du résultat
    let result = '';

    while (currentIndex < lineText.length) {
        const blockIdx = lineText.indexOf('/*', currentIndex);
        const lineIdx = lineText.indexOf('//', currentIndex);

        if (blockIdx !== -1 && (lineIdx === -1 || blockIdx < lineIdx)) {
            result += lineText.substring(currentIndex, blockIdx);
            const endBlockIdx = lineText.indexOf('*/', blockIdx + 2);
            if (endBlockIdx !== -1) {
                currentIndex = endBlockIdx + 2;
            } else {
                return { text: result, inBlockComment: true };
            }
        } else if (lineIdx !== -1) {
            result += lineText.substring(currentIndex, lineIdx);
            return { text: result, inBlockComment: false };
        } else {
            result += lineText.substring(currentIndex);
            break;
        }
    }

    return { text: result, inBlockComment };
}

/**
 * Supprime les strings d'une expression pour éviter de les analyser
 * OPTIMISÉ: Utilise des regex pré-compilées
 */
export function maskStrings(text: string): string {
    // Reset lastIndex pour les regex globales
    REGEX_DOUBLE_QUOTES.lastIndex = 0;
    REGEX_SINGLE_QUOTES.lastIndex = 0;

    return text
        .replace(REGEX_DOUBLE_QUOTES, match => ' '.repeat(match.length))
        .replace(REGEX_SINGLE_QUOTES, match => ' '.repeat(match.length));
}

/**
 * Supprime les accès aux champs (obj.field) pour ne garder que les variables de base
 * OPTIMISÉ: Limite le nombre d'itérations et utilise des regex pré-compilées
 */
export function maskFieldAccess(text: string): string {
    let result = text;
    let maxIterations = 10; // Éviter les boucles infinies

    while (maxIterations-- > 0) {
        const before = result;

        // Reset lastIndex pour les regex globales
        REGEX_FIELD_ACCESS.lastIndex = 0;
        REGEX_BRACKET_FIELD_ACCESS.lastIndex = 0;
        REGEX_DOT_FIELD.lastIndex = 0;

        // Remplacer variable.champ
        result = result.replace(REGEX_FIELD_ACCESS,
            (_, base, field) => base + ' '.repeat(field.length + 1));

        // Remplacer ].champ
        result = result.replace(REGEX_BRACKET_FIELD_ACCESS,
            (_, bracket, field) => bracket + ' '.repeat(field.length + 1));

        // Supprimer .champ restants
        result = result.replace(REGEX_DOT_FIELD,
            match => ' '.repeat(match.length));

        if (before === result) break;
    }

    return result;
}

/**
 * Vérifie si un identifiant est simple (pas d'index ou d'accès aux champs)
 */
export function isSimpleIdentifier(identifier: string): boolean {
    return REGEX_SIMPLE_IDENTIFIER.test(identifier);
}

/**
 * Extrait les paramètres d'une signature de fonction
 * OPTIMISÉ: Boucle for-of et regex pré-compilée
 */
export function extractFunctionParams(paramsString: string): Array<{ name: string; isInOut: boolean }> {
    const trimmed = paramsString.trim();
    if (!trimmed) return [];

    // Trouver la parenthèse fermante
    let depth = 0;
    let endOfParams = -1;
    const len = paramsString.length;

    for (let i = 0; i < len; i++) {
        const c = paramsString[i];
        if (c === '(') depth++;
        else if (c === ')') {
            if (--depth < 0) {
                endOfParams = i;
                break;
            }
        }
    }

    const paramStr = endOfParams !== -1 ? paramsString.substring(0, endOfParams) : paramsString;
    const parts = smartSplitArgs(paramStr);
    const params: Array<{ name: string; isInOut: boolean }> = [];

    for (const part of parts) {
        const colonIdx = part.indexOf(':');
        const namePart = colonIdx !== -1 ? part.substring(0, colonIdx).trim() : part.trim();
        const isInOut = REGEX_INOUT.test(namePart);
        const name = namePart.replace(REGEX_INOUT, '').trim();

        if (name) {
            params.push({ name, isInOut });
        }
    }

    return params;
}
