/**
 * Gestion des informations sur les fonctions déclarées (pour gérer les paramètres InOut)
 */

import { PATTERNS } from './constants';
import { extractFunctionParams, isSimpleIdentifier } from './utils';

export interface ParamInfo {
    name: string;
    isInOut: boolean;
}

export interface FunctionInfo {
    name: string;
    params: ParamInfo[];
    inOutParamNames: string[];
}

/**
 * Registre global des fonctions
 */
export class FunctionRegistry {
    private functions = new Map<string, FunctionInfo>();

    /**
     * Collecte toutes les fonctions du code source
     */
    collect(pscCode: string): void {
        this.functions.clear();
        const lines = pscCode.split('\n');

        for (const line of lines) {
            const match = PATTERNS.FUNCTION_DECLARATION.exec(line);
            if (match) {
                const name = match[1];
                const paramsString = match[2];
                const params = extractFunctionParams(paramsString);
                const inOutParamNames = params
                    .filter(p => p.isInOut)
                    .map(p => p.name);

                this.functions.set(name, {
                    name,
                    params,
                    inOutParamNames
                });
            }
        }
    }

    /**
     * Récupère les informations d'une fonction
     */
    get(functionName: string): FunctionInfo | undefined {
        return this.functions.get(functionName);
    }

    /**
     * Vérifie si une fonction existe
     */
    has(functionName: string): boolean {
        return this.functions.has(functionName);
    }

    /**
     * Récupère les arguments InOut à réassigner lors d'un appel de fonction
     */
    getInOutArgsToReassign(functionName: string, callArgs: string[]): string[] {
        const funcInfo = this.get(functionName);
        if (!funcInfo) return [];

        const argsToReassign: string[] = [];
        funcInfo.params.forEach((param, index) => {
            if (param.isInOut && callArgs[index]) {
                const arg = callArgs[index].trim();
                // S'assurer que c'est un identifiant simple
                if (isSimpleIdentifier(arg)) {
                    argsToReassign.push(arg);
                }
            }
        });

        return argsToReassign;
    }

    /**
     * Retourne tous les noms de fonctions
     */
    getAllFunctionNames(): Set<string> {
        return new Set(this.functions.keys());
    }
}
