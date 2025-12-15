"use strict";
/**
 * Gestion des informations sur les fonctions déclarées (pour gérer les paramètres InOut)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunctionRegistry = void 0;
var constants_1 = require("./constants");
var utils_1 = require("./utils");
/**
 * Registre global des fonctions
 */
var FunctionRegistry = /** @class */ (function () {
    function FunctionRegistry() {
        this.functions = new Map();
    }
    /**
     * Collecte toutes les fonctions du code source
     */
    FunctionRegistry.prototype.collect = function (pscCode) {
        this.functions.clear();
        var lines = pscCode.split('\n');
        for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
            var line = lines_1[_i];
            var match = constants_1.PATTERNS.FUNCTION_DECLARATION.exec(line);
            if (match) {
                var name_1 = match[1];
                var paramsString = match[2];
                var params = (0, utils_1.extractFunctionParams)(paramsString);
                var inOutParamNames = params
                    .filter(function (p) { return p.isInOut; })
                    .map(function (p) { return p.name; });
                this.functions.set(name_1, {
                    name: name_1,
                    params: params,
                    inOutParamNames: inOutParamNames
                });
            }
        }
    };
    /**
     * Récupère les informations d'une fonction
     */
    FunctionRegistry.prototype.get = function (functionName) {
        return this.functions.get(functionName);
    };
    /**
     * Vérifie si une fonction existe
     */
    FunctionRegistry.prototype.has = function (functionName) {
        return this.functions.has(functionName);
    };
    /**
     * Récupère les arguments InOut à réassigner lors d'un appel de fonction
     */
    FunctionRegistry.prototype.getInOutArgsToReassign = function (functionName, callArgs) {
        var funcInfo = this.get(functionName);
        if (!funcInfo)
            return [];
        var argsToReassign = [];
        funcInfo.params.forEach(function (param, index) {
            if (param.isInOut && callArgs[index]) {
                var arg = callArgs[index].trim();
                // S'assurer que c'est un identifiant simple
                if ((0, utils_1.isSimpleIdentifier)(arg)) {
                    argsToReassign.push(arg);
                }
            }
        });
        return argsToReassign;
    };
    /**
     * Retourne tous les noms de fonctions
     */
    FunctionRegistry.prototype.getAllFunctionNames = function () {
        return new Set(this.functions.keys());
    };
    return FunctionRegistry;
}());
exports.FunctionRegistry = FunctionRegistry;
