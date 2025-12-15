"use strict";
/**
 * Fonctions utilitaires réutilisables
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeType = normalizeType;
exports.smartSplitArgs = smartSplitArgs;
exports.findMatchingParen = findMatchingParen;
exports.cleanLineFromComments = cleanLineFromComments;
exports.maskStrings = maskStrings;
exports.maskFieldAccess = maskFieldAccess;
exports.isSimpleIdentifier = isSimpleIdentifier;
exports.extractFunctionParams = extractFunctionParams;
var constants_1 = require("./constants");
// ═══════════════════════════════════════════════════════════════════════════════
// REGEX PRÉ-COMPILÉES (éviter la recompilation à chaque appel)
// ═══════════════════════════════════════════════════════════════════════════════
var REGEX_DOUBLE_QUOTES = /"[^"]*"/g;
var REGEX_SINGLE_QUOTES = /'(?:\\.|[^\\'])'/g;
var REGEX_FIELD_ACCESS = /([\p{L}_][\p{L}0-9_]*)\.([\p{L}_][\p{L}0-9_]*)/gu;
var REGEX_BRACKET_FIELD_ACCESS = /(\])\.([\p{L}_][\p{L}0-9_]*)/gu;
var REGEX_DOT_FIELD = /\.[\p{L}_][\p{L}0-9_]*/gu;
var REGEX_SIMPLE_IDENTIFIER = /^[\p{L}_][\p{L}0-9_]*$/u;
var REGEX_INOUT = /\bInOut\b/i;
var OPEN_BRACKETS = new Set(['(', '[', '{']);
var CLOSE_BRACKETS = new Set([')', ']', '}']);
/**
 * Normalise un type (gère les variantes avec/sans accent)
 */
function normalizeType(rawType) {
    return constants_1.TYPE_MAPPING[rawType.toLowerCase()] || rawType;
}
/**
 * Découpe intelligemment une chaîne d'arguments en tenant compte des parenthèses, crochets et quotes
 */
function smartSplitArgs(argsStr) {
    var trimmed = argsStr.trim();
    if (!trimmed)
        return [];
    var args = [];
    var current = '';
    var depth = 0;
    var inString = false;
    var stringChar = '';
    var len = argsStr.length;
    for (var i = 0; i < len; i++) {
        var char = argsStr[i];
        if (!inString) {
            if (char === '"' || char === "'") {
                inString = true;
                stringChar = char;
                current += char;
            }
            else if (OPEN_BRACKETS.has(char)) {
                depth++;
                current += char;
            }
            else if (CLOSE_BRACKETS.has(char)) {
                depth--;
                current += char;
            }
            else if (char === ',' && depth === 0) {
                args.push(current.trim());
                current = '';
            }
            else {
                current += char;
            }
        }
        else {
            current += char;
            if (char === stringChar && argsStr[i - 1] !== '\\') {
                inString = false;
            }
        }
    }
    var final = current.trim();
    if (final) {
        args.push(final);
    }
    return args;
}
/**
 * Trouve la parenthèse fermante correspondante
 * OPTIMISÉ: Boucle simple sans regex
 */
function findMatchingParen(str, startPos) {
    var depth = 1;
    var len = str.length;
    for (var i = startPos + 1; i < len; i++) {
        var c = str[i];
        if (c === '(')
            depth++;
        else if (c === ')') {
            if (--depth === 0)
                return i;
        }
    }
    return -1;
}
/**
 * Nettoie une ligne des commentaires
 * OPTIMISÉ: Algorithme simplifié avec indexOf
 */
