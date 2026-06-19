/** Types partagés serveur ↔ client (sans dépendance serveur). */

export interface ParcelLocation {
  found: boolean;
  error?: "NOT_FOUND" | "NETWORK" | "MISSING_REF";
  refcat?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  province?: string;
  autonomousCommunity?: string;
  /** Coordonnées UTM (ETRS89) du centroïde de la parcelle. */
  utmX?: string;
  utmY?: string;
  /** Huso (zone) UTM, ex : "30". */
  huso?: string;
  /** Lettre de bande UTM (Espagne péninsulaire = "T"). */
  zoneLetter?: string;
  /** Altitude en mètres (IGN MDT). */
  altitude?: number;
  /** Zone climatique CTE DB-HE, ex : "D2". */
  climateZone?: string;
  /** Données du bâti (usage, surfaces, année, unités) via Consulta_DNPRC. */
  building?: BuildingInfo;
}

export interface BuildingUnit {
  /** Référence cadastrale complète (20 car.) de l'unité, si disponible. */
  rc?: string;
  use?: string;
  surface?: number;
  floor?: string;
  door?: string;
}

export interface Subparcel {
  /** Type de culture, ex : "PASTOS", "LABOR O LABRADIO SECANO". */
  crop?: string;
  /** Surface en m². */
  surface?: number;
  /** Intensité productive (classe). */
  intensity?: string;
}

export interface BuildingInfo {
  /** "UR" = urbano, "RU" = rústico. */
  type?: string;
  use?: string;
  builtSurface?: number;
  landSurface?: number;
  /** Année de construction (antigüedad). */
  year?: string;
  /** Type de finca, ex : "Parcela construida sin división horizontal". */
  fincaType?: string;
  cartographyUrl?: string;
  unitCount: number;
  units: BuildingUnit[];

  // Quick wins DNPRC
  /** Référence cadastrale complète à 20 caractères (avec digits de contrôle). */
  fullRc?: string;
  postalCode?: string;
  /** Coefficient de participation, ex : "100,00 %". */
  participation?: string;
  /** Sous-parcelles (rústico) avec type de culture. */
  subparcels?: Subparcel[];

  // Buildings INSPIRE WFS
  /** État : "Fonctionnel", "Déclaré en ruine", "En construction"… */
  condition?: string;
  /** Nombre de logements. */
  dwellings?: number;
  /** Nombre de niveaux estimé (dérivé des étages des unités). */
  levels?: number;
}

export interface NearbyParcel {
  refcat: string;
  address: string;
  /** Distance en mètres au point recherché. */
  distance: number;
}

export interface AddressSearchResult {
  found: boolean;
  error?: "ADDRESS_NOT_FOUND" | "MISSING_QUERY";
  point?: { lat: number; lng: number; label: string };
  parcels?: NearbyParcel[];
}
