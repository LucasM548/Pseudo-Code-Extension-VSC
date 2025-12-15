"use strict";
/**
 * Gestion des types composites (structures personnalisées)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompositeTypeRegistry = void 0;
var constants_1 = require("./constants");
var utils_1 = require("./utils");
/**
 * Registre global des types composites
 */
var CompositeTypeRegistry = /** @class */ (function () {
    function CompositeTypeRegistry() {
        this.types = new Map();
    }
    /**
     * Collecte tous les types composites du code source
     */
    CompositeTypeRegistry.prototype.collect = function (pscCode) {
        this.types.clear();
        var lines = pscCode.split('\n');
        for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
            var line = lines_1[_i];
            var trimmedLine = line.trim();
            var match = constants_1.PATTERNS.COMPOSITE_TYPE.exec(trimmedLine);
            if (match) {
                var typeName = match[1];
                var fieldsStr = match[2];
                var fields = [];
                var fieldParts = fieldsStr.split(',');
                for (var _a = 0, fieldParts_1 = fieldParts; _a < fieldParts_1.length; _a++) {
                    var fieldPart = fieldParts_1[_a];
                    var fieldMatch = constants_1.PATTERNS.COMPOSITE_FIELD.exec(fieldPart.trim());
                    if (fieldMatch) {
                        fields.push({
                            name: fieldMatch[1],
                            type: fieldMatch[2].trim()
                        });
                    }
                }
                // Stocker avec clé en minuscules pour recherche insensible à la casse
                this.types.set(typeName.toLowerCase(), { name: typeName, fields: fields });
            }
        }
    };
    /**
     * Récupère un type composite par son nom
     */
    CompositeTypeRegistry.prototype.get = function (typeName) {
        return this.types.get(typeName.toLowerCase());
    };
    /**
     * Vérifie si un type existe
     */
    CompositeTypeRegistry.prototype.has = function (typeName) {
        return this.types.has(typeName.toLowerCase());
    };
    /**
     * Trouve un type composite correspondant au nombre de champs
     */
    CompositeTypeRegistry.prototype.findByFieldCount = function (fieldCount) {
        for (var _i = 0, _a = this.types.values(); _i < _a.length; _i++) {
            var type = _a[_i];
            if (type.fields.length === fieldCount) {
                return type;
            }
        }
        return undefined;
    };
    /**
     * Transforme les constructeurs de types composites en tables Lua
     * TypeName(val1, val2) -> {field1 = val1, field2 = val2}
     */
    CompositeTypeRegistry.prototype.transformConstructors = function (expression) {
        var result = expression;
        var changed = true;
        // Répéter pour gérer les constructeurs imbriqués
        while (changed) {
            changed = false;
            for (var _i = 0, _a = this.types.values(); _i < _a.length; _i++) {
                var compositeType = _a[_i];
                var typeName = compositeType.name;
                var regex = new RegExp("\\b".concat(typeName, "\\s*\\("), 'gi');
                var match = void 0;
                var _loop_1 = function () {
                    var startPos = match.index;
                    var openParenPos = match.index + match[0].length - 1;
                    var closeParenPos = (0, utils_1.findMatchingParen)(result, openParenPos);
                    if (closeParenPos !== -1) {
                        var argsStr = result.substring(openParenPos + 1, closeParenPos);
                        var args_1 = (0, utils_1.smartSplitArgs)(argsStr);
                        var fieldAssignments = compositeType.fields.map(function (field, index) {
                            var value = args_1[index] || 'nil';
                            return "".concat(field.name, " = ").concat(value);
                        });
                        var replacement = "__PSC_TABLE_START__{".concat(fieldAssignments.join(', '), "}__PSC_TABLE_END__");
                        result = result.substring(0, startPos) + replacement + result.substring(closeParenPos + 1);
                        changed = true;
                        return "break";
                    }
                };
                while ((match = regex.exec(result)) !== null) {
                    var state_1 = _loop_1();
                    if (state_1 === "break")
                        break;
                }
                if (changed)
                    break;
            }
        }
        return result;
    };
    /**
     * Transforme les littéraux <val1, val2> en tables Lua
     */
    CompositeTypeRegistry.prototype.transformLiterals = function (expression) {
        var _this = this;
        return expression.replace(constants_1.PATTERNS.COMPOSITE_LITERAL, function (match, content) {
            var trimmedContent = content.trim();
            // Vérifier si c'est un littéral de structure
            if (trimmedContent.includes(',') ||
                trimmedContent.match(/^["'{]/) ||
                trimmedContent.match(/^\w+\s*\(/)) {
                var args_2 = (0, utils_1.smartSplitArgs)(content);
                var matchingType = _this.findByFieldCount(args_2.length);
                if (matchingType) {
                    // Table avec champs nommés
                    var fieldAssignments = matchingType.fields.map(function (field, index) {
                        var value = args_2[index] || 'nil';
                        return "".concat(field.name, " = ").concat(value);
                    });
                    return "__PSC_TABLE_START__{".concat(fieldAssignments.join(', '), "}__PSC_TABLE_END__");
                }
                // Table avec indices numériques
                return "__PSC_TABLE_START__{".concat(content, "}__PSC_TABLE_END__");
            }
            return match; // Pas un littéral
        });
    };
    /**
     * Transforme une expression complète (constructeurs + littéraux)
     */
    CompositeTypeRegistry.prototype.transform = function (expression) {
        var result = this.transformConstructors(expression);
        result = this.transformLiterals(result);
        return result;
    };
    /**
     * Nettoie les marqueurs temporaires
     */
    CompositeTypeRegistry.cleanMarkers = function (code) {
        return code
            .replace(/__PSC_TABLE_START__/g, '')
            .replace(/__PSC_TABLE_END__/g, '');
    };
    /**
     * Retourne tous les noms de types (en minuscules)
     */
    CompositeTypeRegistry.prototype.getAllTypeNames = function () {
        return new Set(this.types.keys());
    };
    return CompositeTypeRegistry;
}());
exports.CompositeTypeRegistry = CompositeTypeRegistry;
