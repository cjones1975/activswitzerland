export type PracticalInfoKey = 'getting-around' | 'great-outdoors' | 'cost-of-living' | 'culture-history';

export interface PracticalInfoConfig {
  icons: [string, string, string];
  label: string;
}

export const PRACTICAL_INFO_CATEGORIES: Record<PracticalInfoKey, PracticalInfoConfig> = {
  'getting-around': {
    icons: ['fa-solid fa-plane-arrival', 'fa-sharp fa-solid fa-ticket', 'fa-solid fa-train'],
    label: 'practicalInfo.gettingAround',
  },
  'great-outdoors': {
    icons: ['fa-solid fa-compass', 'fa-solid fa-route', 'fa-solid fa-cabin'],
    label: 'practicalInfo.greatOutdoors',
  },
  'cost-of-living': {
    icons: ['fa-regular fa-money-bill-1-wave', 'fa-solid fa-plate-utensils', 'fa-solid fa-bed'],
    label: 'practicalInfo.costOfLiving',
  },
  'culture-history': {
    icons: ['fa-solid fa-globe', 'fa-solid fa-box-ballot', 'fa-solid fa-comments'],
    label: 'practicalInfo.cultureHistory',
  },
};
