// executor.ts

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';

interface ParamInfo {
    name: string;
    isInOut: boolean;
}

interface FunctionInfo {
    name: string;
    params: ParamInfo[];
    inOutParamNames: string[];
    getInOutArgsToReassign: (callArgs: string[]) => string[];
}

const functionRegistry = new Map<string, FunctionInfo>();

/**
 * Analyse l'ensemble du code pour cataloguer toutes les fonctions, leurs paramètres,
 * et identifier ceux qui sont marqués comme InOut.
 * @param pscCode Le code source complet en Pseudo-Code.
 */
function collectFunctionInfo(pscCode: string): void {
    functionRegistry.clear();
    const lines = pscCode.split('\n');
    const funcRegex = /^\s*Fonction\s+([\p{L}_][\p{L}0-9_]*)\s*\((.*)\)/iu;

    for (const line of lines) {
        const funcMatch = funcRegex.exec(line);
        if (funcMatch) {
            const name = funcMatch[1];
            let paramsString = funcMatch[2];

            const returnColon = paramsString.lastIndexOf(':');
            const lastParen = paramsString.lastIndexOf(')');
            if (returnColon > lastParen) {
                paramsString = paramsString.substring(0, returnColon).trim();
            }
            if (paramsString.endsWith(')')) {
                paramsString = paramsString.slice(0, -1);
            }

            const params: ParamInfo[] = [];
            const inOutParamNames: string[] = [];

            if (paramsString.trim() !== '') {
                paramsString.split(/,(?![^(\[]*[)\]])/g).forEach(p => {
                    const paramDef = p.split(':')[0].trim();
                    const isInOut = /\bInOut\b/i.test(paramDef);
                    const paramName = paramDef.replace(/\bInOut\b/i, '').trim();
                    if (paramName) {
                        params.push({ name: paramName, isInOut });
                        if (isInOut) {
                            inOutParamNames.push(paramName);
                        }
                    }
                });
            }

            functionRegistry.set(name, {
                name,
                params,
                inOutParamNames,
                getInOutArgsToReassign: (callArgs: string[]) => {
                    const argsToReassign: string[] = [];
                    params.forEach((param, index) => {
                        if (param.isInOut && callArgs[index]) {
                            // On s'assure que l'argument est bien un nom de variable simple
                            const arg = callArgs[index].trim();
                            if (/^[\p{L}_][\p{L}0-9_]*$/u.test(arg)) {
                                argsToReassign.push(arg);
                            }
                        }
                    });
                    return argsToReassign;
                }
            });
        }
    }
}


/**
 * Analyse le code pseudo-code pour extraire les types de toutes les variables déclarées.
 * @param pscCode Le code source en Pseudo-Code.
 * @returns Un objet associant les noms de variables à leur type.
 */
function collectVariableTypes(pscCode: string): { [key: string]: string } {
    const variableTypes: { [key: string]: string } = {};
    const lines = pscCode.split('\n');

    for (const line of lines) {
        const trimmedLine = line.trim();
        const declarationMatch = trimmedLine.match(/^([\p{L}0-9_,\s]+?)\s*:\s*(entier|réel|booléen|booleen|chaîne|chaine|caractère|caractere|tableau)/iu);
        if (declarationMatch && !/^\s*Fonction/i.test(trimmedLine)) {
            const rawType = declarationMatch[2].toLowerCase();
            const type = normalizeType(rawType);
            const varNames = declarationMatch[1].split(',').map(v => v.trim());
            varNames.forEach(v => {
                if (v) variableTypes[v] = type;
            });
        }
        const funcMatch = trimmedLine.match(/^\s*Fonction\s+[\p{L}0-9_]+\s*\((.*)\)/iu);
        if (funcMatch) {
            let paramsString = funcMatch[1];
            const lastParen = paramsString.lastIndexOf(')');
            const returnColon = paramsString.lastIndexOf(':');

            if (returnColon > lastParen) {
                paramsString = paramsString.substring(0, returnColon).trim();
                if (paramsString.endsWith(')')) {
                    paramsString = paramsString.slice(0, -1);
                }
            }

            const params = paramsString.split(/,(?![^(\[]*[)\]])/g);
            params.forEach(p => {
                const parts = p.split(':').map(part => part.trim());
                if (parts.length === 2) {
                    const varName = parts[0].replace(/\bInOut\b/i, '').trim();
                    const rawTypeName = parts[1].toLowerCase().replace(/\b(tableau|entier|réel|booléen|booleen|chaîne|chaine|caractère|caractere).*/, '$1');
                    const typeName = normalizeType(rawTypeName);
                    if (varName) variableTypes[varName] = typeName;
                }
            });
        }
    }
    return variableTypes;
}

/**
 * Normalise un nom de type (variantes sans accent, différentes orthographes) en forme canonique.
 */
function normalizeType(raw: string): string {
    const t = (raw || '').toLowerCase();
    if (/^booléen$/.test(t)) return 'booléen';
    if (/^re[ée]l$/.test(t)) return 'réel';
    if (/^entier$/.test(t)) return 'entier';
    if (/^cha(iî)ne$/.test(t)) return 'chaîne';
    if (/^caract[eè]re$/.test(t)) return 'caractère';
    if (/^tableau$/.test(t)) return 'tableau';
    return t;
}

/**
 * Transpile le code Pseudo-Code en code Lua exécutable.
 * @param pscCode Le code source en Pseudo-Code.
 * @returns Le code Lua transpilé.
 */
function transpileToLua(pscCode: string): string {
    collectFunctionInfo(pscCode);
    const variableTypes = collectVariableTypes(pscCode);

    let cleanedCode = pscCode.replace(/\/\*[\s\S]*?\*\//g, '').replace(/Lexique\s*:?[\s\S]*/i, '');
    let luaCode = '';
    const lines = cleanedCode.split('\n');
    let isInsideAlgorithmBlock = false;
    const functionStack: FunctionInfo[] = [];

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
            const varType = normalizeType((variableTypes[varName] || '').toLowerCase());
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
                            const varsToReassign = funcInfo.getInOutArgsToReassign(args);

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
                    let step = /\bdécroissant\b/i.test(trimmedLine) ? ', -1' : '';
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
                .replace(/\bmod\b/gi, '%').replace(/≠/g, '~=').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/÷/g, '//');

            if (!isForLoop && !lineIsFullyProcessed) {
                trimmedLine = trimmedLine.replace(/(?<![<>~=])=(?!=)/g, '==');
            }

            trimmedLine = trimmedLine
                .replace(/\s*←\s*/g, ' = ')
                .replace(/lire\s*\(\)/gi, 'io.read()');

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

    const helpers = `local function __psc_is_array(t)
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