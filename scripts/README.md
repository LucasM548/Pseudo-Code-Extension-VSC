# Générateur de Grammaire TextMate

## Vue d'ensemble

Ce script génère automatiquement le fichier `syntaxes/psc.tmLanguage.json` à partir des définitions centralisées dans `src/definitions.ts`. Cela élimine la redondance et garantit que la coloration syntaxique est toujours synchronisée avec les définitions du langage.

## Fonctionnement

Le script `scripts/generate-grammar.ts` :

1. **Charge les définitions** depuis `src/definitions.ts`
2. **Extrait** les mots-clés, fonctions, types et opérateurs par catégorie
3. **Met à jour** le fichier `syntaxes/psc.tmLanguage.json` avec les patterns générés
4. **Préserve** la structure existante de la grammaire TextMate

## Utilisation

### Génération manuelle

```bash
npm run generate-grammar
```

### Génération automatique

Le script est automatiquement exécuté **avant chaque compilation** grâce au hook `precompile` dans `package.json` :

```bash
npm run compile  # Génère la grammaire puis compile
```

## Éléments synchronisés

- ✅ **Mots-clés de contrôle** : `si`, `alors`, `pour`, `retourner`, etc.
- ✅ **Mots-clés de bloc** : `Début`, `Fin`, `Algorithme`, `Fonction`
- ✅ **Opérateurs logiques** : `et`, `ou`, `non`, `mod`
- ✅ **Fonctions I/O** : `écrire`, `lire`
- ✅ **Fonctions intégrées** : `listevide`, `pilevide`, `filevide`, etc.
- ✅ **Types de base** : `entier`, `réel`, `chaîne`, `tableau`, etc.
- ✅ **Modificateurs** : `InOut`, `Lexique`

## Traitement spécial

### Pile et File comme types

Les mots `pile` et `file` sont colorés en bleu (type) **uniquement** dans un contexte de déclaration :

```psc
ma_variable : Pile      // ✓ "Pile" en bleu
```

Dans les autres contextes, ils sont traités comme des variables normales :

```psc
pile ← pileVide()       // ✓ "pile" comme variable
```

### Fonctions insensibles à la casse

Le linter accepte les fonctions avec n'importe quelle casse :
- `listeVide()`, `listevide()`, `ListeVide()` → Toutes valides

## Ajout de nouveaux éléments

Pour ajouter une nouvelle fonction ou mot-clé :

1. **Modifier uniquement** `src/definitions.ts`
2. Exécuter `npm run compile` (génère automatiquement la grammaire)
3. Recharger VS Code pour voir les changements

**Plus besoin de modifier manuellement `psc.tmLanguage.json` !**

## Architecture

```
src/
  ├── definitions.ts          ← SOURCE DE VÉRITÉ
  └── constants.ts            ← Construit depuis definitions.ts

scripts/
  └── generate-grammar.ts     ← Générateur automatique

syntaxes/
  └── psc.tmLanguage.json     ← GÉNÉRÉ (ne pas modifier manuellement)
```

## Avantages

- 🔄 **Synchronisation automatique** entre linter et coloration syntaxique
- 📝 **Source unique de vérité** : `definitions.ts`
- 🚫 **Élimine les redondances** et incohérences
- ⚡ **Compilation simplifiée** : un seul fichier à modifier
