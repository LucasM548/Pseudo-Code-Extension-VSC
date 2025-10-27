/**
 * Transpileur optimisé et simplifié pour Pseudo-Code vers Lua
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PATTERNS, LUA_REPLACEMENTS, FUNCTION_MAPPING, LUA_HELPERS } from './constants';
import { normalizeType, smartSplitArgs } from './utils';
import { FunctionRegistry } from './functionRegistry';
import { CompositeTypeRegistry } from './compositeTypes';

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
            const type = /^(entier|réel|booléen|booleen|chaîne|chaine|caractère|caractere|tableau)$/i.test(rawType)
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
                    const varName = parts[0].replace(/\bInOut\b/i, '').trim();
                    const rawTypeName = parts[1];
                    const typeMatch = rawTypeName.match(/^([\p{L}0-9_]+)/iu);
                    if (typeMatch) {
                        const typeName = typeMatch[1];
                        const finalType = /^(entier|réel|booléen|booleen|chaîne|chaine|caractère|caractere|tableau)$/i.test(typeName)
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
function transpileToLua(pscCode: string): string {
    const functionRegistry = new FunctionRegistry();
    functionRegistry.collect(pscCode);

    const compositeTypeRegistry = new CompositeTypeRegistry();
    compositeTypeRegistry.collect(pscCode);

    const variableTypes = collectVariableTypes(pscCode);

    let cleanedCode = pscCode.replace(/\/\*[\s\S]*?\*\//g, '').replace(/Lexique\s*:?[\s\S]*/i, '');
    let luaCode = '';
    const lines = cleanedCode.split('\n');
    let isInsideAlgorithmBlock = false;
    const functionStack: any[] = [];

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

        if (/^\s*algorithme\b/i.test(trimmedLine)) { isInsideAlgorithmBlock = true; continue; }
        if (isInsideAlgorithmBlock) {
            if (/^\s*Fin\b/i.test(trimmedLine)) isInsideAlgorithmBlock = false;
            continue;
        }
        if (trimmedLine === '' || /^\s*Début\b/i.test(trimmedLine) || /^\s*Lexique\b/i.test(trimmedLine)) continue;

        // Ignorer les déclarations de types composites et tableaux
        if (/^[\p{L}_][\p{L}0-9_]*\s*=\s*<.*>$/iu.test(trimmedLine)) continue;
        if (/^[\p{L}_][\p{L}0-9_]*\s*=\s*tableau/iu.test(trimmedLine)) continue;

        if (/^\s*(Fin|fsi|fpour|ftq|ftant)\b/i.test(trimmedLine)) {
            const isFunctionEnd = functionStack.length > 0 && /^\s*Fin\b/i.test(trimmedLine);
            if (isFunctionEnd) {
                const funcInfo = functionStack.pop();
                if (funcInfo && funcInfo.inOutParamNames.length > 0) {
                    const indentation = originalLineForIndentation.match(/^\s*/)?.[0] || '';
                    luaCode += `${indentation}\treturn ${funcInfo.inOutParamNames.join(', ')}\n`;
                }
            }
            trimmedLine = 'end';
            lineIsFullyProcessed = true;
        }
        if (!lineIsFullyProcessed && /^\s*[\p{L}0-9_]+\s*←\s*lire\s*\(\s*\)\s*$/iu.test(trimmedLine)) {
            const varName = trimmedLine.split('←')[0].trim();
            const varType = normalizeType((variableTypes.get(varName) || '').toLowerCase());
            if (varType === 'entier' || varType === 'réel') {
                trimmedLine = `${varName} = tonumber(io.read())`;
            } else {
                trimmedLine = `${varName} = io.read()`;
            }
            lineIsFullyProcessed = true;
        }

        if (!lineIsFullyProcessed) {
            let isForLoop = false;
            trimmedLine = trimmedLine.replace(/[“”]/g, '"');

            if (/^\s*fonction\s/i.test(trimmedLine)) {
                const funcNameMatch = /^\s*Fonction\s+([\p{L}_][\p{L}0-9_]*)/iu.exec(trimmedLine);
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
                if (/^\s*Pour\s/i.test(trimmedLine)) {
                    isForLoop = true;
                    let step = /\bdécroissant\b/i.test(trimmedLine) ? ', -1' : ', 1';
                    trimmedLine = trimmedLine.replace(/\bdécroissant\b/i, '').replace(/^\s*Pour\s+([\p{L}0-9_]+)\s+(?:allant de|de)\s+(.+)\s+(?:a|à)\s+(.+)\s+Faire\s*:?/iu, `for $1 = $2, $3${step} do`);
                } else if (/^\s*Tant que\b/i.test(trimmedLine)) {
                    trimmedLine = trimmedLine.replace(/^\s*Tant que\b/i, 'while').replace(/\s+Faire\s*:?/i, ' do');
                } else if (/^\s*Si\b/i.test(trimmedLine)) {
                    trimmedLine = trimmedLine.replace(/^\s*Si\b/i, 'if').replace(/\s+(Alors|Faire)\s*:?/i, ' then');
                } else if (/^\s*Sinon\s+si\b/i.test(trimmedLine)) {
                    trimmedLine = trimmedLine.replace(/^\s*Sinon\s+si\b/i, 'elseif').replace(/\s+(Alors|Faire)\s*:?/i, ' then');
                } else if (/^\s*Sinon\b/i.test(trimmedLine)) {
                    trimmedLine = trimmedLine.replace(/^\s*Sinon\b\s*:?/i, 'else');
                }
            }

            // Transformer les constructeurs et littéraux de types composites
            trimmedLine = compositeTypeRegistry.transform(trimmedLine);

            const currentFunc = functionStack.length > 0 ? functionStack[functionStack.length - 1] : undefined;
            if (currentFunc && currentFunc.inOutParamNames.length > 0) {
                trimmedLine = trimmedLine
                    .replace(/\bretourne(?:r)?\s*\((.*)\)/gi, `return $1, ${currentFunc.inOutParamNames.join(', ')}`)
                    .replace(/\bretourne(?:r)?\b/gi, `return ${currentFunc.inOutParamNames.join(', ')}`);
            } else {
                trimmedLine = trimmedLine.replace(/\bretourne(?:r)?\s*\((.*)\)/gi, 'return $1').replace(/\bretourne(?:r)?\b/gi, 'return');
            }

            trimmedLine = trimmedLine
                .replace(/longueur\s*\(([^)]+)\)/gi, '#$1')
                .replace(/concat\s*\(([^,]+)\s*,\s*([^)]+)\)/gi, '$1 .. $2')
                .replace(/sousChaîne\s*\(([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\)/gi, 'string.sub($1, 2, ($2) + ($3) - 1)')
                .replace(/ième\s*\(([^,]+)\s*,\s*([^)]+)\)/gi, 'string.sub($1, $2, $2)')
                .replace(/\bvrai\b/gi, 'true').replace(/\bfaux\b/gi, 'false')
                .replace(/\bnon\b/gi, 'not').replace(/\bou\b/gi, 'or').replace(/\bet\b/gi, 'and')
                .replace(/\bmod\b/gi, '%').replace(/≠/g, '~=').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/÷/g, '//')
                .replace(/\bfichierOuvrir\b/gi, '__psc_fichierOuvrir')
                .replace(/\bfichierFermer\b/gi, '__psc_fichierFermer')
                .replace(/\bfichierLire\b/gi, '__psc_fichierLire')
                .replace(/\bfichierFin\b/gi, '__psc_fichierFin')
                .replace(/\bchaineVersEntier\b/gi, '__psc_chaineVersEntier')
                .replace(/\bfichierCreer\b/gi, '__psc_fichierCreer')
                .replace(/\bfichierEcrire\b/gi, '__psc_fichierEcrire')
                .replace(/\bFIN_LIGNE\b/g, "'\n'");

            if (!isForLoop && !lineIsFullyProcessed) {
                const parts = trimmedLine.split(/(__PSC_TABLE_START__|__PSC_TABLE_END__)/g);
                for (let i = 0; i < parts.length; i += 4) {
                    parts[i] = parts[i].replace(/(?<![<>~=])=(?!=)/g, '==');
                }
                trimmedLine = parts.join('');
            }

            trimmedLine = trimmedLine
                .replace(/\s*←\s*/g, ' = ')
                .replace(/lire\s*\(\)/gi, 'io.read()');

            // Nettoyer les marqueurs de table
            trimmedLine = trimmedLine.replace(/__PSC_TABLE_START__/g, '').replace(/__PSC_TABLE_END__/g, '');

            trimmedLine = trimmedLine.replace(/(?<![\p{L}0-9_])\[([^\]]*)\]/gu, '{$1}');
            trimmedLine = trimmedLine.replace(/([\p{L}0-9_]+)\[([^\]]+)\]/gu, (match, varName, indicesString) => {
                const indices = indicesString.split(',');
                const transformedIndices = indices.map((index: string) => `(${(index || '').trim()}) + 1`);
                return `${varName}[${transformedIndices.join('][')}]`;
            });
        }

        if (trimmedLine.match(/^écrire\(/i)) {
            const openParenIndex = trimmedLine.indexOf('(');
            trimmedLine = '__psc_write' + trimmedLine.substring(openParenIndex);
        }

        const indentation = originalLineForIndentation.match(/^\s*/)?.[0] || '';
        const finalComment = commentPart ? ' ' + commentPart.trim() : '';
        luaCode += indentation + trimmedLine + finalComment + '\n';
    }

    const helpers = `local __psc_file_handles = {}
local __psc_file_current_handle = 1

local function __psc_fichierCreer(nomFichier)
    return __psc_fichierOuvrir(nomFichier, "w")
end

local function __psc_fichierEcrire(handle, value)
    if __psc_file_handles[handle] then
        __psc_file_handles[handle]:write(tostring(value))
    end
end

local function __psc_fichierOuvrir(nomFichier, mode)
    mode = mode or "r"
    local file, err = io.open(nomFichier, mode)
    if not file then
        print("Erreur d'ouverture du fichier: " .. tostring(err))
        return nil
    end
    local handle = __psc_file_current_handle
    __psc_file_handles[handle] = file
    __psc_file_current_handle = __psc_file_current_handle + 1
    return handle
end

local function __psc_fichierFermer(handle)
    if __psc_file_handles[handle] then
        __psc_file_handles[handle]:close()
        __psc_file_handles[handle] = nil
    end
end

local function __psc_fichierLire(handle)
    if __psc_file_handles[handle] then
        return __psc_file_handles[handle]:read()
    end
    return nil
end

local function __psc_fichierFin(handle)
    if __psc_file_handles[handle] then
        local pos = __psc_file_handles[handle]:seek()
        local _, err = __psc_file_handles[handle]:read(0)
        __psc_file_handles[handle]:seek("set", pos)
        return err == "end of file"
    end
    return true
end

local function __psc_chaineVersEntier(chaine)
    return tonumber(chaine) or 0
end

local function __psc_is_array(t)
    if type(t) ~= 'table' then return false end
    local i = 0
    for _ in pairs(t) do
        i = i + 1
    end
    local count = 0
    for k in pairs(t) do
        if type(k) == 'number' then count = count + 1 end
    end
    return count == i
end

local function __psc_serialize(v)
    if type(v) == 'table' then
        if __psc_is_array(v) then
            local parts = {}
            for i = 1, #v do
                parts[#parts+1] = __psc_serialize(v[i])
            end
            return '[' .. table.concat(parts, ', ') .. ']'
        else
            local parts = {}
            for k, val in pairs(v) do
                parts[#parts+1] = tostring(k) .. ':' .. __psc_serialize(val)
            end
            return '{' .. table.concat(parts, ', ') .. '}'
        end
    elseif type(v) == 'string' then
        return v
    elseif type(v) == 'boolean' then
        return v and 'Vrai' or 'Faux'
    else
        return tostring(v)
    end
end

local function __psc_write(...)
    local args = {...}
    local parts = {}
    for i = 1, #args do
        parts[i] = __psc_serialize(args[i])
    end
    print(table.concat(parts, ''))
end
`;

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