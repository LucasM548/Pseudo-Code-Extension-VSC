// Test de la fonction de lecture auto-convertie

Fonction creationTable(nc : entier, nv : entier) : Table
Début
	tabVote ← tableVide()
	Pour i de 1 à nc Faire :
		ajoutTable(tabVote, i, 0)
	fpour
	Pour i de 1 à nv Faire :
		écrire("Entrez un vote (1 à ", nc, "): ")
		nvVote ← lire()
		Si 0 < nvVote et nvVote ≤ nc Alors :
			changeTable(tabVote, nvVote, accesTable(tabVote, nvVote) + 1)
		fsi
	fpour
	retourner tabVote
Fin

// Test : créer une table de votes pour 3 candidats avec 2 votes
tab ← creationTable(3, 2)
écrire("Résultats des votes : ", tab)
