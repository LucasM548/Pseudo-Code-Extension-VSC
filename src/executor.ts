/**
 * Transpileur Pseudo-Code vers Lua
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PATTERNS, LUA_REPLACEMENTS, FUNCTION_MAPPING, LUA_HELPERS } from './constants';
import { PSC_DEFINITIONS } from './definitions';
import { normalizeType, smartSplitArgs, findMatchingParen } from './utils';
import { FunctionRegistry } from './functionRegistry';
import { CompositeTypeRegistry } from './compositeTypes';

// ═══════════════════════════════════════════════════════════════════════════════
// REGEX PRÉ-COMPILÉES (éviter la recompilation à chaque ligne)
// ═══════════════════════════════════════════════════════════════════════════════
const REGEX_BUILTIN_TYPES = /^(entier|réel|booléen|booleen|chaîne|chaine|caractère|caractere|tableau|liste|pile|file|listesym)$/i;
const REGEX_INOUT = /\bInOut\b/i;
const REGEX_TYPE_NAME = /^([\p{L}0-9_]+)/iu;
const REGEX_BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const REGEX_LEXIQUE_BLOCK = /Lexique\s*:?[\s\S]*?(?=\n\s*(?:Début|Fonction|Algorithme|$))/i;
const REGEX_SMART_QUOTES = /[""]/g;
const REGEX_ALGORITHM = /^\s*algorithme\b/i;
const REGEX_FIN = /^\s*Fin\b/i;
const REGEX_DEBUT_OR_LEXIQUE = /^\s*(Début|Lexique)\b/i;
const REGEX_CLOSING_BLOCKS = /^\s*(Fin|fsi|fpour|ftq|ftant)\b/i;
const REGEX_LIRE_ASSIGNMENT = /^\s*[\p{L}0-9_]+\s*←\s*lire\s*\(\s*\)\s*$/iu;
const REGEX_FONCTION = /^\s*fonction\s/i;
const REGEX_FONCTION_NAME = /^\s*Fonction\s+([\p{L}_][\p{L}0-9_]*)/iu;
const REGEX_POUR_LOOP = /^\s*Pour\s/i;
const REGEX_POUR_TABLE_ITER = /^\s*Pour\s+([^\s]+)\s+de\s+([^\s]+)\s+Faire\s*:?$/i;
const REGEX_POUR_CLASSIC = /^\s*Pour\s+([\p{L}0-9_]+)\s+(?:allant de|de)\s+(.+)\s+(?:a|à)\s+(.+)\s+Faire\s*:?/iu;
const REGEX_DECROISSANT = /\bdécroissant\b/i;
const REGEX_TANT_QUE = /^\s*Tant que\b/i;
const REGEX_FAIRE = /\s+Faire\s*:?/i;
const REGEX_SI = /^\s*Si\b/i;
const REGEX_SINON_SI = /^\s*Sinon\s+si\b/i;
const REGEX_SINON = /^\s*Sinon\b\s*:?/i;
const REGEX_ALORS_FAIRE = /\s+(Alors|Faire)\s*:?/i;
const REGEX_ECRIRE = /^écrire\(/i;
const REGEX_RETOURNER = /^\s*retourne(?:r)?\b/i;
const REGEX_RETOURNER_PAREN = /^\s*retourne(?:r)?\s*\(/i;
const REGEX_RETOURNER_VALUE = /^\s*retourne(?:r)?\s+(.+)$/i;
const REGEX_RETURN_LINE = /^\s*return\b/i;
const REGEX_IF_CONDITION = /^(\s*if\s+)(.*?)(\s+then\s*:?)\s*$/i;
const REGEX_ELSEIF_CONDITION = /^(\s*elseif\s+)(.*?)(\s+then\s*:?)\s*$/i;
const REGEX_WHILE_CONDITION = /^(\s*while\s+)(.*?)(\s+do\s*:?)\s*$/i;
const REGEX_ARRAY_DECL = /^\s*([\p{L}_][\p{L}0-9_]*)\s*(?:=|←)\s*tableau\s+[\p{L}_][\p{L}0-9_]*\s*\[([^\]]+)\]\s*$/iu;
const REGEX_INDENTATION = /^\s*/;
const REGEX_MULTI_INDEX = /([\p{L}0-9_]+)\s*\[([^\]]+)\]/gu;
const REGEX_MULTI_BRACKET = /([\p{L}0-9_]+)\s*((?:\[[^\]]+\])+)/gu;
const REGEX_BRACKET_EXTRACT = /\[([^\]]+)\]/g;
const REGEX_ARRAY_LITERAL = /(?:(?<=^)|(?<=[\s=,(;:]))\[([^\]]*)\]/gu;


