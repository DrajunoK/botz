# Botz — Spécification V2 (tournoi en 3 jeux + jeu en ligne)

## Contexte

**Botz** est un jeu mobile (Android + iOS) inspiré de Globulos (Globz) : des équipes de **petits robots ronds** (les « botz ») qu'on lance dans une arène, avec une physique de rebond et des **tours simultanés**.

Botz se distingue de Globulos par deux twists humoristiques :
1. **Les botz se démontent** : à chaque gros choc, ils perdent une pièce et deviennent de plus en plus incontrôlables.
2. **Le ballon est un réveil qui s'enfuit** : il sonne, fuit les botz tout seul, et panique de plus en plus au fil du match.

**État actuel** : la V1 est codée (mode Foot jouable, IA, 2 joueurs sur le même téléphone, flèche de visée). Cette V2 ajoute :
- un **tournoi en 3 jeux** (Foot, Survivant, Pétanque) avec un **écran de classement** entre chaque jeu ;
- un mode **en ligne sur 2 téléphones**, où les deux joueurs visent en même temps.

Important : ne réutilise aucun asset, nom ou graphisme de Globulos. Tout le visuel doit être original. Les maquettes de référence sont dans l'artifact « Botz — maquettes » (un export PNG/PDF peut être ajouté au repo dans `docs/mockups/`).

## Stack technique

- **TypeScript**, monorepo (npm workspaces ou pnpm)
- **Phaser 3** pour le rendu et les écrans
- **matter-js** pour la physique, utilisé **directement** (pas via le plugin Matter de Phaser) dans un package partagé, pour que la même simulation tourne sur le téléphone et sur le serveur
- **Capacitor** pour packager en application **Android** et **iOS**
- **Colyseus** (Node.js) pour le serveur de jeu en ligne, packagé en image **Docker**
- **Vitest** pour les tests unitaires (règles, IA, score, démontage, réveil, chutes, comptage pétanque, protocole réseau)

Contraintes connues : le build iOS nécessite un Mac avec Xcode (et un compte Apple Developer pour publier) ; le build Android nécessite Android Studio.

## Structure d'une partie : le tournoi

