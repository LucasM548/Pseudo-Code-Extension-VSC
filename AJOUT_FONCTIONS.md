# Guide d'ajout de nouvelles fonctions

## 📝 Source unique de vérité : `src/definitions.ts`

Toutes les fonctions, types et mots-clés sont définis dans **`src/definitions.ts`**.  
C'est le **seul fichier** que vous devez modifier pour ajouter de nouvelles fonctionnalités.

---

## ✅ Processus d'ajout d'une nouvelle fonction

### 1️⃣ Ajouter la fonction dans `definitions.ts`

Ouvrez `src/definitions.ts` et ajoutez votre fonction dans l'array `functions` :

```typescript
functions: [
    // ... fonctions existantes ...
    
    // Votre nouvelle fonction
    { 
        name: 'maNouvelleFonction',      // Nom en minuscules
        arity: 2,                         // Nombre de paramètres
        luaHelper: '__psc_ma_fonction',  // Nom de la fonction Lua helper
        isMutator: false,                 // true si modifie le 1er argument
        description: 'Ma super fonction' // (Optionnel) Description
    }
]
```

**Paramètres** :
- `name` : Nom de la fonction en **minuscules** (insensible à la casse dans PSC)
- `arity` : Nombre de paramètres attendus
- `luaHelper` : Nom de la fonction helper Lua correspondante
- `isMutator` : `true` si la fonction modifie le premier argument (ex: `ajoutTable`)
- `description` : Description optionnelle

### 2️⃣ Implémenter le helper Lua dans `constants.ts`

Allez à la fin de `src/constants.ts` et ajoutez votre fonction Lua :

```typescript
export const LUA_HELPERS = `
-- ... helpers existants ...

-- Ma nouvelle fonction
local function __psc_ma_fonction(param1, param2)
    -- Implémentation
    return resultat
end

-- =================================================
`;
```

### 3️⃣ C'est tout ! ✨

**Automatiquement** :
- ✅ Le **linter** reconnaîtra votre fonction
- ✅ La **grammaire** l'inclura dans la coloration syntaxique
- ✅ L'**executor** la transpirera correctement en Lua
- ✅ La **vérification d'arité** fonctionnera

---

## 🎯 Exemples concrets

### Exemple 1 : Fonction simple

**Dans `definitions.ts`** :
```typescript
{ name: 'carre', arity: 1, luaHelper: '__psc_carre' }
```

**Dans `constants.ts`** :
```lua
local function __psc_carre(x)
    return x * x
end
```

**Utilisation PSC** :
```pseudocode
resultat ← carre(5)  // 25
```

### Exemple 2 : Fonction mutateur

**Dans `definitions.ts`** :
```typescript
{ 
    name: 'ajoutertable', 
    arity: 3, 
    luaHelper: '__psc_table_ajout',
    isMutator: true  // ← Important !
}
```

**Résultat** : L'appel `ajoutTable(t, k, v)` sera automatiquement transformé en `t = __psc_table_ajout(t, k, v)`

---

## 📦 Ajout d'un nouveau type

### Dans `definitions.ts` :

```typescript
types: [
    // ... types existants ...
    { name: 'montype', aliases: ['montype', 'mon_type'] }
]
```

C'est tout ! Le type sera automatiquement reconnu partout.

---

## 🔄 Workflow complet

1. **Modifier** `src/definitions.ts`
2. **Ajouter** le helper Lua dans `src/constants.ts`
3. **Compiler** : `npm run compile`
4. **Recharger** VS Code
5. **Tester** votre nouvelle fonction !

---

## 💡 Conseils

- **Noms en minuscules** : PSC est insensible à la casse, utilisez toujours des minuscules
- **Helpers Lua** : Préfixez toujours avec `__psc_` pour éviter les conflits
- **Mutators** : Utilisez `isMutator: true` pour les fonctions qui modifient leurs arguments
- **Tests** : Créez un fichier `.psc` pour tester vos nouvelles fonctions

---

## 📚 Architecture

```
definitions.ts (SOURCE DE VÉRITÉ)
    ↓
    ├─→ constants.ts (génère automatiquement KNOWN_IDENTIFIERS)
    ├─→ generate-grammar.ts (génère psc.tmLanguage.json)
    ├─→ executor.ts (transpilation vers Lua)
    └─→ diagnostics.ts (linter, via constants.ts)
```

**Tout part de `definitions.ts` !** 🎯
