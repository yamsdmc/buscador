# Buscador Catastro

SaaS ultra simple autour du Catastro espagnol (Sede Electrónica del Catastro).

## Deux usages

1. **Référence cadastrale → adresse + photo**
   `Consulta_CPMRC` (RC → coordonnées + adresse), puis orthophoto PNOA (IGN) avec le
   contour de la parcelle (WFS INSPIRE), + emplacement Street View.
2. **Adresse → cadastre + 10 parcelles les plus proches**
   Géocodage de l'adresse (Nominatim), puis `Consulta_RCCOOR_Distancia` (coordonnées →
   parcelles proches triées par distance).

Aucune authentification. Les API Catastro/PNOA sont gratuites et sans clé.

## Démarrer

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

## Architecture

```
src/
├── app/
│   ├── page.tsx                    # UI (bascule RC / Adresse)
│   └── api/
│       ├── lookup/rc/route.ts      # RC      → adresse + coords
│       ├── lookup/address/route.ts # adresse → 10 parcelles proches
│       └── satellite/route.ts      # JPEG orthophoto + contour parcelle
├── components/
│   ├── ParcelDetail.tsx            # fiche : photo satellite + Street View + infos
│   └── CandidateList.tsx           # liste des parcelles proches (clic = voir)
└── lib/
    ├── catastro.ts                 # client Catastro (CPMRC, RCCOOR_Distancia, PNOA/WFS)
    ├── geocode.ts                  # géocodage adresse (Nominatim)
    └── types.ts                    # types partagés serveur ↔ client
```

## Brancher Street View (plus tard)

Façade au niveau rue via Google Street View Static API. Ajouter dans `.env.local` :

```
GOOGLE_MAPS_API_KEY=...
```

puis dans `ParcelDetail.tsx`, remplacer le placeholder par :

```
https://maps.googleapis.com/maps/api/streetview?size=600x450&location={lat},{lng}&key={KEY}
```

(prévoir un fallback « pas de couverture » en rural — Street View est faible hors zones urbaines.)

## Notes API Catastro

- Param REST des coordonnées : **`CoorX` / `CoorY`** (X = longitude, Y = latitude),
  PAS `Coordenada_X` malgré la doc PDF.
- `RefCat` doit faire 14 caractères (la *finca*/parcelle) ; les 6 derniers d'une RC à 20
  caractères identifient l'unité (appartement) et sont tronqués.
- Doc officielle : https://www.catastro.hacienda.gob.es/ws/Webservices_Libres.pdf