function cleanLineFromComments(lineText, initialInBlockComment) {
    var currentIndex = 0;
    var inBlockComment = initialInBlockComment;
    // Gestion du commentaire bloc en cours
    if (inBlockComment) {
        var endCommentIndex = lineText.indexOf('*/');
        if (endCommentIndex !== -1) {
            inBlockComment = false;
            currentIndex = endCommentIndex + 2;
        }
        else {
            return { text: '', inBlockComment: true };
        }
    }
    // Cas simple: pas de commentaire dans la ligne restante
    var startBlockIndex = lineText.indexOf('/*', currentIndex);
    var startLineIndex = lineText.indexOf('//', currentIndex);
    if (startBlockIndex === -1 && startLineIndex === -1) {
        return { text: lineText.substring(currentIndex), inBlockComment: false };
    }
    // Construction du résultat
    var result = '';
    while (currentIndex < lineText.length) {
        var blockIdx = lineText.indexOf('/*', currentIndex);
        var lineIdx = lineText.indexOf('//', currentIndex);
        if (blockIdx !== -1 && (lineIdx === -1 || blockIdx < lineIdx)) {
            result += lineText.substring(currentIndex, blockIdx);
            var endBlockIdx = lineText.indexOf('*/', blockIdx + 2);
            if (endBlockIdx !== -1) {
                currentIndex = endBlockIdx + 2;
            }
            else {
                return { text: result, inBlockComment: true };
            }
        }
        else if (lineIdx !== -1) {
            result += lineText.substring(currentIndex, lineIdx);
            return { text: result, inBlockComment: false };
        }
        else {
            result += lineText.substring(currentIndex);
            break;
        }
    }
    return { text: result, inBlockComment: inBlockComment };
}
/**
 * Supprime les strings d'une expression pour éviter de les analyser
 * OPTIMISÉ: Utilise des regex pré-compilées
 */
function maskStrings(text) {
    // Reset lastIndex pour les regex globales
    REGEX_DOUBLE_QUOTES.lastIndex = 0;
    REGEX_SINGLE_QUOTES.lastIndex = 0;
    return text
        .replace(REGEX_DOUBLE_QUOTES, function (match) { return ' '.repeat(match.length); })
        .replace(REGEX_SINGLE_QUOTES, function (match) { return ' '.repeat(match.length); });
}
/**
 * Supprime les accès aux champs (obj.field) pour ne garder que les variables de base
 * OPTIMISÉ: Limite le nombre d'itérations et utilise des regex pré-compilées
 */
function maskFieldAccess(text) {
    var result = text;
    var maxIterations = 10; // Éviter les boucles infinies
    while (maxIterations-- > 0) {
        var before_1 = result;
        // Reset lastIndex pour les regex globales
        REGEX_FIELD_ACCESS.lastIndex = 0;
        REGEX_BRACKET_FIELD_ACCESS.lastIndex = 0;
        REGEX_DOT_FIELD.lastIndex = 0;
        // Remplacer variable.champ
        result = result.replace(REGEX_FIELD_ACCESS, function (_, base, field) { return base + ' '.repeat(field.length + 1); });
        // Remplacer ].champ
        result = result.replace(REGEX_BRACKET_FIELD_ACCESS, function (_, bracket, field) { return bracket + ' '.repeat(field.length + 1); });
        // Supprimer .champ restants
        result = result.replace(REGEX_DOT_FIELD, function (match) { return ' '.repeat(match.length); });
        if (before_1 === result)
            break;
    }
    return result;
}
/**
 * Vérifie si un identifiant est simple (pas d'index ou d'accès aux champs)
 */
function isSimpleIdentifier(identifier) {
    return REGEX_SIMPLE_IDENTIFIER.test(identifier);
}
/**
 * Extrait les paramètres d'une signature de fonction
 * OPTIMISÉ: Boucle for-of et regex pré-compilée
 */
function extractFunctionParams(paramsString) {
    var trimmed = paramsString.trim();
    if (!trimmed)
        return [];
    // Trouver la parenthèse fermante
    var depth = 0;
    var endOfParams = -1;
    var len = paramsString.length;
    for (var i = 0; i < len; i++) {
        var c = paramsString[i];
        if (c === '(')
            depth++;
        else if (c === ')') {
            if (--depth < 0) {
                endOfParams = i;
                break;
            }
        }
    }
    var paramStr = endOfParams !== -1 ? paramsString.substring(0, endOfParams) : paramsString;
    var parts = smartSplitArgs(paramStr);
    var params = [];
    for (var _i = 0, parts_1 = parts; _i < parts_1.length; _i++) {
        var part = parts_1[_i];
        var colonIdx = part.indexOf(':');
        var namePart = colonIdx !== -1 ? part.substring(0, colonIdx).trim() : part.trim();
        var isInOut = REGEX_INOUT.test(namePart);
        var name_1 = namePart.replace(REGEX_INOUT, '').trim();
        if (name_1) {
            params.push({ name: name_1, isInOut: isInOut });
        }
    }
    return params;
}
