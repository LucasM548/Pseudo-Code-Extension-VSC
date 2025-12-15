"use strict";
/**
 * Transpileur Pseudo-Code vers Lua
 */
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transpileToLua = transpileToLua;
exports.executeCode = executeCode;
var vscode = require("vscode");
var fs = require("fs");
var path = require("path");
var os = require("os");
var constants_1 = require("./constants");
var definitions_1 = require("./definitions");
var utils_1 = require("./utils");
var functionRegistry_1 = require("./functionRegistry");
var compositeTypes_1 = require("./compositeTypes");
// ═══════════════════════════════════════════════════════════════════════════════
// REGEX PRÉ-COMPILÉES (éviter la recompilation à chaque ligne)
// ═══════════════════════════════════════════════════════════════════════════════
var REGEX_BUILTIN_TYPES = /^(entier|réel|booléen|booleen|chaîne|chaine|caractère|caractere|tableau|liste|pile|file|listesym)$/i;
var REGEX_INOUT = /\bInOut\b/i;
var REGEX_TYPE_NAME = /^([\p{L}0-9_]+)/iu;
var REGEX_BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
var REGEX_LEXIQUE_BLOCK = /Lexique\s*:?[\s\S]*?(?=\n\s*(?:Début|Fonction|Algorithme|$))/i;
var REGEX_SMART_QUOTES = /[""]/g;
var REGEX_ALGORITHM = /^\s*algorithme\b/i;
var REGEX_FIN = /^\s*Fin\b/i;
var REGEX_DEBUT_OR_LEXIQUE = /^\s*(Début|Lexique)\b/i;
var REGEX_CLOSING_BLOCKS = /^\s*(Fin|fsi|fpour|ftq|ftant)\b/i;
var REGEX_LIRE_ASSIGNMENT = /^\s*[\p{L}0-9_]+\s*←\s*lire\s*\(\s*\)\s*$/iu;
var REGEX_FONCTION = /^\s*fonction\s/i;
var REGEX_FONCTION_NAME = /^\s*Fonction\s+([\p{L}_][\p{L}0-9_]*)/iu;
var REGEX_POUR_LOOP = /^\s*Pour\s/i;
var REGEX_POUR_TABLE_ITER = /^\s*Pour\s+([^\s]+)\s+de\s+([^\s]+)\s+Faire\s*:?$/i;
var REGEX_POUR_CLASSIC = /^\s*Pour\s+([\p{L}0-9_]+)\s+(?:allant de|de)\s+(.+)\s+(?:a|à)\s+(.+)\s+Faire\s*:?/iu;
var REGEX_DECROISSANT = /\bdécroissant\b/i;
var REGEX_TANT_QUE = /^\s*Tant que\b/i;
var REGEX_FAIRE = /\s+Faire\s*:?/i;
var REGEX_SI = /^\s*Si\b/i;
var REGEX_SINON_SI = /^\s*Sinon\s+si\b/i;
var REGEX_SINON = /^\s*Sinon\b\s*:?/i;
var REGEX_ALORS_FAIRE = /\s+(Alors|Faire)\s*:?/i;
var REGEX_ECRIRE = /^écrire\(/i;
var REGEX_RETOURNER = /^\s*retourne(?:r)?\b/i;
var REGEX_RETOURNER_PAREN = /^\s*retourne(?:r)?\s*\(/i;
var REGEX_RETOURNER_VALUE = /^\s*retourne(?:r)?\s+(.+)$/i;
var REGEX_RETURN_LINE = /^\s*return\b/i;
var REGEX_IF_CONDITION = /^(\s*if\s+)(.*?)(\s+then\s*:?)\s*$/i;
var REGEX_ELSEIF_CONDITION = /^(\s*elseif\s+)(.*?)(\s+then\s*:?)\s*$/i;
var REGEX_WHILE_CONDITION = /^(\s*while\s+)(.*?)(\s+do\s*:?)\s*$/i;
var REGEX_ARRAY_DECL = /^\s*([\p{L}_][\p{L}0-9_]*)\s*(?:=|←)\s*tableau\s+[\p{L}_][\p{L}0-9_]*\s*\[([^\]]+)\]\s*$/iu;
var REGEX_INDENTATION = /^\s*/;
var REGEX_MULTI_INDEX = /([\p{L}0-9_]+)\s*\[([^\]]+)\]/gu;
var REGEX_MULTI_BRACKET = /([\p{L}0-9_]+)\s*((?:\[[^\]]+\])+)/gu;
var REGEX_BRACKET_EXTRACT = /\[([^\]]+)\]/g;
var REGEX_ARRAY_LITERAL = /(?:(?<=^)|(?<=[\s=,(;:]))\[([^\]]*)\]/gu;
/**
 * Collecte les types de variables déclarées dans le code
 */
