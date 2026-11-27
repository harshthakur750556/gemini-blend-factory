import type { AvailableModelItem, ModelGroupName } from '../types';

export type LibraryFilterKey = ModelGroupName | 'all' | 'drive' | 'local';
export type LibrarySortMode = 'recent' | 'name' | 'size';

export interface LibraryCategoryMeta {
  id: ModelGroupName;
  label: string;
  shortLabel: string;
  order: number;
}

export const LIBRARY_CATEGORIES: LibraryCategoryMeta[] = [
  { id: 'Female_Characters', label: 'Female Characters', shortLabel: 'Female', order: 1 },
  { id: 'Male_Characters', label: 'Male Characters', shortLabel: 'Male', order: 2 },
  { id: 'Characters', label: 'Stylized & Rigged Characters', shortLabel: 'Characters', order: 3 },
  { id: 'Architecture', label: 'Architecture', shortLabel: 'Architecture', order: 4 },
  { id: 'Props', label: 'Props & Equipment', shortLabel: 'Props', order: 5 },
  { id: 'Environment', label: 'Environments', shortLabel: 'Environment', order: 6 },
  { id: 'World_Assemblies', label: 'World Assemblies', shortLabel: 'Worlds', order: 7 },
  { id: 'Sample', label: 'Studio Samples', shortLabel: 'Samples', order: 8 },
  { id: 'Cloud_CI', label: 'Cloud CI Builds', shortLabel: 'Cloud CI', order: 9 },
];

const CATEGORY_MAP = new Map<ModelGroupName, LibraryCategoryMeta>(
  LIBRARY_CATEGORIES.map((c) => [c.id, c])
);

export function getCategoryLabel(group: ModelGroupName): string {
  return CATEGORY_MAP.get(group)?.label ?? group.replace(/_/g, ' ');
}

export function getCategoryOrder(group: ModelGroupName): number {
  return CATEGORY_MAP.get(group)?.order ?? 99;
}

export interface GroupedModelSection {
  group: ModelGroupName;
  label: string;
  items: AvailableModelItem[];
}

/**
 * Filters, sorts, and groups models cleanly by category so the Model Library picker
 * can render categorized sections with live counts and search support.
 */
export function filterAndGroupLibraryModels(
  models: AvailableModelItem[],
  filter: LibraryFilterKey,
  query: string,
  sortBy: LibrarySortMode
): { flat: AvailableModelItem[]; sections: GroupedModelSection[] } {
  const q = query.trim().toLowerCase();

  const filtered = models.filter((item) => {
    if (filter === 'drive' && item.source !== 'google-drive') return false;
    if (filter === 'local' && item.source !== 'local-file') return false;
    if (filter !== 'all' && filter !== 'drive' && filter !== 'local' && item.group !== filter) {
      return false;
    }
    if (q) {
      const catLabel = getCategoryLabel(item.group);
      const hay = `${item.name} ${item.slug} ${item.group} ${catLabel} ${item.format} ${item.description || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'size') return (b.sizeBytes || 0) - (a.sizeBytes || 0);
    return (b.updatedAt || '').localeCompare(a.updatedAt || '') || a.name.localeCompare(b.name);
  });

  const buckets = new Map<ModelGroupName, AvailableModelItem[]>();
  for (const item of sorted) {
    const arr = buckets.get(item.group) ?? [];
    arr.push(item);
    buckets.set(item.group, arr);
  }

  const sections: GroupedModelSection[] = Array.from(buckets.entries())
    .sort(([ga], [gb]) => getCategoryOrder(ga) - getCategoryOrder(gb))
    .map(([group, items]) => ({
      group,
      label: getCategoryLabel(group),
      items,
    }));

  return { flat: sorted, sections };
}
