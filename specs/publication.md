# Botz — publication

Aide-mémoire pour publier le site et les apps. Les valeurs entre `<…>` sont à compléter.

## 1. Site (repo public `botz-site`)

Le site (accueil, `privacy.html`, logo, icônes, `CNAME`) vit uniquement dans le repo public `botz-site` ; il n'est plus dans ce repo. On le modifie directement là-bas.

| Élément | Valeur |
| --- | --- |
| Repo public (site) | `botz-site` |
| Source Pages | branche `main`, dossier `/` (racine) |
| Domaine | `botz.pomponlabs.com` (fichier `CNAME`) |
| DNS | `CNAME  botz  →  drajunok.github.io` |
| Accueil | https://botz.pomponlabs.com/ |
| Politique de confidentialité | https://botz.pomponlabs.com/privacy.html |

## 2. Identité de l'app

- Nom : **Botz**
- Identifiant : `com.botz.game` (Android `applicationId`, iOS bundle id)
- Éditeur : Pompon Labs
- Contact / support : `contact@pomponlabs.com`
- URL support : https://botz.pomponlabs.com/
- URL confidentialité : https://botz.pomponlabs.com/privacy.html
- Icône : `resources/icon.png` (1024×1024) ; site : dans `botz-site`

## 3. Fiche store

**Sous-titre / description courte (≤ 80 car.)**
> Vise, lance, carambole : le sport robotique à physique.

**Description longue**
> Botz est un jeu de sport en équipe où la physique fait tout. Vise, lance tes robots et regarde les pièces voler — sans oublier le réveil qui s'enfuit au pire moment.
>
> • Tournoi en 3 jeux : foot, survivant, pétanque
> • Solo contre l'IA ou à deux sur le même téléphone
> • Pièces qui s'envolent et trajectoires déformées
> • Sans compte, sans publicité, sans collecte de données

**Mots-clés (iOS, ≤ 100 car.)** : `physique,robots,sport,foot,pétanque,multijoueur,arcade,casual`

**Catégorie** : Jeux > Sport (ou Arcade) · **Classification** : tout public (pas de violence réaliste, pas d'achats, pas de pub).

## 4. Déclarations de confidentialité

- Données collectées : **aucune**
- Suivi / publicité : **non**
- Achats intégrés : **non**
- Accès compte : **non**
- Chiffrement : aucune cryptographie propriétaire (pas de déclaration d'export spéciale)
- Stockage local : réglages (son, difficulté)
- À revisiter si le mode en ligne est ajouté (serveur Colyseus) : données réseau, identifiants de partie, mise à jour de `privacy.html`.

## 5. Visuels à fournir

- Captures d'écran téléphone (portrait/paysage selon l'orientation retenue) : accueil, partie de foot, survivant, pétanque, classement. Voir `specs/` pour les maquettes de référence.
- iOS : 6,7" et 6,5" obligatoires ; iPad si l'app le supporte.
- Android : 2 à 8 captures, graphique de présentation 1024×500 (à créer à partir du logo de `botz-site`).

## 6. Builds

```bash
npm run cap:android   # Android Studio > Build > Generate Signed App Bundle (AAB)
npm run cap:ios       # Xcode > Product > Archive > Distribute App
```

Avant chaque soumission : incrémenter `versionCode`/`versionName` (`android/app/build.gradle`) et la version/build iOS (Xcode), puis `npm test && npm run build`.

## 7. Checklist

- [x] Repo public `botz-site` créé et publié
- [ ] DNS + HTTPS actifs sur `botz.pomponlabs.com`
- [ ] `privacy.html` accessible publiquement
- [ ] Adresse `contact@pomponlabs.com` fonctionnelle
- [ ] Compte Google Play Console / Apple Developer
- [ ] Build Android signé (AAB) testé sur un vrai appareil
- [ ] Build iOS archivé testé via TestFlight
- [ ] Captures et textes de la fiche saisis
- [ ] Questionnaires de confidentialité / classification remplis