/**
 * Collecte les types de variables déclarées dans le code
 */
function collectVariableTypes(pscCode: string): Map<string, string> {
    const variableTypes = new Map<string, string>();
    const lines = pscCode.split('\n');

    for (const line of lines) {
        const trimmedLine = line.trim();

        // Déclarations de variables simples
        const declarationMatch = PATTERNS.VARIABLE_DECLARATION.exec(trimmedLine);
        if (declarationMatch && !PATTERNS.FUNCTION_DECLARATION.test(trimmedLine)) {
            const rawType = declarationMatch[2];
            const type = REGEX_BUILTIN_TYPES.test(rawType)
                ? normalizeType(rawType)
                : rawType;
            const varNames = declarationMatch[1].split(',').map(v => v.trim());
            varNames.forEach(v => {
                if (v) variableTypes.set(v, type);
            });
        }

        // Paramètres de fonction
        const funcMatch = PATTERNS.FUNCTION_DECLARATION.exec(trimmedLine);
        if (funcMatch) {
            let paramsString = funcMatch[2];

            // Trouver la parenthèse fermante qui correspond à l'ouverture
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

            if (endOfParams !== -1) {
                paramsString = paramsString.substring(0, endOfParams);
            }

            const params = smartSplitArgs(paramsString);
            params.forEach(p => {
                const parts = p.split(':').map(part => part.trim());
                if (parts.length === 2) {
                    const varName = parts[0].replace(REGEX_INOUT, '').trim();
                    const rawTypeName = parts[1];
                    const typeMatch = rawTypeName.match(REGEX_TYPE_NAME);
                    if (typeMatch) {
                        const typeName = typeMatch[1];
                        const finalType = REGEX_BUILTIN_TYPES.test(typeName)
                            ? normalizeType(typeName)
                            : typeName;
                        if (varName) variableTypes.set(varName, finalType);
                    }
                }
            });
        }
    }
    return variableTypes;
}

/**
 * Transpile le code Pseudo-Code en code Lua exécutable.
 * @param pscCode Le code source en Pseudo-Code.
 * @returns Le code Lua transpilé.
 */
