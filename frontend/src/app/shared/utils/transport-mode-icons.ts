import { LocationSearchResult } from '../services/transport';

const MODE_ICON: Record<string, string> = {
  bus: 'fa-solid fa-bus',
  trollybus: 'fa-solid fa-bus',
  rail: 'fa-solid fa-train',
  tram: 'fa-solid fa-train-tram',
  metro: 'fa-solid fa-train-subway',
  water: 'fa-solid fa-ship',
  // No dedicated FontAwesome icon for telecabin (also covers funicular/cog-rail stops like
  // Zermatt's GGB) — train-subway reused per explicit user choice.
  telecabin: 'fa-solid fa-train-subway',
  cableway: 'fa-solid fa-cable-car',
  air: 'fa-solid fa-plane',
};

/** Icon classes to render for a location-search result, right-aligned next to its name. */
export function resultIcons(result: LocationSearchResult): string[] {
  if (result.type === 'address') return ['fa-solid fa-location-dot'];
  return result.modes.map(m => MODE_ICON[m]).filter((icon): icon is string => !!icon);
}