function collectVariableTypes(pscCode) {
    var variableTypes = new Map();
    var lines = pscCode.split('\n');
    var _loop_1 = function (line) {
        var trimmedLine = line.trim();
        // Déclarations de variables simples
        var declarationMatch = constants_1.PATTERNS.VARIABLE_DECLARATION.exec(trimmedLine);
        if (declarationMatch && !constants_1.PATTERNS.FUNCTION_DECLARATION.test(trimmedLine)) {
            var rawType = declarationMatch[2];
            var type_1 = REGEX_BUILTIN_TYPES.test(rawType)
                ? (0, utils_1.normalizeType)(rawType)
                : rawType;
            var varNames = declarationMatch[1].split(',').map(function (v) { return v.trim(); });
            varNames.forEach(function (v) {
                if (v)
                    variableTypes.set(v, type_1);
            });
        }
        // Paramètres de fonction
        var funcMatch = constants_1.PATTERNS.FUNCTION_DECLARATION.exec(trimmedLine);
        if (funcMatch) {
            var paramsString = funcMatch[2];
            // Trouver la parenthèse fermante qui correspond à l'ouverture
            var depth = 0;
            var endOfParams = -1;
            for (var i = 0; i < paramsString.length; i++) {
                if (paramsString[i] === '(')
                    depth++;
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
            var params = (0, utils_1.smartSplitArgs)(paramsString);
            params.forEach(function (p) {
                var parts = p.split(':').map(function (part) { return part.trim(); });
                if (parts.length === 2) {
                    var varName = parts[0].replace(REGEX_INOUT, '').trim();
                    var rawTypeName = parts[1];
                    var typeMatch = rawTypeName.match(REGEX_TYPE_NAME);
                    if (typeMatch) {
                        var typeName = typeMatch[1];
                        var finalType = REGEX_BUILTIN_TYPES.test(typeName)
                            ? (0, utils_1.normalizeType)(typeName)
                            : typeName;
                        if (varName)
                            variableTypes.set(varName, finalType);
                    }
                }
            });
        }
    };
    for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
        var line = lines_1[_i];
        _loop_1(line);
    }
    return variableTypes;
}
/**
 * Transpile le code Pseudo-Code en code Lua exécutable.
 * @param pscCode Le code source en Pseudo-Code.
 * @returns Le code Lua transpilé.
 */
