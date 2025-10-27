import * as vscode from 'vscode';
import { KNOWN_IDENTIFIERS, PATTERNS } from './constants';
import { cleanLineFromComments, maskStrings, maskFieldAccess } from './utils';

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
            const lhsVarMatch = lhsText.match(/^([\p{L}_][\p{L}0-9_]*)/u);
            if (lhsVarMatch) {
                const lhsVar = lhsVarMatch[1];
                scopeStack[scopeStack.length - 1].add(lhsVar);
            }
            const lhsIndexVars = lhsText.substring(lhsVarMatch ? lhsVarMatch[0].length : 0);
            checkVariablesInExpression(lhsIndexVars, scopeStack, declaredFunctions, declaredCompositeTypes, line, diagnostics);
        } else {
            checkVariablesInExpression(trimmedText, scopeStack, declaredFunctions, declaredCompositeTypes, line, diagnostics);
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