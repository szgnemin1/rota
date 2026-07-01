export interface SavedAddress {
  id: string;
  label: string; // e.g., "Ev", "İş", "Depo-1"
  address: string;
  lat: number;
  lng: number;
  icon?: string; // Icon identifier
  category?: string; // Grouping category, e.g., "Depolar", "Müşteriler"
  visited?: boolean; // Visit status: true for visited, false or undefined for unvisited
}

export interface RouteStop {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  isSaved?: boolean;
}

export type TravelMode = 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';

export interface RouteSummary {
  distance: string;
  duration: string;
  steps: Array<{
    instruction: string;
    distance: string;
    duration: string;
  }>;
}
