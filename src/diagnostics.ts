import * as vscode from 'vscode';
import { KNOWN_IDENTIFIERS, PATTERNS, BUILTIN_FUNCTION_ARITY } from './constants';
import { cleanLineFromComments, maskStrings, maskFieldAccess, smartSplitArgs, findMatchingParen } from './utils';

/**
 * Cœur du Linter avec gestion de la portée lexicale et déclaration implicite.
 */
export function refreshDiagnostics(doc: vscode.TextDocument, collection: vscode.DiagnosticCollection): void {

    if (doc.languageId !== 'psc') {
        return;
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const scopeStack: Set<string>[] = [new Set()]; // Pile de portées (global + locales)
    const declaredFunctions = collectFunctionNames(doc);
    const declaredCompositeTypes = collectCompositeTypeNames(doc);
    let inBlockComment = false;

    for (let lineIndex = 0; lineIndex < doc.lineCount; lineIndex++) {
        const line = doc.lineAt(lineIndex);
        const nonCommentText = cleanLineFromComments(line.text, inBlockComment);
        const trimmedText = nonCommentText.text.trim();
        inBlockComment = nonCommentText.inBlockComment;

        if (trimmedText === '') continue;

        // Ignorer les déclarations de types composites
        if (PATTERNS.COMPOSITE_TYPE.test(trimmedText)) continue;

        const isOpeningBlock = PATTERNS.OPENING_BLOCK.test(trimmedText);
        const funcMatch = PATTERNS.FUNCTION_DECLARATION.exec(trimmedText);
        const pourMatch = /^\s*Pour\s+([\p{L}_][\p{L}0-9_]*)/iu.exec(trimmedText);

        if (isOpeningBlock || funcMatch || pourMatch) {
            const newScope = new Set<string>();
            if (funcMatch) {
                let paramsString = funcMatch[2];

                // Trouver la position de la parenthèse fermante qui correspond à l'ouverture
                // pour séparer les paramètres du type de retour
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

                // Extraire seulement les NOMS de paramètres, pas les types
                const params = paramsString.split(/,(?![^(\[]*[)\]])/g);
                params.forEach(p => {
                    // Format: nom : type ou InOut nom : type
                    const paramParts = p.trim().split(':');
                    if (paramParts.length >= 1) {
                        const varName = paramParts[0].replace(/\bInOut\b/i, '').trim();
                        if (varName) newScope.add(varName);
                    }
                });
            }
            if (pourMatch) {
                newScope.add(pourMatch[1]);
            }
            scopeStack.push(newScope);
        }

        const declarationMatch = PATTERNS.VARIABLE_DECLARATION.exec(trimmedText);
        const assignmentIndex = trimmedText.indexOf('←');

        if (declarationMatch && !PATTERNS.FUNCTION_DECLARATION.test(trimmedText)) {
            const varNames = declarationMatch[1].split(',').map(v => v.trim());
            const currentScope = scopeStack[scopeStack.length - 1];
            varNames.forEach(v => { if (v) currentScope.add(v); });
        } else if (assignmentIndex !== -1) {
            const lhsText = trimmedText.substring(0, assignmentIndex).trim();
            const rhsText = trimmedText.substring(assignmentIndex + 1).trim();
            checkVariablesInExpression(rhsText, scopeStack, declaredFunctions, declaredCompositeTypes, line, diagnostics);
            checkFunctionCallsInExpression(rhsText, declaredFunctions, line, diagnostics);
            const lhsVarMatch = lhsText.match(/^([\p{L}_][\p{L}0-9_]*)/u);
            if (lhsVarMatch) {
                const lhsVar = lhsVarMatch[1];
                scopeStack[scopeStack.length - 1].add(lhsVar);
            }
            const lhsIndexVars = lhsText.substring(lhsVarMatch ? lhsVarMatch[0].length : 0);
            checkVariablesInExpression(lhsIndexVars, scopeStack, declaredFunctions, declaredCompositeTypes, line, diagnostics);
        } else {
            checkVariablesInExpression(trimmedText, scopeStack, declaredFunctions, declaredCompositeTypes, line, diagnostics);
            checkFunctionCallsInExpression(trimmedText, declaredFunctions, line, diagnostics);
        }

        const isClosingBlock = PATTERNS.CLOSING_KEYWORDS.test(trimmedText);
        if (isClosingBlock && scopeStack.length > 1) {
            scopeStack.pop();
        }
    }

    collection.set(doc.uri, diagnostics);
}

/**
 * Vérifie tous les identifiants dans une expression donnée.
 * Crée des diagnostics à la position exacte si un identifiant n'est pas déclaré.
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

    // Calculer le décalage entre le texte original de la ligne et l'expression analysée
    const expressionOffsetInLine = line.text.indexOf(expression);
    if (expressionOffsetInLine === -1) return; // Sécurité si l'expression n'est pas trouvée

    let match;
    while ((match = regex.exec(textToCheck)) !== null) {
        const variable = match[0];
        const indexInExpression = match.index;

        // Comparaison insensible à la casse pour les types composites
        if (isKnownIdentifier(variable) || declaredFunctions.has(variable) || declaredCompositeTypes.has(variable.toLowerCase()) || /^\d+(\.\d+)?$/.test(variable)) {
            continue;
        }

        let isDeclared = false;
        for (let i = scopeStack.length - 1; i >= 0; i--) {
            if (scopeStack[i].has(variable)) {
                isDeclared = true;
                break;
            }
        }

        if (!isDeclared) {
            // Calculer la position finale et précise de l'erreur
            const finalColumn = expressionOffsetInLine + indexInExpression;
            const range = new vscode.Range(line.lineNumber, finalColumn, line.lineNumber, finalColumn + variable.length);
            diagnostics.push(new vscode.Diagnostic(range, `L'identifiant '${variable}' est utilisé avant d'avoir reçu une valeur.`, vscode.DiagnosticSeverity.Error));
        }
    }
}
function checkFunctionCallsInExpression(
    expression: string,
    declaredFunctions: Set<string>,
    line: vscode.TextLine,
    diagnostics: vscode.Diagnostic[]
): void {
    // Masquer les strings et les accès aux champs pour éviter les faux positifs
    let masked = maskStrings(expression);
    masked = maskFieldAccess(masked);

    // Calculer le décalage de l'expression dans la ligne pour les diagnostics précis
    const expressionOffsetInLine = line.text.indexOf(expression);
    if (expressionOffsetInLine === -1) return;

    let i = 0;
    while (i < masked.length) {
        const ch = masked[i];
        // Détection du début d'identifiant en respectant une limite de mot
        const prev = i > 0 ? masked[i - 1] : ' ';
        const isStart = /[\p{L}_]/u.test(ch) && !/[\p{L}0-9_]/u.test(prev);
        if (!isStart) {
            i++;
            continue;
        }

        // Extraire le nom de fonction potentiel
        const idMatch = masked.slice(i).match(/^[\p{L}_][\p{L}0-9_]*/u);
        if (!idMatch) {
            i++;
            continue;
        }
        const funcName = idMatch[0];
        let j = i + funcName.length;
        // Sauter espaces
        while (j < masked.length && /\s/.test(masked[j])) j++;

        if (j < masked.length && masked[j] === '(') {
            // Trouver la parenthèse fermante correspondante
            const closeIdx = findMatchingParen(masked, j);
            if (closeIdx === -1) {
                // Parenthèses non fermées: on arrête ici pour éviter des faux positifs
                break;
            }

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
            } else if (!declaredFunctions.has(funcName) && !KNOWN_IDENTIFIERS.has(lower)) {
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

        i = j; // Continuer après l'identifiant si pas d'appel
    }
}

function collectFunctionNames(doc: vscode.TextDocument): Set<string> {
    const functions = new Set<string>();
    for (let i = 0; i < doc.lineCount; i++) {
        const line = doc.lineAt(i).text;
        const funcMatch = PATTERNS.FUNCTION_DECLARATION.exec(line);
        if (funcMatch) {
            functions.add(funcMatch[1]);
        }
    }
    return functions;
}

function collectCompositeTypeNames(doc: vscode.TextDocument): Set<string> {
    const types = new Set<string>();
    for (let i = 0; i < doc.lineCount; i++) {
        const line = doc.lineAt(i).text.trim();
        const typeMatch = PATTERNS.COMPOSITE_TYPE.exec(line);
        if (typeMatch) {
            // Ajouter le type en minuscules pour comparaison insensible à la casse
            types.add(typeMatch[1].toLowerCase());
        }
    }
    return types;
}

function isKnownIdentifier(word: string): boolean {
    return KNOWN_IDENTIFIERS.has(word.toLowerCase());
}