export function transpileToLua(pscCode: string): string {
    const functionRegistry = new FunctionRegistry();
    functionRegistry.collect(pscCode);

    const compositeTypeRegistry = new CompositeTypeRegistry();
    compositeTypeRegistry.collect(pscCode);

    const variableTypes = collectVariableTypes(pscCode);

    let cleanedCode = pscCode.replace(REGEX_BLOCK_COMMENT, '');
    cleanedCode = cleanedCode.replace(REGEX_LEXIQUE_BLOCK, '');

    let luaCode = '';
    const lines = cleanedCode.split('\n');
    let isInsideAlgorithmBlock = false;
    const functionStack: any[] = [];

    // Convertit des parenthèses non appel de fonction en littéraux de liste: (x, y) -> __psc_liste_from_table({x, y})
    const transformParenListLiterals = (input: string): string => {
        const isIdent = (ch: string) => /[\p{L}0-9_]/u.test(ch);
        const allowedPrev = (ch: string | undefined) => {
            if (!ch) return true; // début de ligne
            return /[\s=,(;:\[]/.test(ch);
        };
        const isDisallowedPrevWord = (prefix: string): boolean => {
            const m = prefix.match(/([\p{L}_][\p{L}0-9_]*)\s*$/u);
            const w = m ? m[1].toLowerCase() : '';
            return new Set(['if', 'elseif', 'while', 'for', 'return', 'function', 'local', 'not', 'then', 'do', 'else']).has(w);
        };
        const hasTopLevelComma = (s: string): boolean => smartSplitArgs(s).length > 1;
        const isSimpleAtom = (s: string): boolean => {
            const t = s.trim();
            if (!t) return false;
            if (/^"[\s\S]*"$/.test(t) || /^'(?:\\.|[^\\'])*'$/.test(t)) return true;

            if (/^\d+(?:[.,]\d+)?$/.test(t)) return true;
            if (/^[\p{L}_][\p{L}0-9_]*$/u.test(t)) return true;
            // déjà transformé récursivement
            if (/^__psc_liste_from_table\s*\(/.test(t)) return true;
            if (/^\{[\s\S]*\}$/.test(t)) return true; // table Lua
            return false;
        };

        const process = (str: string): string => {
            let i = 0;
            let out = '';
            while (i < str.length) {
                const ch = str[i];
                if (ch === '(') {
                    const prev = i > 0 ? str[i - 1] : undefined;
                    // Si précédé d'un identifiant, c'est un appel de fonction, on ne touche pas
                    if (prev && isIdent(prev)) {
                        out += ch;
                        i++;
                        continue;
                    }
                    if (!allowedPrev(prev)) {
                        out += ch;
                        i++;
                        continue;
                    }
                    // Éviter après mots-clés de contrôle/flux (if, while, ...)
                    if (isDisallowedPrevWord(str.slice(0, i))) {
                        const closeSkip = findMatchingParen(str, i);
                        if (closeSkip !== -1) {
                            out += '(' + process(str.slice(i + 1, closeSkip)) + ')';
                            i = closeSkip + 1;
                            continue;
                        }
                    }
                    const close = findMatchingParen(str, i);
                    if (close === -1) {
                        out += ch;
                        i++;
                        continue;
                    }

                    const insideRaw = str.slice(i + 1, close);
                    // Traiter récursivement l'intérieur d'abord (pour listes imbriquées)
                    const inside = process(insideRaw);
                    const args = smartSplitArgs(inside);
                    const shouldTransform = args.length > 1 || (args.length === 1 && isSimpleAtom(args[0]));
                    if (shouldTransform) {
                        out += `__psc_liste_from_table({${args.join(', ')}})`;
                        i = close + 1;
                        continue;
                    } else {
                        // Ne pas transformer (groupe arithmétique, etc.)
                        out += '(' + inside + ')';
                        i = close + 1;
                        continue;
                    }
                }
                out += ch;
                i++;
            }
            return out;
        };

        return process(input);
    };

    for (const line of lines) {
        const originalLineForIndentation = line;
        let textToProcess = line;
        const commentIndex = textToProcess.indexOf('//');
        let commentPart = '';
        if (commentIndex !== -1) {
            commentPart = textToProcess.substring(commentIndex).replace(/^\/\//, '--');
            textToProcess = textToProcess.substring(0, commentIndex);
        }
        let trimmedLine = textToProcess.trim();
        let lineIsFullyProcessed = false;

        // Ignorer les lignes vides et les lignes qui ne contiennent que des caractères de ponctuation résiduels
        if (trimmedLine === '' || /^[\/\*\s]*$/.test(trimmedLine)) continue;

        if (REGEX_ALGORITHM.test(trimmedLine)) { isInsideAlgorithmBlock = true; continue; }
        if (isInsideAlgorithmBlock) {
            if (REGEX_FIN.test(trimmedLine)) isInsideAlgorithmBlock = false;
            continue;
        }
        if (REGEX_DEBUT_OR_LEXIQUE.test(trimmedLine)) continue;

        // Ignorer les déclarations de types composites
        if (PATTERNS.COMPOSITE_TYPE.test(trimmedLine)) continue;

        // Transformer les déclarations de tableaux en initialisation Lua
        const arrayDecl = REGEX_ARRAY_DECL.exec(trimmedLine);
        if (arrayDecl) {
            const varName = arrayDecl[1];
            const dimsStr = arrayDecl[2];
            const dims = smartSplitArgs(dimsStr);
            const ranges = dims.map(d => {
                const m = d.match(/^\s*(.+?)\s*\.\.\s*(.+)\s*$/);
                if (m) return { lo: m[1].trim(), hi: m[2].trim() };
                // Si le format est inattendu, fallback sur 1..n
                return { lo: '0', hi: d.trim() };
            });

            const indentation = originalLineForIndentation.match(REGEX_INDENTATION)?.[0] || '';
            let block = `${indentation}${varName} = {}` + '\n';

            // Créer des boucles pour dimensions-1 pour instancier les sous-tables
            if (ranges.length >= 2) {
                let path = varName;
                let innerIndent = indentation;
                for (let idx = 0; idx < ranges.length - 1; idx++) {
                    const it = `__i${idx + 1}`;
                    const start = `((${ranges[idx].lo})) + 1`;
                    const finish = `((${ranges[idx].hi})) + 1`;
                    block += `${innerIndent}for ${it} = ${start}, ${finish}, 1 do` + '\n';
                    innerIndent += '\t';
                    block += `${innerIndent}${path}[${it}] = {}` + '\n';
                    path += `[${it}]`;
                }
                // Fermer les boucles
                for (let idx = 0; idx < ranges.length - 1; idx++) {
                    innerIndent = indentation + '\t'.repeat(ranges.length - 1 - 1 - idx);
                    block += `${innerIndent}end` + '\n';
                }
            }

            luaCode += block;
            continue;
        }

        if (REGEX_CLOSING_BLOCKS.test(trimmedLine)) {
            const isFunctionEnd = functionStack.length > 0 && REGEX_FIN.test(trimmedLine);
            if (isFunctionEnd) {
                const funcInfo = functionStack.pop();
                if (funcInfo && funcInfo.inOutParamNames.length > 0) {
                    // Vérifier si la dernière instruction n'était pas déjà un retour
                    const lastLine = luaCode.trim().split('\n').pop() || '';
                    if (!REGEX_RETURN_LINE.test(lastLine)) {
                        const indentation = originalLineForIndentation.match(REGEX_INDENTATION)?.[0] || '';
                        luaCode += `${indentation}\treturn ${funcInfo.inOutParamNames.join(', ')}\n`;
                    }
                }
            }
            trimmedLine = 'end';
            lineIsFullyProcessed = true;
        }
        if (!lineIsFullyProcessed && REGEX_LIRE_ASSIGNMENT.test(trimmedLine)) {
            const varName = trimmedLine.split('←')[0].trim();
            // __psc_lire() gère automatiquement la conversion en nombre si possible
            trimmedLine = `${varName} = __psc_lire()`;
            lineIsFullyProcessed = true;
        }

        if (!lineIsFullyProcessed) {
            let isForLoop = false;
            trimmedLine = trimmedLine.replace(REGEX_SMART_QUOTES, '"');

            if (REGEX_FONCTION.test(trimmedLine)) {
                const funcNameMatch = REGEX_FONCTION_NAME.exec(trimmedLine);
                if (funcNameMatch && functionRegistry.has(funcNameMatch[1])) {
                    const funcInfo = functionRegistry.get(funcNameMatch[1])!;
                    functionStack.push(funcInfo);
                    const paramNames = funcInfo.params.map(p => p.name).join(', ');
                    trimmedLine = `function ${funcInfo.name}(${paramNames})`;
                }
            } else {
                const callRegex = /([\p{L}_][\p{L}0-9_]+)\s*\(([^)]*)\)/gu;
                let match;
                if (!/^\s*si|tant que|pour|écrire/i.test(trimmedLine)) {
                    while ((match = callRegex.exec(trimmedLine)) !== null) {
                        const funcName = match[1];
                        const funcInfo = functionRegistry.get(funcName);
                        if (funcInfo && funcInfo.inOutParamNames.length > 0) {
                            const args = match[2].split(',').map(a => a.trim());
                            const varsToReassign = functionRegistry.getInOutArgsToReassign(funcName, args);

                            if (varsToReassign.length > 0) {
                                const callExpression = match[0];
                                if (trimmedLine.includes('←')) {
                                    const parts = trimmedLine.split('←');
                                    const lhs = parts[0].trim();
                                    trimmedLine = `${lhs}, ${varsToReassign.join(', ')} = ${parts[1].trim()}`;
                                } else {
                                    trimmedLine = `${varsToReassign.join(', ')} = ${callExpression}`;
                                }
                                lineIsFullyProcessed = true;
                                break;
                            }
                        }
                    }
                }
            }

            if (!lineIsFullyProcessed) {
                if (REGEX_POUR_LOOP.test(trimmedLine)) {
                    // Vérifier si c'est une boucle d'itération sur table
                    const tableIterMatch = REGEX_POUR_TABLE_ITER.exec(trimmedLine);
                    if (tableIterMatch) {
                        const iterVar = tableIterMatch[1];
                        const tableVar = tableIterMatch[2];
                        trimmedLine = `for ${iterVar}, _ in pairs(${tableVar}._data) do`;
                    } else {
                        // Boucle classique
                        isForLoop = true;
                        let step = REGEX_DECROISSANT.test(trimmedLine) ? ', -1' : ', 1';
                        trimmedLine = trimmedLine.replace(REGEX_DECROISSANT, '').replace(REGEX_POUR_CLASSIC, `for $1 = $2, $3${step} do`);
                    }
                } else if (REGEX_TANT_QUE.test(trimmedLine)) {
                    trimmedLine = trimmedLine.replace(REGEX_TANT_QUE, 'while').replace(REGEX_FAIRE, ' do');
                } else if (REGEX_SI.test(trimmedLine)) {
                    trimmedLine = trimmedLine.replace(REGEX_SI, 'if').replace(REGEX_ALORS_FAIRE, ' then');
                } else if (REGEX_SINON_SI.test(trimmedLine)) {
                    trimmedLine = trimmedLine.replace(REGEX_SINON_SI, 'elseif').replace(REGEX_ALORS_FAIRE, ' then');
                } else if (REGEX_SINON.test(trimmedLine)) {
                    trimmedLine = trimmedLine.replace(REGEX_SINON, 'else');
                }
            }

            // Transformer les constructeurs et littéraux de types composites
            trimmedLine = compositeTypeRegistry.transform(trimmedLine);

            // Transformer les littéraux de liste entre parenthèses en appels helper
            trimmedLine = transformParenListLiterals(trimmedLine);

            // ========== FONCTIONS CONSTRUCTEURS POUR TYPES DE DONNÉES ==========
            // Syntaxes explicites pour créer chaque type de structure

            // 1. liste(a, b, c) → __psc_liste_from_table({a, b, c})
            trimmedLine = trimmedLine.replace(/\bliste\s*\(([^)]*)\)/gi, (match, args) => {
                const closePos = findMatchingParen(match, match.indexOf('('));
                if (closePos !== -1) {
                    const innerArgs = match.slice(match.indexOf('(') + 1, closePos);
                    return `__psc_liste_from_table({${innerArgs}})`;
                }
                return `__psc_liste_from_table({${args}})`;
            });

            // 2. listeSym(a, b, c) → __psc_listesym_from_table({a, b, c})
            trimmedLine = trimmedLine.replace(/\blisteSym\s*\(([^)]*)\)/gi, (match, args) => {
                const closePos = findMatchingParen(match, match.indexOf('('));
                if (closePos !== -1) {
                    const innerArgs = match.slice(match.indexOf('(') + 1, closePos);
                    return `__psc_listesym_from_table({${innerArgs}})`;
                }
                return `__psc_listesym_from_table({${args}})`;
            });

            // 3. pile(a, b, c) → pile avec éléments initiaux
            trimmedLine = trimmedLine.replace(/\bpile\s*\(([^)]*)\)/gi, (match, args) => {
                if (args.trim() === '') {
                    return '__psc_pile_vide()';
                }
                return `__psc_pile_from_values({${args}})`;
            });

            // 4. file(a, b, c) → file avec éléments initiaux
            trimmedLine = trimmedLine.replace(/\bfile\s*\(([^)]*)\)/gi, (match, args) => {
                if (args.trim() === '') {
                    return '__psc_file_vide()';
                }
                return `__psc_file_from_values({${args}})`;
            });

            // 5. Table("Alice" → "1234", "Bob" → "5678") → table avec paires clé-valeur
            trimmedLine = trimmedLine.replace(/\bTable\s*\(([^)]+)\)/gi, (match, args) => {
                // Remplacer les flèches → par des virgules pour séparer clés et valeurs
                const normalizedArgs = args.replace(/\s*→\s*/g, ', ');
                return `__psc_table_from_pairs(${normalizedArgs})`;
            });

            // ========== TRAITEMENT SPÉCIAL DES FONCTIONS DE CHAÎNES ==========
            // Ces fonctions ne se mappent pas directement à des fonctions Lua

            // 1. longueur(x) -> #x
            trimmedLine = trimmedLine.replace(/\blongueur\s*\(([^)]+)\)/gi, (match, arg) => {
                const cleanArg = arg.trim();
                return `#${cleanArg}`;
            });

            // 2. concat(a, b) -> a .. b
            trimmedLine = trimmedLine.replace(/\bconcat\s*\(([^)]+)\)/gi, (match, args) => {
                const parts = smartSplitArgs(args);
                if (parts.length === 2) {
                    return `${parts[0].trim()} .. ${parts[1].trim()}`;
                }
                return match; // Si pas exactement 2 args, on laisse tel quel
            });

            // 3. ième(s, i) -> string.sub(s, i, i)
            trimmedLine = trimmedLine.replace(/\bième\s*\(([^)]+)\)/gi, (match, args) => {
                const parts = smartSplitArgs(args);
                if (parts.length === 2) {
                    const str = parts[0].trim();
                    const idx = parts[1].trim();
                    return `string.sub(${str}, ${idx}, ${idx})`;
                }
                return match;
            });

            // 4. souschaîne(s, i, j) -> string.sub(s, i, j)
            trimmedLine = trimmedLine.replace(/\bsouschaîne\s*\(([^)]+)\)/gi, (match, args) => {
                const parts = smartSplitArgs(args);
                if (parts.length === 3) {
                    return `string.sub(${parts[0].trim()}, ${parts[1].trim()}, ${parts[2].trim()})`;
                }
                return match;
            });

            // Appliquer le mapping des fonctions PSC -> helpers Lua (incluant TDA Liste)
            // On trie par longueur décroissante pour éviter qu'un préfixe remplace un nom plus long
            const sortedFunctions = [...PSC_DEFINITIONS.functions].sort((a, b) => b.name.length - a.name.length);

            // Traiter les fonctions mutateurs en premier (celles qui modifient le premier argument)
            const mutatorsHandled = new Set<string>();

            for (const func of sortedFunctions) {
                if (func.isMutator) {
                    // Pattern pour capturer les appels de fonction mutateur
                    const funcCallRegex = new RegExp(`\\b(${func.name})\\s*\\(([^)]+)\\)`, 'giu');
                    let match: RegExpExecArray | null;
                    const newLine: string[] = [];
                    let lastIndex = 0;

                    while ((match = funcCallRegex.exec(trimmedLine)) !== null) {
                        const fullCall = match[0];
                        const argsStr = match[2];
                        const args = smartSplitArgs(argsStr);

                        if (args.length > 0) {
                            const firstArg = args[0].trim();
                            // Vérifier si ce n'est pas déjà une affectation
                            const beforeCall = trimmedLine.substring(0, match.index);
                            const isAlreadyAssignment = /[\w\s,]+\s*=\s*$/.test(beforeCall);

                            if (!isAlreadyAssignment && !/^\s*(if|while|elseif|return)\b/i.test(trimmedLine)) {
                                // Transformer en affectation: firstArg = func(firstArg, ...)
                                newLine.push(trimmedLine.substring(lastIndex, match.index));
                                newLine.push(`${firstArg} = ${func.luaHelper}(${argsStr})`);
                                lastIndex = match.index + fullCall.length;
                                mutatorsHandled.add(func.name.toLowerCase());
                            }
                        }
                    }

                    if (lastIndex > 0) {
                        newLine.push(trimmedLine.substring(lastIndex));
                        trimmedLine = newLine.join('');
                    }
                }
            }

            // Ensuite, remplacer les autres fonctions normalement
            const specialStringFunctions = new Set(['longueur', 'concat', 'ième', 'souschaîne']);

            for (const func of sortedFunctions) {
                // Sauter si déjà traité comme mutateur ou fonction spéciale de chaîne
                if (mutatorsHandled.has(func.name.toLowerCase()) || specialStringFunctions.has(func.name.toLowerCase())) {
                    continue;
                }

                // Utiliser une regex qui respecte les frontières de mots pour éviter les remplacements partiels
                const re = new RegExp(`(?<![\\p{L}0-9_])${func.name}\\b`, 'giu');
                trimmedLine = trimmedLine.replace(re, func.luaHelper);
            }

            // Remplacements spécifiques pour les opérateurs et mots-clés

            // Traitement spécifique de 'retourner' pour inclure les paramètres InOut
            if (REGEX_RETOURNER.test(trimmedLine)) {
                const currentFunc = functionStack.length > 0 ? functionStack[functionStack.length - 1] : null;
                let inOutSuffix = '';
                if (currentFunc && currentFunc.inOutParamNames.length > 0) {
                    inOutSuffix = ', ' + currentFunc.inOutParamNames.join(', ');
                }

                if (REGEX_RETOURNER_PAREN.test(trimmedLine)) {
                    // retourner(val) -> return val, inOut...
                    trimmedLine = trimmedLine.replace(/^\s*retourne(?:r)?\s*\((.*)\)/i, (m, val) => `return ${val}${inOutSuffix}`);
                } else {
                    // retourner val ou retourner
                    const valMatch = REGEX_RETOURNER_VALUE.exec(trimmedLine);
                    if (valMatch) {
                        trimmedLine = `return ${valMatch[1]}${inOutSuffix}`;
                    } else {
                        // Juste retourner
                        if (inOutSuffix) {
                            // Si retour vide mais on a des InOut, on retourne les InOut
                            trimmedLine = `return ${inOutSuffix.substring(2)}`; // enlever ', ' initial
                        } else {
                            trimmedLine = 'return';
                        }
                    }
                }
            } else {
                // Si ce n'est pas un 'retourner', on applique le remplacement standard (au cas où)
                trimmedLine = trimmedLine
                    .replace(/\bretourne(?:r)?\s*\((.*)\)/gi, 'return $1').replace(/\bretourne(?:r)?\b/gi, 'return');
            }

            trimmedLine = trimmedLine
                .replace(/\bvrai\b/gi, 'true').replace(/\bfaux\b/gi, 'false')
                .replace(/\bnon\b/gi, 'not').replace(/\bou\b/gi, 'or').replace(/\bet\b/gi, 'and')
                .replace(/\bmod\b/gi, '%').replace(/≠/g, '~=').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/÷/g, '//')
                .replace(/\bFIN_LIGNE\b/g, "'\\n'");

            if (!isForLoop && !lineIsFullyProcessed) {
                const conditionEq = (s: string) => s.replace(/(^|[^<>=~])=(?!=)/g, '$1==');
                let handledCondition = false;
                // Cibler uniquement les conditions if/elseif/while (regex pré-compilées)
                trimmedLine = trimmedLine.replace(REGEX_IF_CONDITION, (_m, p1, cond, p3) => {
                    handledCondition = true;
                    return `${p1}${conditionEq(cond)}${p3}`;
                });
                trimmedLine = trimmedLine.replace(REGEX_ELSEIF_CONDITION, (_m, p1, cond, p3) => {
                    handledCondition = true;
                    return `${p1}${conditionEq(cond)}${p3}`;
                });
                trimmedLine = trimmedLine.replace(REGEX_WHILE_CONDITION, (_m, p1, cond, p3) => {
                    handledCondition = true;
                    return `${p1}${conditionEq(cond)}${p3}`;
                });

                if (!handledCondition) {
                    const isReturnLine = REGEX_RETURN_LINE.test(trimmedLine);
                    const parts = trimmedLine.split(/(__PSC_TABLE_START__|__PSC_TABLE_END__)/g);
                    for (let i = 0; i < parts.length; i += 4) {
                        if (isReturnLine) {
                            // Dans une expression de retour, '=' est toujours une comparaison
                            parts[i] = parts[i].replace(/([^<>=~])=(?!=)/g, '$1==');
                        } else {
                            // Protéger les affectations générées (ex: l = __psc_liste_...)
                            parts[i] = parts[i].replace(/(\s)=(\s)/g, '$1__PSC_ASSIGN__$2');
                            // Convertir les comparaisons '=' en '==' (sans lookbehind)
                            parts[i] = parts[i].replace(/([^<>=~])=(?!=)/g, '$1==');
                            // Restaurer les affectations
                            parts[i] = parts[i].replace(/__PSC_ASSIGN__/g, '=');
                        }
                    }
                    trimmedLine = parts.join('');
                }
            }

            trimmedLine = trimmedLine
                .replace(/\s*←\s*/g, ' = ')
                .replace(/lire\s*\(\)/gi, '__psc_lire()');

            // Nettoyer les marqueurs de table
            trimmedLine = trimmedLine.replace(/__PSC_TABLE_START__/g, '').replace(/__PSC_TABLE_END__/g, '');

            // 0) Étendre les indices séparés par des virgules: a[i, j] -> a[i][j]
            REGEX_MULTI_INDEX.lastIndex = 0;
            trimmedLine = trimmedLine.replace(REGEX_MULTI_INDEX, (m, name, inside) => {
                const indices = smartSplitArgs(inside);
                if (indices.length > 1) {
                    return name + indices.map(id => `[${id}]`).join('');
                }
                return m;
            });

            // 1) Convertir les accès multidimensionnels: a[i][j] -> a[(i)+1][(j)+1]
            REGEX_MULTI_BRACKET.lastIndex = 0;
            trimmedLine = trimmedLine.replace(REGEX_MULTI_BRACKET, (m, name, brackets) => {
                const parts: string[] = [];
                REGEX_BRACKET_EXTRACT.lastIndex = 0;
                let mm: RegExpExecArray | null;
                while ((mm = REGEX_BRACKET_EXTRACT.exec(brackets)) !== null) {
                    const expr = (mm[1] || '').trim();
                    const indices = smartSplitArgs(expr);
                    if (indices.length > 1) {
                        for (const idx of indices) {
                            const id = (idx || '').trim();
                            if (id) parts.push(`[(${id}) + 1]`);
                        }
                    } else {
                        parts.push(`[(${expr}) + 1]`);
                    }
                }
                return name + parts.join('');
            });

            // 2) Convertir uniquement les littéraux de tableaux: [1,2] -> {1,2}
            REGEX_ARRAY_LITERAL.lastIndex = 0;
            trimmedLine = trimmedLine.replace(REGEX_ARRAY_LITERAL, '{$1}');
        }

        if (REGEX_ECRIRE.test(trimmedLine)) {
            const openParenIndex = trimmedLine.indexOf('(');
            trimmedLine = '__psc_write' + trimmedLine.substring(openParenIndex);
        }

        const indentation = originalLineForIndentation.match(REGEX_INDENTATION)?.[0] || '';
        const finalComment = commentPart ? ' ' + commentPart.trim() : '';
        luaCode += indentation + trimmedLine + finalComment + '\n';
    }

    const helpers = LUA_HELPERS;
    return helpers + luaCode;
}

export function executeCode(document: vscode.TextDocument) {
    const pscCode = document.getText();
    const luaCode = transpileToLua(pscCode);

    console.log("--- Code Lua généré ---\n", luaCode, "\n--------------------------");

    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `psc_temp_${Date.now()}.lua`);
    fs.writeFileSync(tempFilePath, luaCode);

    const terminalName = "Pseudo-Code Execution";
    let terminal = vscode.window.terminals.find(t => t.name === terminalName);
    if (!terminal) {
        terminal = vscode.window.createTerminal(terminalName);
    }
    terminal.show(true);

    const command = `lua "${tempFilePath}"`;
    terminal.sendText(command, true);
}