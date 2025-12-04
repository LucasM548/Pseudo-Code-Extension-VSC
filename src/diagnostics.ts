import * as vscode from 'vscode';
import { KNOWN_IDENTIFIERS, PATTERNS, BUILTIN_FUNCTION_ARITY } from './constants';
import { cleanLineFromComments, maskStrings, maskFieldAccess, smartSplitArgs, findMatchingParen } from './utils';

// ═══════════════════════════════════════════════════════════════════════════════
// REGEX PRÉ-COMPILÉES (éviter la recompilation à chaque ligne)
// ═══════════════════════════════════════════════════════════════════════════════
const REGEX_POUR_LOOP = /^\s*Pour\s+([\p{L}_][\p{L}0-9_]*)/iu;
const REGEX_PARAM_SPLIT = /,(?![^(\[]*[)\]])/g;
const REGEX_INOUT = /\bInOut\b/i;
const REGEX_IDENTIFIER_START = /^([\p{L}_][\p{L}0-9_]*)/u;
const REGEX_NUMBER = /^\d+(\.\d+)?$/;
const REGEX_IDENT_CHAR = /[\p{L}_]/u;
const REGEX_IDENT_CHAR_FULL = /[\p{L}0-9_]/u;
const REGEX_IDENTIFIER_EXTRACT = /^[\p{L}_][\p{L}0-9_]*/u;
const REGEX_WHITESPACE = /\s/;

// Cache pour les identifiants connus en minuscules (optimisation lookup)
const KNOWN_IDENTIFIERS_LOWER = new Set([...KNOWN_IDENTIFIERS].map(id => id.toLowerCase()));

/**
 * Cœur du Linter avec gestion de la portée lexicale et déclaration implicite.
 */
export function refreshDiagnostics(doc: vscode.TextDocument, collection: vscode.DiagnosticCollection): void {
    if (doc.languageId !== 'psc') {
        return;
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const scopeStack: Set<string>[] = [new Set()];

    const declaredFunctions = new Set<string>();
    const declaredCompositeTypes = new Set<string>();

    const lineCount = doc.lineCount;
    for (let i = 0; i < lineCount; i++) {
        const lineText = doc.lineAt(i).text;
        const trimmed = lineText.trim();
        if (!trimmed) continue;

        // Détection fonction (regex pré-compilée)
        const funcMatch = PATTERNS.FUNCTION_DECLARATION.exec(trimmed);
        if (funcMatch) {
            declaredFunctions.add(funcMatch[1]);
            continue;
        }

        // Détection type composite
        const typeMatch = PATTERNS.COMPOSITE_TYPE.exec(trimmed);
        if (typeMatch) {
            declaredCompositeTypes.add(typeMatch[1].toLowerCase());
        }
    }

    let inBlockComment = false;

    // Deuxième passe: analyse avec contexte de portées
    for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
        const line = doc.lineAt(lineIndex);
        const nonCommentText = cleanLineFromComments(line.text, inBlockComment);
        const trimmedText = nonCommentText.text.trim();
        inBlockComment = nonCommentText.inBlockComment;

        if (trimmedText === '') continue;

        // Ignorer les déclarations de types composites
        if (PATTERNS.COMPOSITE_TYPE.test(trimmedText)) continue;

        const isOpeningBlock = PATTERNS.OPENING_BLOCK.test(trimmedText);
        const funcMatch = PATTERNS.FUNCTION_DECLARATION.exec(trimmedText);
        const pourMatch = REGEX_POUR_LOOP.exec(trimmedText);

        if (isOpeningBlock || funcMatch || pourMatch) {
            const newScope = new Set<string>();
            if (funcMatch) {
                let paramsString = funcMatch[2];

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

                if (endOfParams !== -1) {
                    paramsString = paramsString.substring(0, endOfParams);
                }

                // Extraire les noms de paramètres
                const params = paramsString.split(REGEX_PARAM_SPLIT);
                for (const p of params) {
                    const paramParts = p.trim().split(':');
                    if (paramParts.length >= 1) {
                        const varName = paramParts[0].replace(REGEX_INOUT, '').trim();
                        if (varName) newScope.add(varName);
                    }
                }
            }
            if (pourMatch) {
                newScope.add(pourMatch[1]);
            }
            scopeStack.push(newScope);
        }

        const declarationMatch = PATTERNS.VARIABLE_DECLARATION.exec(trimmedText);
        const assignmentIndex = trimmedText.indexOf('←');

        if (declarationMatch && !PATTERNS.FUNCTION_DECLARATION.test(trimmedText)) {
            const varNames = declarationMatch[1].split(',');
            const currentScope = scopeStack[scopeStack.length - 1];
            for (const v of varNames) {
                const trimmed = v.trim();
                if (trimmed) currentScope.add(trimmed);
            }
        } else if (assignmentIndex !== -1) {
            const lhsText = trimmedText.substring(0, assignmentIndex).trim();
            const rhsText = trimmedText.substring(assignmentIndex + 1).trim();
            checkVariablesInExpression(rhsText, scopeStack, declaredFunctions, declaredCompositeTypes, line, diagnostics);
            checkFunctionCallsInExpression(rhsText, declaredFunctions, declaredCompositeTypes, line, diagnostics);

            const lhsVarMatch = REGEX_IDENTIFIER_START.exec(lhsText);
            if (lhsVarMatch) {
                scopeStack[scopeStack.length - 1].add(lhsVarMatch[1]);
                const lhsIndexVars = lhsText.substring(lhsVarMatch[0].length);
                checkVariablesInExpression(lhsIndexVars, scopeStack, declaredFunctions, declaredCompositeTypes, line, diagnostics);
            }
        } else {
            checkVariablesInExpression(trimmedText, scopeStack, declaredFunctions, declaredCompositeTypes, line, diagnostics);
            checkFunctionCallsInExpression(trimmedText, declaredFunctions, declaredCompositeTypes, line, diagnostics);
        }

        if (PATTERNS.CLOSING_KEYWORDS.test(trimmedText) && scopeStack.length > 1) {
            scopeStack.pop();
        }
    }

    collection.set(doc.uri, diagnostics);
}