function transpileToLua(pscCode) {
    var _a, _b, _c;
    var functionRegistry = new functionRegistry_1.FunctionRegistry();
    functionRegistry.collect(pscCode);
    var compositeTypeRegistry = new compositeTypes_1.CompositeTypeRegistry();
    compositeTypeRegistry.collect(pscCode);
    var variableTypes = collectVariableTypes(pscCode);
    var cleanedCode = pscCode.replace(REGEX_BLOCK_COMMENT, '');
    cleanedCode = cleanedCode.replace(REGEX_LEXIQUE_BLOCK, '');
    var luaCode = '';
    var lines = cleanedCode.split('\n');
    var isInsideAlgorithmBlock = false;
    var functionStack = [];
    // Convertit des parenthèses non appel de fonction en littéraux de liste: (x, y) -> __psc_liste_from_table({x, y})
    var transformParenListLiterals = function (input) {
        var isIdent = function (ch) { return /[\p{L}0-9_]/u.test(ch); };
        var allowedPrev = function (ch) {
            if (!ch)
                return true; // début de ligne
            return /[\s=,(;:\[]/.test(ch);
        };
        var isDisallowedPrevWord = function (prefix) {
            var m = prefix.match(/([\p{L}_][\p{L}0-9_]*)\s*$/u);
            var w = m ? m[1].toLowerCase() : '';
            return new Set(['if', 'elseif', 'while', 'for', 'return', 'function', 'local', 'not', 'then', 'do', 'else']).has(w);
        };
        var hasTopLevelComma = function (s) { return (0, utils_1.smartSplitArgs)(s).length > 1; };
        var isSimpleAtom = function (s) {
            var t = s.trim();
            if (!t)
                return false;
            if (/^"[\s\S]*"$/.test(t) || /^'(?:\\.|[^\\'])*'$/.test(t))
                return true;
            if (/^\d+(?:[.,]\d+)?$/.test(t))
                return true;
            if (/^[\p{L}_][\p{L}0-9_]*$/u.test(t))
                return true;
            // déjà transformé récursivement
            if (/^__psc_liste_from_table\s*\(/.test(t))
                return true;
            if (/^\{[\s\S]*\}$/.test(t))
                return true; // table Lua
            return false;
        };
        var process = function (str) {
            var i = 0;
            var out = '';
            while (i < str.length) {
                var ch = str[i];
                if (ch === '(') {
                    var prev = i > 0 ? str[i - 1] : undefined;
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
                        var closeSkip = (0, utils_1.findMatchingParen)(str, i);
                        if (closeSkip !== -1) {
                            out += '(' + process(str.slice(i + 1, closeSkip)) + ')';
                            i = closeSkip + 1;
                            continue;
                        }
                    }
                    var close_1 = (0, utils_1.findMatchingParen)(str, i);
                    if (close_1 === -1) {
                        out += ch;
                        i++;
                        continue;
                    }
                    var insideRaw = str.slice(i + 1, close_1);
                    // Traiter récursivement l'intérieur d'abord (pour listes imbriquées)
                    var inside = process(insideRaw);
                    var args = (0, utils_1.smartSplitArgs)(inside);
                    var shouldTransform = args.length > 1 || (args.length === 1 && isSimpleAtom(args[0]));
                    if (shouldTransform) {
                        out += "__psc_liste_from_table({".concat(args.join(', '), "})");
                        i = close_1 + 1;
                        continue;
                    }
                    else {
                        // Ne pas transformer (groupe arithmétique, etc.)
                        out += '(' + inside + ')';
                        i = close_1 + 1;
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
    var _loop_2 = function (line) {
        var originalLineForIndentation = line;
        var textToProcess = line;
        var commentIndex = textToProcess.indexOf('//');
        var commentPart = '';
        if (commentIndex !== -1) {
            commentPart = textToProcess.substring(commentIndex).replace(/^\/\//, '--');
            textToProcess = textToProcess.substring(0, commentIndex);
        }
        var trimmedLine = textToProcess.trim();
        var lineIsFullyProcessed = false;
        // Ignorer les lignes vides et les lignes qui ne contiennent que des caractères de ponctuation résiduels
        if (trimmedLine === '' || /^[\/\*\s]*$/.test(trimmedLine))
            return "continue";
        if (REGEX_ALGORITHM.test(trimmedLine)) {
            isInsideAlgorithmBlock = true;
            return "continue";
        }
        if (isInsideAlgorithmBlock) {
            if (REGEX_FIN.test(trimmedLine))
                isInsideAlgorithmBlock = false;
            return "continue";
        }
        if (REGEX_DEBUT_OR_LEXIQUE.test(trimmedLine))
            return "continue";
        // Ignorer les déclarations de types composites
        if (constants_1.PATTERNS.COMPOSITE_TYPE.test(trimmedLine))
            return "continue";
        // Transformer les déclarations de tableaux en initialisation Lua
        var arrayDecl = REGEX_ARRAY_DECL.exec(trimmedLine);
        if (arrayDecl) {
            var varName = arrayDecl[1];
            var dimsStr = arrayDecl[2];
            var dims = (0, utils_1.smartSplitArgs)(dimsStr);
            var ranges = dims.map(function (d) {
                var m = d.match(/^\s*(.+?)\s*\.\.\s*(.+)\s*$/);
                if (m)
                    return { lo: m[1].trim(), hi: m[2].trim() };
                // Si le format est inattendu, fallback sur 1..n
                return { lo: '0', hi: d.trim() };
            });
            var indentation_1 = ((_a = originalLineForIndentation.match(REGEX_INDENTATION)) === null || _a === void 0 ? void 0 : _a[0]) || '';
            var block = "".concat(indentation_1).concat(varName, " = {}") + '\n';
            // Créer des boucles pour dimensions-1 pour instancier les sous-tables
            if (ranges.length >= 2) {
                var path_1 = varName;
                var innerIndent = indentation_1;
                for (var idx = 0; idx < ranges.length - 1; idx++) {
                    var it_1 = "__i".concat(idx + 1);
                    var start = "((".concat(ranges[idx].lo, ")) + 1");
                    var finish = "((".concat(ranges[idx].hi, ")) + 1");
                    block += "".concat(innerIndent, "for ").concat(it_1, " = ").concat(start, ", ").concat(finish, ", 1 do") + '\n';
                    innerIndent += '\t';
                    block += "".concat(innerIndent).concat(path_1, "[").concat(it_1, "] = {}") + '\n';
                    path_1 += "[".concat(it_1, "]");
                }
                // Fermer les boucles
                for (var idx = 0; idx < ranges.length - 1; idx++) {
                    innerIndent = indentation_1 + '\t'.repeat(ranges.length - 1 - 1 - idx);
                    block += "".concat(innerIndent, "end") + '\n';
                }
            }
            luaCode += block;
            return "continue";
        }
        if (REGEX_CLOSING_BLOCKS.test(trimmedLine)) {
            var isFunctionEnd = functionStack.length > 0 && REGEX_FIN.test(trimmedLine);
            if (isFunctionEnd) {
                var funcInfo = functionStack.pop();
                if (funcInfo && funcInfo.inOutParamNames.length > 0) {
                    // Vérifier si la dernière instruction n'était pas déjà un retour
                    var lastLine = luaCode.trim().split('\n').pop() || '';
                    if (!REGEX_RETURN_LINE.test(lastLine)) {
                        var indentation_2 = ((_b = originalLineForIndentation.match(REGEX_INDENTATION)) === null || _b === void 0 ? void 0 : _b[0]) || '';
                        luaCode += "".concat(indentation_2, "\treturn ").concat(funcInfo.inOutParamNames.join(', '), "\n");
                    }
                }
            }
            trimmedLine = 'end';
            lineIsFullyProcessed = true;
        }
        if (!lineIsFullyProcessed && REGEX_LIRE_ASSIGNMENT.test(trimmedLine)) {
            var varName = trimmedLine.split('←')[0].trim();
            // __psc_lire() gère automatiquement la conversion en nombre si possible
            trimmedLine = "".concat(varName, " = __psc_lire()");
            lineIsFullyProcessed = true;
        }
        if (!lineIsFullyProcessed) {
            var isForLoop = false;
            trimmedLine = trimmedLine.replace(REGEX_SMART_QUOTES, '"');
            if (REGEX_FONCTION.test(trimmedLine)) {
                var funcNameMatch = REGEX_FONCTION_NAME.exec(trimmedLine);
                if (funcNameMatch && functionRegistry.has(funcNameMatch[1])) {
                    var funcInfo = functionRegistry.get(funcNameMatch[1]);
                    functionStack.push(funcInfo);
                    var paramNames = funcInfo.params.map(function (p) { return p.name; }).join(', ');
                    trimmedLine = "function ".concat(funcInfo.name, "(").concat(paramNames, ")");
                }
            }
            else {
                var callRegex = /([\p{L}_][\p{L}0-9_]+)\s*\(([^)]*)\)/gu;
                var match = void 0;
                if (!/^\s*si|tant que|pour|écrire/i.test(trimmedLine)) {
                    while ((match = callRegex.exec(trimmedLine)) !== null) {
                        var funcName = match[1];
                        var funcInfo = functionRegistry.get(funcName);
                        if (funcInfo && funcInfo.inOutParamNames.length > 0) {
                            var args = match[2].split(',').map(function (a) { return a.trim(); });
                            var varsToReassign = functionRegistry.getInOutArgsToReassign(funcName, args);
                            if (varsToReassign.length > 0) {
                                var callExpression = match[0];
                                if (trimmedLine.includes('←')) {
                                    var parts = trimmedLine.split('←');
                                    var lhs = parts[0].trim();
                                    trimmedLine = "".concat(lhs, ", ").concat(varsToReassign.join(', '), " = ").concat(parts[1].trim());
                                }
                                else {
                                    trimmedLine = "".concat(varsToReassign.join(', '), " = ").concat(callExpression);
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
                    var tableIterMatch = REGEX_POUR_TABLE_ITER.exec(trimmedLine);
                    if (tableIterMatch) {
                        var iterVar = tableIterMatch[1];
                        var tableVar = tableIterMatch[2];
                        trimmedLine = "for ".concat(iterVar, ", _ in pairs(").concat(tableVar, "._data) do");
                    }
                    else {
                        // Boucle classique
                        isForLoop = true;
                        var step = REGEX_DECROISSANT.test(trimmedLine) ? ', -1' : ', 1';
                        trimmedLine = trimmedLine.replace(REGEX_DECROISSANT, '').replace(REGEX_POUR_CLASSIC, "for $1 = $2, $3".concat(step, " do"));
                    }
                }
                else if (REGEX_TANT_QUE.test(trimmedLine)) {
                    trimmedLine = trimmedLine.replace(REGEX_TANT_QUE, 'while').replace(REGEX_FAIRE, ' do');
                }
                else if (REGEX_SI.test(trimmedLine)) {
                    trimmedLine = trimmedLine.replace(REGEX_SI, 'if').replace(REGEX_ALORS_FAIRE, ' then');
                }
                else if (REGEX_SINON_SI.test(trimmedLine)) {
                    trimmedLine = trimmedLine.replace(REGEX_SINON_SI, 'elseif').replace(REGEX_ALORS_FAIRE, ' then');
                }
                else if (REGEX_SINON.test(trimmedLine)) {
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
            trimmedLine = trimmedLine.replace(/\bliste\s*\(([^)]*)\)/gi, function (match, args) {
                var closePos = (0, utils_1.findMatchingParen)(match, match.indexOf('('));
                if (closePos !== -1) {
                    var innerArgs = match.slice(match.indexOf('(') + 1, closePos);
                    return "__psc_liste_from_table({".concat(innerArgs, "})");
                }
                return "__psc_liste_from_table({".concat(args, "})");
            });
            // 2. listeSym(a, b, c) → __psc_listesym_from_table({a, b, c})
            trimmedLine = trimmedLine.replace(/\blisteSym\s*\(([^)]*)\)/gi, function (match, args) {
                var closePos = (0, utils_1.findMatchingParen)(match, match.indexOf('('));
                if (closePos !== -1) {
                    var innerArgs = match.slice(match.indexOf('(') + 1, closePos);
                    return "__psc_listesym_from_table({".concat(innerArgs, "})");
                }
                return "__psc_listesym_from_table({".concat(args, "})");
            });
            // 3. pile(a, b, c) → pile avec éléments initiaux
            trimmedLine = trimmedLine.replace(/\bpile\s*\(([^)]*)\)/gi, function (match, args) {
                if (args.trim() === '') {
                    return '__psc_pile_vide()';
                }
                return "__psc_pile_from_values({".concat(args, "})");
            });
            // 4. file(a, b, c) → file avec éléments initiaux
            trimmedLine = trimmedLine.replace(/\bfile\s*\(([^)]*)\)/gi, function (match, args) {
                if (args.trim() === '') {
                    return '__psc_file_vide()';
                }
                return "__psc_file_from_values({".concat(args, "})");
            });
            // 5. Table("Alice" → "1234", "Bob" → "5678") → table avec paires clé-valeur
            trimmedLine = trimmedLine.replace(/\bTable\s*\(([^)]+)\)/gi, function (match, args) {
                // Remplacer les flèches → par des virgules pour séparer clés et valeurs
                var normalizedArgs = args.replace(/\s*→\s*/g, ', ');
                return "__psc_table_from_pairs(".concat(normalizedArgs, ")");
            });
            // ========== TRAITEMENT SPÉCIAL DES FONCTIONS DE CHAÎNES ==========
            // Ces fonctions ne se mappent pas directement à des fonctions Lua
            // 1. longueur(x) -> #x
            trimmedLine = trimmedLine.replace(/\blongueur\s*\(([^)]+)\)/gi, function (match, arg) {
                var cleanArg = arg.trim();
                return "#".concat(cleanArg);
            });
            // 2. concat(a, b) -> a .. b
            trimmedLine = trimmedLine.replace(/\bconcat\s*\(([^)]+)\)/gi, function (match, args) {
                var parts = (0, utils_1.smartSplitArgs)(args);
                if (parts.length === 2) {
                    return "".concat(parts[0].trim(), " .. ").concat(parts[1].trim());
                }
                return match; // Si pas exactement 2 args, on laisse tel quel
            });
            // 3. ième(s, i) -> string.sub(s, i, i)
            trimmedLine = trimmedLine.replace(/\bième\s*\(([^)]+)\)/gi, function (match, args) {
                var parts = (0, utils_1.smartSplitArgs)(args);
                if (parts.length === 2) {
                    var str = parts[0].trim();
                    var idx = parts[1].trim();
                    return "string.sub(".concat(str, ", ").concat(idx, ", ").concat(idx, ")");
                }
                return match;
            });
            // 4. souschaîne(s, i, j) -> string.sub(s, i, j)
            trimmedLine = trimmedLine.replace(/\bsouschaîne\s*\(([^)]+)\)/gi, function (match, args) {
                var parts = (0, utils_1.smartSplitArgs)(args);
                if (parts.length === 3) {
                    return "string.sub(".concat(parts[0].trim(), ", ").concat(parts[1].trim(), ", ").concat(parts[2].trim(), ")");
                }
                return match;
            });
            // Appliquer le mapping des fonctions PSC -> helpers Lua (incluant TDA Liste)
            // On trie par longueur décroissante pour éviter qu'un préfixe remplace un nom plus long
            var sortedFunctions = __spreadArray([], definitions_1.PSC_DEFINITIONS.functions, true).sort(function (a, b) { return b.name.length - a.name.length; });
            // Traiter les fonctions mutateurs en premier (celles qui modifient le premier argument)
            var mutatorsHandled = new Set();
            for (var _d = 0, sortedFunctions_1 = sortedFunctions; _d < sortedFunctions_1.length; _d++) {
                var func = sortedFunctions_1[_d];
                if (func.isMutator) {
                    // Pattern pour capturer les appels de fonction mutateur
                    var funcCallRegex = new RegExp("\\b(".concat(func.name, ")\\s*\\(([^)]+)\\)"), 'giu');
                    var match = void 0;
                    var newLine = [];
                    var lastIndex = 0;
                    while ((match = funcCallRegex.exec(trimmedLine)) !== null) {
                        var fullCall = match[0];
                        var argsStr = match[2];
                        var args = (0, utils_1.smartSplitArgs)(argsStr);
                        if (args.length > 0) {
                            var firstArg = args[0].trim();
                            // Vérifier si ce n'est pas déjà une affectation
                            var beforeCall = trimmedLine.substring(0, match.index);
                            var isAlreadyAssignment = /[\w\s,]+\s*=\s*$/.test(beforeCall);
                            if (!isAlreadyAssignment && !/^\s*(if|while|elseif|return)\b/i.test(trimmedLine)) {
                                // Transformer en affectation: firstArg = func(firstArg, ...)
                                newLine.push(trimmedLine.substring(lastIndex, match.index));
                                newLine.push("".concat(firstArg, " = ").concat(func.luaHelper, "(").concat(argsStr, ")"));
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
            var specialStringFunctions = new Set(['longueur', 'concat', 'ième', 'souschaîne']);
            for (var _e = 0, sortedFunctions_2 = sortedFunctions; _e < sortedFunctions_2.length; _e++) {
                var func = sortedFunctions_2[_e];
                // Sauter si déjà traité comme mutateur ou fonction spéciale de chaîne
                if (mutatorsHandled.has(func.name.toLowerCase()) || specialStringFunctions.has(func.name.toLowerCase())) {
                    continue;
                }
                // Utiliser une regex qui respecte les frontières de mots pour éviter les remplacements partiels
                var re = new RegExp("(?<![\\p{L}0-9_])".concat(func.name, "\\b"), 'giu');
                trimmedLine = trimmedLine.replace(re, func.luaHelper);
            }
            // Remplacements spécifiques pour les opérateurs et mots-clés
            // Traitement spécifique de 'retourner' pour inclure les paramètres InOut
            if (REGEX_RETOURNER.test(trimmedLine)) {
                var currentFunc = functionStack.length > 0 ? functionStack[functionStack.length - 1] : null;
                var inOutSuffix_1 = '';
                if (currentFunc && currentFunc.inOutParamNames.length > 0) {
                    inOutSuffix_1 = ', ' + currentFunc.inOutParamNames.join(', ');
                }
                if (REGEX_RETOURNER_PAREN.test(trimmedLine)) {
                    // retourner(val) -> return val, inOut...
                    trimmedLine = trimmedLine.replace(/^\s*retourne(?:r)?\s*\((.*)\)/i, function (m, val) { return "return ".concat(val).concat(inOutSuffix_1); });
                }
                else {
                    // retourner val ou retourner
                    var valMatch = REGEX_RETOURNER_VALUE.exec(trimmedLine);
                    if (valMatch) {
                        trimmedLine = "return ".concat(valMatch[1]).concat(inOutSuffix_1);
                    }
                    else {
                        // Juste retourner
                        if (inOutSuffix_1) {
                            // Si retour vide mais on a des InOut, on retourne les InOut
                            trimmedLine = "return ".concat(inOutSuffix_1.substring(2)); // enlever ', ' initial
                        }
                        else {
                            trimmedLine = 'return';
                        }
                    }
                }
            }
            else {
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
                var conditionEq_1 = function (s) { return s.replace(/(^|[^<>=~])=(?!=)/g, '$1=='); };
                var handledCondition_1 = false;
                // Cibler uniquement les conditions if/elseif/while (regex pré-compilées)
                trimmedLine = trimmedLine.replace(REGEX_IF_CONDITION, function (_m, p1, cond, p3) {
                    handledCondition_1 = true;
                    return "".concat(p1).concat(conditionEq_1(cond)).concat(p3);
                });
                trimmedLine = trimmedLine.replace(REGEX_ELSEIF_CONDITION, function (_m, p1, cond, p3) {
                    handledCondition_1 = true;
                    return "".concat(p1).concat(conditionEq_1(cond)).concat(p3);
                });
                trimmedLine = trimmedLine.replace(REGEX_WHILE_CONDITION, function (_m, p1, cond, p3) {
                    handledCondition_1 = true;
                    return "".concat(p1).concat(conditionEq_1(cond)).concat(p3);
                });
                if (!handledCondition_1) {
                    var isReturnLine = REGEX_RETURN_LINE.test(trimmedLine);
                    var parts = trimmedLine.split(/(__PSC_TABLE_START__|__PSC_TABLE_END__)/g);
                    for (var i = 0; i < parts.length; i += 4) {
                        if (isReturnLine) {
                            // Dans une expression de retour, '=' est toujours une comparaison
                            parts[i] = parts[i].replace(/([^<>=~])=(?!=)/g, '$1==');
                        }
                        else {
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
            trimmedLine = trimmedLine.replace(REGEX_MULTI_INDEX, function (m, name, inside) {
                var indices = (0, utils_1.smartSplitArgs)(inside);
                if (indices.length > 1) {
                    return name + indices.map(function (id) { return "[".concat(id, "]"); }).join('');
                }
                return m;
            });
            // 1) Convertir les accès multidimensionnels: a[i][j] -> a[(i)+1][(j)+1]
            REGEX_MULTI_BRACKET.lastIndex = 0;
            trimmedLine = trimmedLine.replace(REGEX_MULTI_BRACKET, function (m, name, brackets) {
                var parts = [];
                REGEX_BRACKET_EXTRACT.lastIndex = 0;
                var mm;
                while ((mm = REGEX_BRACKET_EXTRACT.exec(brackets)) !== null) {
                    var expr = (mm[1] || '').trim();
                    var indices = (0, utils_1.smartSplitArgs)(expr);
                    if (indices.length > 1) {
                        for (var _i = 0, indices_1 = indices; _i < indices_1.length; _i++) {
                            var idx = indices_1[_i];
                            var id = (idx || '').trim();
                            if (id)
                                parts.push("[(".concat(id, ") + 1]"));
                        }
                    }
                    else {
                        parts.push("[(".concat(expr, ") + 1]"));
                    }
                }
                return name + parts.join('');
            });
            // 2) Convertir uniquement les littéraux de tableaux: [1,2] -> {1,2}
            REGEX_ARRAY_LITERAL.lastIndex = 0;
            trimmedLine = trimmedLine.replace(REGEX_ARRAY_LITERAL, '{$1}');
        }
        if (REGEX_ECRIRE.test(trimmedLine)) {
            var openParenIndex = trimmedLine.indexOf('(');
            trimmedLine = '__psc_write' + trimmedLine.substring(openParenIndex);
        }
        var indentation = ((_c = originalLineForIndentation.match(REGEX_INDENTATION)) === null || _c === void 0 ? void 0 : _c[0]) || '';
        var finalComment = commentPart ? ' ' + commentPart.trim() : '';
        luaCode += indentation + trimmedLine + finalComment + '\n';
    };
    for (var _i = 0, lines_2 = lines; _i < lines_2.length; _i++) {
        var line = lines_2[_i];
        _loop_2(line);
    }
    var helpers = constants_1.LUA_HELPERS;
    return helpers + luaCode;
}
function executeCode(document) {
    var pscCode = document.getText();
    var luaCode = transpileToLua(pscCode);
    console.log("--- Code Lua généré ---\n", luaCode, "\n--------------------------");
    var tempDir = os.tmpdir();
    var tempFilePath = path.join(tempDir, "psc_temp_".concat(Date.now(), ".lua"));
    fs.writeFileSync(tempFilePath, luaCode);
    var terminalName = "Pseudo-Code Execution";
    var terminal = vscode.window.terminals.find(function (t) { return t.name === terminalName; });
    if (!terminal) {
        terminal = vscode.window.createTerminal(terminalName);
    }
    terminal.show(true);
    var command = "lua \"".concat(tempFilePath, "\"");
    terminal.sendText(command, true);
}