Quand on lance une partie (solo contre l'IA, 2 joueurs sur le même téléphone, ou en ligne), on joue par défaut un **tournoi de 3 jeux**, dans cet ordre :

| # | Jeu | Condition de victoire |
|---|---|---|
| 1 | **Foot** | premier à **2 buts** |
| 2 | **Survivant** | dernière équipe avec des botz sur la passerelle |
| 3 | **Pétanque** | premier à **3 points** |

- Chaque jeu gagné rapporte **1 point de tournoi** (affiché comme un trophée).
- **On joue toujours les 3 jeux**, même si un joueur mène 2–0 (c'est plus fun, et le 3e jeu sert l'honneur). Le vainqueur du tournoi est celui qui a le plus de trophées. Aucun jeu ne pouvant finir sur une égalité, il n'y a pas d'égalité de tournoi.
- Le menu propose aussi une **« Partie libre »** pour jouer un seul jeu au choix (utile pour s'entraîner et pour tester).

### Écran de classement (entre chaque jeu)
Affiché après chaque jeu (maquette « Classement entre les jeux ») :
- titre « Classement » et progression « après le jeu X sur 3 » ;
- les deux équipes avec le nom du joueur (ou « Ordi · Normal »), leurs trophées et leurs 3 botz ;
- les 3 cartes de jeux : terminé (avec le vainqueur et le score), suivant (mis en avant), à venir ;
- un message « **Atelier** : vos botz sont réparés » : les pièces perdues sont restaurées entre chaque jeu (option `repairBetweenGames`, par défaut `true`) ;
- boutons « Jeu suivant : <nom> » et « Quitter le tournoi ».

Après le 3e jeu, le même écran devient l'**écran final** : trophée, vainqueur du tournoi, petite animation (confettis, les botz du gagnant sautillent), boutons « Revanche » et « Menu ».

En ligne, les deux joueurs doivent appuyer sur « Jeu suivant » pour continuer ; on affiche « Adversaire prêt ✓ ».

## Mécaniques communes aux 3 jeux

### Déroulement d'un tour (simultané)
1. **Phase de visée** (timer de 15 s, visible à l'écran) : chaque joueur fait glisser son doigt depuis un de ses botz. Un **indicateur de visée** (voir plus bas) apparaît dans la direction du glissement ; la distance de glissement définit la puissance (plafonnée à une distance max, matérialisée par un cercle autour du botz sélectionné).
   - Chaque botz peut recevoir une visée ou non (un botz sans visée ne bouge pas).
   - Taper sur un botz supprime sa visée.
   - Bouton **GO** pour valider avant la fin du timer.
   - Les visées adverses ne sont jamais visibles pendant la phase de visée.
2. **Phase de résolution** : quand les deux camps ont validé (ou que le timer expire), on applique simultanément les impulsions (modifiées par les pièces manquantes), les objets autonomes (le réveil) démarrent, puis la physique joue.
3. La phase se termine quand tout est quasi immobile (vitesse sous un seuil) et que les comportements autonomes sont finis, ou après un délai max (ex. 7 s).
4. On vérifie les règles du jeu (but, chute, fin de mène…), puis on repasse en phase de visée.

Exception : en **Pétanque**, chaque camp ne lance qu'**un seul botz par tour** (voir plus bas).

### Indicateur de visée (flèche en chevrons collés)
La visée est une **flèche continue faite de chevrons pleins collés les uns aux autres**, sans trous. Ils sont petits et verts près du botz, puis de plus en plus gros et rouges vers la pointe. Voir l'artboard « Flèche de visée — retenue » de la maquette.

- **Position** : dessinée **sous** le botz (jamais sur son visage). Le premier chevron commence au bord du botz (rayon + 8 px).
- **Nombre** : 10 chevrons à la portée max. Nombre affiché = `max(1, round(power * 10))`, `power` entre 0 et 1. On ajoute ou retire les chevrons au fur et à mesure du glissement, donc la longueur suit la puissance.
- **Forme** du chevron `i` (0 à 9), en coordonnées locales orientées dans la direction du tir, `x` = distance depuis le centre du botz. Valeurs pour un botz de rayon 18, à multiplier par `botRadius / 18` :
  - `x = 26 + i * 10` (pas de 10)
  - demi-hauteur `h = 3.5 + i * 0.5` (3.5 → 8) : la flèche reste **fine**, même à pleine puissance elle ne dépasse pas la hauteur de la visière du botz, pour que 3 flèches ne chargent pas le terrain
  - épaisseur `t = 7.5 + i * 0.2` (7.5 → 9.3)
  - recul des branches `k = h`
  - polygone : `(x-k, -h)`, `(x-k+t, -h)`, `(x+t, 0)`, `(x-k+t, h)`, `(x-k, h)`, `(x, 0)`
  - contour `#1f2438` de 1,5 px, jointures arrondies : il sépare visuellement les chevrons tout en gardant l'ensemble continu.
- **Couleur** : un dégradé fixe le long de la portée (et non de la flèche courante), de `x = 24` à `x = 126` : `#7fd1ae` (0 %), `#c8e06a` (35 %), `#f6c234` (60 %), `#f28a3a` (80 %), `#e8473f` (100 %). Un tir doux reste court et vert, et seul un tir à fond atteint le rouge. Si le dégradé est compliqué à faire dans Phaser, on peut colorer chaque chevron d'une couleur pleine interpolée selon sa position `x`.
- Le dernier chevron (le 10e) touche le cercle de portée max (rayon ≈ 128 pour un botz de rayon 18).
- Pendant le glissement, le cercle de portée reste visible (pointillés blancs à 60 %).
- Petit retour haptique (Capacitor Haptics) chaque fois qu'un chevron s'ajoute, si disponible.
- À 100 %, effet bonus optionnel : la flèche pulse légèrement.
- Les flèches des botz déjà visés restent affichées pendant que le joueur vise les autres.

### Les botz se démontent (dans les 3 jeux)
Chaque botz commence avec **4 pièces** visibles, chacune ayant un effet quand elle est perdue :

| Pièce | Effet quand elle manque |
|---|---|
| Antenne | Visée imprécise : bruit aléatoire de ±10° sur la direction réelle du tir |
| Bras gauche | Dérive : la trajectoire se courbe progressivement vers la droite |
| Bras droit | Dérive : la trajectoire se courbe progressivement vers la gauche |
| Roue | Le botz tourne sur lui-même en avançant et ralentit de façon irrégulière |

- Chaque pièce perdue **réduit la masse** du botz (il part plus vite et se fait davantage bousculer : en Survivant, il tombe plus facilement !).
- Un botz sans aucune pièce devient une **épave** : toujours jouable, très léger, très imprécis, avec de la fumée.
- La flèche de visée montre l'intention du joueur ; c'est la trajectoire réelle qui est déformée.
- **Perte** : lors d'une collision botz–botz ou botz–bordure dont la vitesse relative dépasse un seuil (configurable), avec un cooldown de 300 ms par botz. Pièce choisie au hasard parmi celles qui restent. Étincelles, pièce qui s'envole, petit « clonk ».
- **Débris** : chaque pièce perdue devient un petit corps physique (obstacle), 12 max (les plus anciens disparaissent en fondu). En Survivant, les débris qui sortent de la passerelle tombent aussi dans la lave.
- Les pièces perdues restent perdues **jusqu'à la fin du jeu en cours** ; elles sont réparées à l'atelier entre deux jeux (`repairBetweenGames`).

### Aléatoire
Toute la part d'aléatoire (pièce perdue, imprécision, fuite du réveil, placement du cochonnet…) passe par un **générateur pseudo-aléatoire à graine** (`Rng`), jamais `Math.random()`. Indispensable pour les tests et pour le jeu en ligne (la graine est fixée par le serveur).

## Jeu 1 — Foot

Inchangé par rapport à la V1, sauf la condition de victoire : **premier à 2 buts**.

### Terrain
- Terrain en forme de **stade** (rectangle aux coins très arrondis) entouré d'une bordure rigide.
- Ligne médiane, un but à gauche et un à droite.
- Orientation **paysage**, résolution logique 1600×900, `Phaser.Scale.FIT` avec centrage.

### Entités
- **3 botz par équipe** (rouge à gauche, jaune à droite), en triangle devant leur but au coup d'envoi.
- **1 réveil** au centre, qui remplace le ballon.

### Le réveil qui s'enfuit
- Réveil rond à l'ancienne (deux cloches, aiguilles, petites roulettes). Quand il sonne, il vibre, avec des notes ♪ autour de lui ; ses aiguilles tournent plus vite selon sa panique.
- Pendant chaque résolution, il **se propulse tout seul** pendant 2 à 3 s, à l'opposé du botz le plus proche (+ un peu d'aléatoire). Près d'une bordure, il longe le mur au lieu de foncer dedans.
- **Étourdissement** : percuté fort, il s'arrête ~1,5 s (étoiles qui tournent).
- Corps physique normal : on peut le pousser, il rebondit.
- **Panique progressive** (lent en début de jeu, puis il accélère), selon le numéro du tour dans le jeu :

| Niveau | Tours | Force de fuite | Ambiance |
|---|---|---|---|
| 0 — Somnolent | 1 à 3 | très faible (il se traîne) | petite sonnerie lente |
| 1 — Réveillé | 4 à 6 | faible | sonnerie normale |
| 2 — Inquiet | 7 à 10 | moyenne | sonnerie rapide, il tremble |
| 3 — Panique | 11 et plus | forte (plafonnée) | sonnerie frénétique |

- Après un but, la panique **redescend d'un cran**. Le niveau est visible dans le HUD (jauge « Réveil »).

### Buts
- But quand le réveil entre entièrement dans la zone de but. Effet visuel, puis replacement (les pièces perdues restent perdues).
- Premier à 2 buts gagne le jeu.

## Jeu 2 — Survivant

Les botz sont sur une **passerelle ronde métallique au-dessus d'un lac de lave**. Il faut pousser les botz adverses dans la lave et rester sur la passerelle. Maquette : « Jeu 2 — Survivant ».

### Arène
- Passerelle circulaire au centre de l'écran (rayon initial ≈ 330 en unités logiques), sans bordure. Tout autour : de la lave (animée : bulles, petites éclaboussures), puis les tribunes avec le public.
- Le sol métallique est **un peu plus glissant** que la pelouse (`frictionAir` réduit, configurable) pour que les poussées portent.

### Équipes
- **3 botz par équipe** par défaut, option **2 botz** dans les réglages (`survivorBotsPerTeam`).
- Départ : chaque équipe en arc de cercle sur un côté de la passerelle, face à face.
- Pas de réveil dans ce jeu.

### Chute dans la lave
- Un botz est **éliminé dès que son centre sort de la passerelle** (distance au centre > rayon actuel). Son corps est retiré de la physique immédiatement.
- Animation : le botz rétrécit et tombe (0,3 s), éclaboussure de lave, bulles, petit « plouf » métallique, réaction du public. Il reste un petit panache de fumée quelques secondes.

### La passerelle rétrécit
- Pour garantir une fin de partie : **tous les 3 tours**, l'anneau extérieur de la passerelle s'effondre et le rayon diminue de 12 % (minimum 40 % du rayon initial).
- **Un tour avant**, l'anneau qui va tomber clignote en rouge, avec des fissures, et le HUD affiche « La passerelle rétrécit dans 1 tour ».
- Les botz qui se trouvent sur l'anneau qui s'effondre tombent avec lui.

### Victoire
- L'équipe qui a encore au moins un botz sur la passerelle quand l'autre n'en a plus gagne le jeu.
- Si les derniers botz des deux équipes tombent pendant la même résolution : **mort subite** : chaque équipe repart avec 1 botz sur une petite passerelle (40 % du rayon), jusqu'à ce qu'un seul reste.

### HUD
« Jeu 2/3 · Survivant », compteur de botz restants par équipe (icônes pleines / grisées), timer de visée, avertissement de rétrécissement, GO.

## Jeu 3 — Pétanque

On joue à la pétanque avec les botz, sur un terrain de gravier. Le **cochonnet est un mini réveil endormi** (il ne bouge jamais tout seul). Maquette : « Jeu 3 — Pétanque ».

### Terrain
- Rectangle de **gravier** (couleur sable avec petits cailloux) entouré d'une **bordure en bois** : on rebondit dessus, mais avec une faible restitution (≈ 0,3).
- Gravier : **forte friction** (`frictionAir` élevé) pour que les botz s'arrêtent vite et à un endroit prévisible.
- À gauche, **deux cercles de lancer** (un par équipe, l'un au-dessus de l'autre) pour que les botz ne se gênent pas au départ.

### Déroulement d'une mène
1. Début de mène : le cochonnet est placé **au hasard** dans les deux tiers droits du terrain (à distance minimale des bordures), via le `Rng`.
2. Chaque équipe a **3 botz** à lancer. À chaque tour, le prochain botz de chaque équipe apparaît dans son cercle de lancer, et **les deux joueurs visent et lancent en même temps** (un seul botz chacun par tour).
3. Après 3 tours, tous les botz sont lancés : on **compte les points**.
4. Les botz déjà lancés restent sur le terrain : on peut les percuter (« tirer »), et pousser le cochonnet.

### Comptage
- Distance d'un botz au cochonnet = distance entre centres moins les rayons.
- L'équipe qui a le botz **le plus proche** gagne la mène et marque **1 point par botz plus proche que le meilleur botz adverse**.
- Animation « On mesure ! » : lignes pointillées du cochonnet vers les botz les plus proches, badge « le plus près », puis points ajoutés au score.
- Égalité parfaite de distance (rare) : mène nulle, on rejoue.
- Les botz et débris sont retirés, le cochonnet est replacé, nouvelle mène.

### Victoire
Premier à **3 points** gagne le jeu (plusieurs mènes si besoin).

### HUD
« Jeu 3/3 · Pétanque », score « premier à 3 », numéro de mène, « Lancer 2/3 », botz restants à lancer près de chaque cercle, timer, GO.

### Calibrage
Ajouter dans le core une fonction `estimateTravelDistance(power)` (calibrée par simulation sur le gravier) et son inverse `powerForDistance(d)`. L'IA s'en sert, et elle permet de vérifier que la portée max couvre bien la longueur du terrain.

## Modes de jeu

Le menu principal propose :
1. **Jouer en solo** contre l'IA (3 niveaux : facile, normal, difficile).
2. **2 joueurs · même téléphone** (pass & play) : le joueur 1 vise, un écran intermédiaire masque le terrain (« Passe le téléphone au joueur 2 »), le joueur 2 vise, puis la résolution se joue.
3. **En ligne** : 2 joueurs sur 2 téléphones différents, qui visent **en même temps** (voir plus bas).
4. Réglages (son, difficulté, botz par équipe en Survivant) et « Partie libre » (un seul jeu au choix).

## Jeu en ligne (2 téléphones)

### Principe
- Les deux joueurs jouent en même temps, chacun sur son téléphone : pendant la visée, chacun place ses flèches de son côté ; l'adversaire voit seulement « Adversaire : en train de viser… » puis « Adversaire prêt ✓ ».
- Le **serveur fait autorité** : il fait tourner la même simulation que le téléphone (package `core`), donc les deux joueurs voient exactement la même chose et personne ne peut tricher sur la physique.
- Pas de compte en V2 : un pseudo (mémorisé localement) et un **code de partie**.

### Lobby
Maquette : « Jouer en ligne ».
- **Créer une partie** : le serveur crée une room et renvoie un **code de 4 caractères** (lettres et chiffres sans caractères ambigus : pas de 0/O, 1/I/L). Gros affichage du code, bouton « Partager le code » (Capacitor Share), état « En attente d'un adversaire… ».
- **Rejoindre** : saisie du code (4 cases), bouton « Rejoindre ». Erreurs claires : code inconnu, partie pleine, version de l'app trop ancienne.
- Le créateur joue **rouge**, l'invité **jaune**.
- Lien profond `botz://join/K7Q2` : optionnel en V2.

### Protocole (Colyseus)
1. Room de 2 joueurs. Le serveur tient l'état du tournoi (jeu en cours, score, trophées) et fixe la **graine** du `Rng`.
2. **Visée** : le serveur lance le timer de 15 s. Chaque client envoie ses visées (`{ botId, angle, power }[]`) puis « prêt ». Le serveur **valide** les entrées (botz du bon camp, `power` limité à [0, 1], un seul botz par tour en Pétanque).
3. **Résolution** : quand les deux sont prêts (ou que le timer expire), le serveur simule avec un pas fixe, puis envoie aux clients :
   - la **liste des snapshots** (positions, angles, états) à 30 Hz ;
   - les **événements** horodatés : pièce perdue, but, chute dans la lave, étourdissement du réveil, fin de mène, points…
   Les clients **rejouent** cette animation (interpolation entre snapshots) et déclenchent sons et effets sur les événements. Ils n'exécutent pas la physique en ligne.
4. Chaque client envoie « animation terminée », puis le serveur passe au tour suivant (avec un délai max pour ne pas attendre un client lent).
5. Écran de classement : chacun appuie sur « Jeu suivant », le serveur démarre le jeu suivant quand les deux sont prêts.

### Déconnexions
- En cas de coupure, la partie se met en pause pour l'autre joueur (« Adversaire déconnecté… 30 s »). Reconnexion automatique via le jeton de reconnexion Colyseus.
- Après 30 s : **victoire par forfait** pour celui qui est resté.
- Si l'app passe en arrière-plan pendant la visée, le timer continue (les visées déjà posées sont envoyées à la fin du timer).

### Serveur
- `apps/server` : Node.js + Colyseus, TypeScript, utilise `packages/core`.
- **Dockerfile** et `docker-compose.yml` (serveur + reverse proxy TLS, ex. Caddy) pour héberger sur un petit VPS ; le client se connecte en `wss://`.
- Variable d'environnement côté client : `VITE_SERVER_URL`.
- Endpoint `/health`, logs structurés, limite de rooms et limitation de débit simple sur la création de rooms.
- Contrôle de version : le client envoie sa version ; le serveur refuse une version incompatible (« Mets à jour l'app »).
- En développement : `npm run dev:server` et deux onglets de navigateur suffisent à tester une partie en ligne.

### Fin de tournoi en ligne
Écran final identique, avec un bouton « Revanche » : si les deux joueurs l'acceptent, un nouveau tournoi démarre dans la même room.

## IA

Logique simple dans `AIController`, une stratégie par jeu, sans physique prédictive lourde. Le niveau de difficulté ajoute du bruit sur l'angle et la puissance. L'IA subit elle aussi la déformation des trajectoires due aux pièces manquantes.

- **Foot** : un attaquant vise derrière le réveil dans l'axe réveil → but adverse (en visant un peu plus loin quand la panique est élevée) ; un défenseur se place entre le réveil et son but ; le 3e alterne soutien et gêne.
- **Survivant** : pour chaque botz, choisir la cible adverse la plus proche du bord et viser un point derrière elle, sur la droite centre de la passerelle → cible, pour la pousser vers l'extérieur. Limiter la puissance pour que la distance estimée ne fasse pas sortir son propre botz. Un botz trop près du bord se replie vers le centre.
- **Pétanque** : si l'adversaire a le botz le plus proche et très près du cochonnet, **tirer** dessus à forte puissance ; sinon **pointer** avec `powerForDistance()` pour s'arrêter près du cochonnet.

## Direction artistique

- Style **flat / vectoriel**, couleurs vives, stade de nuit avec un **public de petits robots** dans les tribunes (pancartes « DRIIING ! », « RENDS TA ROUE »), panneaux pub décalés (« Boulons & Fils », « Huile extra-fine », « Pièces détachées »).
- Chaque jeu a son sol : **pelouse rayée** (Foot), **passerelle métallique rivetée sur la lave** (Survivant), **gravier et bordure en bois** (Pétanque). Les tribunes restent les mêmes pour garder l'identité.
- Couleurs : rouge `#e8473f`, jaune `#f6c234`, réveil corail `#ff6f91`, fond `#141b31`, HUD `#0e1428`, lave `#e8572a` / `#f28a3a` / `#ffb547`, gravier `#d9c49a`, bois `#a8703a`.
- Polices : **Bungee** (titres, scores) et **Fredoka** (texte).
- Pour l'instant tout est dessiné avec `Phaser.GameObjects.Graphics` ; rendu des botz, du réveil et des décors isolé dans des classes dédiées pour passer plus tard à des sprites.
- Effets : étincelles et pièces qui volent, fumée sur les épaves, étoiles sur le réveil étourdi, flash au but, éclaboussures de lave, mètre ruban « On mesure ! ».

## Écrans

- **Menu** : titre Botz, « Jouer en solo », « 2 joueurs · même téléphone », « En ligne », « Réglages », son.
- **Lobby en ligne** : créer / rejoindre.
- **Jeu** (×3) : HUD avec jeu en cours (« Jeu 1/3 · Foot »), score et condition de victoire, timer, indicateur spécifique au jeu, GO, pause.
- **Pause** : reprendre, recommencer le jeu, quitter (en ligne : quitter = forfait, avec confirmation).
- **Classement** entre les jeux, puis **écran final** du tournoi.

## Architecture

```
packages/
  core/                  (pur TypeScript, aucune dépendance à Phaser ni au DOM)
    Rng.ts
    physics/             (création du monde matter-js, pas de temps fixe, matériaux par jeu)
    entities/            (Bot, BotParts, AlarmClock, Debris, Jack = cochonnet)
    DamageSystem.ts
    modes/
      GameMode.ts        (interface : setup, applyAims, onStep, checkRules, isOver)
      SoccerMode.ts
      SurvivorMode.ts
      PetanqueMode.ts
    Tournament.ts        (ordre des jeux, trophées, réparation entre les jeux)
    TurnEngine.ts        (AIMING → RESOLVING → RULES → ...)
    ai/                  (SoccerAI, SurvivorAI, PetanqueAI)
    protocol.ts          (types des messages réseau partagés client/serveur)
apps/
  client/                (Phaser + Capacitor)
    scenes/              (Boot, Menu, OnlineLobby, Game, Ranking, Final)
    render/              (BotView, AlarmClockView, fields : SoccerField, LavaPlatform, PetanqueField)
    input/AimController.ts
    net/OnlineClient.ts  (connexion Colyseus, lecture des snapshots)
    ui/                  (HUD, boutons, overlays)
  server/                (Colyseus)
    rooms/BotzRoom.ts
    Dockerfile
```

- **Pas de temps physique fixe** (ex. 1/60 s) dans `core`, partout.
- En local (solo, même téléphone), le client exécute `core` lui-même. En ligne, il ne fait que rejouer les snapshots du serveur. La scène de jeu doit donc accepter deux sources : simulation locale ou flux réseau.
- **Migration** : déplacer la logique de la V1 (physique, règles, IA, démontage) dans `packages/core` sans changer le comportement du Foot, avec des tests avant/après.
- Le code, les noms de fichiers et les commentaires restent en **anglais**.

## Étapes de livraison V2

1. **Refactor** : monorepo, extraction de `packages/core` (matter-js direct), Foot à 2 buts, tests verts.
2. **Tournoi** : `Tournament`, écran de classement, écran final, réparation entre les jeux, « Partie libre ».
3. **Survivant** : passerelle, chutes, rétrécissement, mort subite, IA, HUD.
4. **Pétanque** : terrain, cercles de lancer, mènes, comptage animé, calibrage, IA, HUD.
5. **Serveur en ligne** : Colyseus, rooms, codes, validation, simulation serveur, snapshots + événements.
6. **Client en ligne** : lobby, lecture des snapshots, statut de l'adversaire, reconnexion, forfait, revanche.
7. **Déploiement** : Docker, reverse proxy TLS, config des builds Android/iOS vers le serveur de prod.
8. **Polish** : sons (lave, mesure, trophées), effets, équilibrage des 3 jeux.

## Critères d'acceptation V2

- Un tournoi complet (Foot → Survivant → Pétanque) est jouable contre l'IA, en 2 joueurs sur le même téléphone et en ligne, avec le classement entre chaque jeu et l'écran final.
- Foot : la partie s'arrête au 2e but.
- Survivant : un botz est éliminé dès que son centre quitte la passerelle ; la passerelle rétrécit avec un avertissement 1 tour avant ; la partie se termine toujours (mort subite en cas d'égalité).
- Pétanque : un seul botz par équipe et par tour, comptage correct des points (tests unitaires sur plusieurs configurations), premier à 3 points.
- En ligne : deux téléphones (ou deux onglets) jouent la même partie et voient exactement la même animation ; une déconnexion de moins de 30 s reprend la partie ; au-delà, forfait.
- Aucune visée adverse n'est visible avant la résolution, en local comme en ligne.
- 60 fps sur un téléphone Android de milieu de gamme, dans les 3 jeux.
- Le README explique : lancer le client en dev, lancer le serveur en dev, tester le mode en ligne en local, builder Android/iOS, déployer le serveur avec Docker.

## Hors périmètre (pour plus tard)

- Matchmaking aléatoire, comptes, classement mondial, amis
- Plus de 2 joueurs (2 contre 2, 4 équipes)
- Autres jeux (basket, rally, fléchettes…) et variante « montagne » du Survivant
- Le réveil comme obstacle neutre en Survivant
- Autres objets-ballons (œuf qui éclot, hamster dans sa boule…)
- Personnalités des botz, bugs aléatoires, turbo-prout, aspirateur robot, commentateur
- Personnalisation des botz, progression, boutique