/**
 * Vérifie tous les identifiants dans une expression donnée.
 * OPTIMISÉ: Utilise des regex pré-compilées et des lookups Set.
 */
function checkVariablesInExpression(
    expression: string,
    scopeStack: Set<string>[],
    declaredFunctions: Set<string>,
    declaredCompositeTypes: Set<string>,
    line: vscode.TextLine,
    diagnostics: vscode.Diagnostic[]
): void {
    // Masquer les strings et les accès aux champs
    let textToCheck = maskStrings(expression);
    textToCheck = maskFieldAccess(textToCheck);

    const regex = PATTERNS.WORD_BOUNDARY_IDENTIFIER;

    const expressionOffsetInLine = line.text.indexOf(expression);
    if (expressionOffsetInLine === -1) return;

    let match;
    while ((match = regex.exec(textToCheck)) !== null) {
        const variable = match[0];
        const indexInExpression = match.index;
        const lowerVar = variable.toLowerCase();

        // OPTIMISÉ: Vérifications avec Sets pré-calculés
        if (KNOWN_IDENTIFIERS_LOWER.has(lowerVar) ||
            declaredFunctions.has(variable) ||
            declaredCompositeTypes.has(lowerVar) ||
            REGEX_NUMBER.test(variable)) {
            continue;
        }

        // Recherche dans les portées (du plus local au plus global)
        let isDeclared = false;
        for (let i = scopeStack.length - 1; i >= 0; i--) {
            if (scopeStack[i].has(variable)) {
                isDeclared = true;
                break;
            }
        }

        if (!isDeclared) {
            const finalColumn = expressionOffsetInLine + indexInExpression;
            const range = new vscode.Range(line.lineNumber, finalColumn, line.lineNumber, finalColumn + variable.length);
            diagnostics.push(new vscode.Diagnostic(range, `L'identifiant '${variable}' est utilisé avant d'avoir reçu une valeur.`, vscode.DiagnosticSeverity.Error));
        }
    }
}

/**
 * Vérifie les appels de fonction dans une expression.
 * OPTIMISÉ: Parsing manuel plus efficace que des regex répétées.
 */
function checkFunctionCallsInExpression(
    expression: string,
    declaredFunctions: Set<string>,
    declaredCompositeTypes: Set<string>,
    line: vscode.TextLine,
    diagnostics: vscode.Diagnostic[]
): void {
    let masked = maskStrings(expression);
    masked = maskFieldAccess(masked);

    const expressionOffsetInLine = line.text.indexOf(expression);
    if (expressionOffsetInLine === -1) return;

    const len = masked.length;
    let i = 0;

    while (i < len) {
        const ch = masked[i];
        const prev = i > 0 ? masked[i - 1] : ' ';

        // Détection optimisée du début d'identifiant
        if (!REGEX_IDENT_CHAR.test(ch) || REGEX_IDENT_CHAR_FULL.test(prev)) {
            i++;
            continue;
        }

        const idMatch = masked.slice(i).match(REGEX_IDENTIFIER_EXTRACT);
        if (!idMatch) {
            i++;
            continue;
        }

        const funcName = idMatch[0];
        let j = i + funcName.length;

        // Sauter espaces
        while (j < len && REGEX_WHITESPACE.test(masked[j])) j++;

        if (j < len && masked[j] === '(') {
            const closeIdx = findMatchingParen(masked, j);
            if (closeIdx === -1) break;

            const argsStr = expression.slice(j + 1, closeIdx);
            const args = smartSplitArgs(argsStr);
            const arity = args.length;
            const lower = funcName.toLowerCase();

            if (Object.prototype.hasOwnProperty.call(BUILTIN_FUNCTION_ARITY, lower)) {
                const expected = BUILTIN_FUNCTION_ARITY[lower];
                if (expected !== arity) {
                    const startCol = expressionOffsetInLine + i;
                    const range = new vscode.Range(line.lineNumber, startCol, line.lineNumber, startCol + funcName.length);
                    diagnostics.push(new vscode.Diagnostic(
                        range,
                        `La fonction intégrée '${funcName}' attend ${expected} argument(s), mais ${arity} fourni(s).`,
                        vscode.DiagnosticSeverity.Error
                    ));
                }
            } else if (!declaredFunctions.has(funcName) && !KNOWN_IDENTIFIERS_LOWER.has(lower) && !declaredCompositeTypes.has(lower)) {
                const startCol = expressionOffsetInLine + i;
                const range = new vscode.Range(line.lineNumber, startCol, line.lineNumber, startCol + funcName.length);
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `La fonction '${funcName}' n'est pas déclarée.`,
                    vscode.DiagnosticSeverity.Error
                ));
            }

            i = closeIdx + 1;
            continue;
        }

        i = j;
    }
}