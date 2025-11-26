// Test des fonctionnalités Table avec syntaxe flèche et itération

Fonction annuaireInverse(annuaire : Table) : Table
Début
	ntab ← tableVide()
	Pour cle de annuaire Faire :
		ajoutTable(ntab, accesTable(annuaire, cle), cle)
	fpour
	retourner ntab
Fin

// Test de la syntaxe Table avec flèches
écrire(annuaireInverse(Table("Alice" → "1234", "Bob" → "5678", "Charlie" → "1234")))
