import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

/**
 * Pure-logic copy of findActiveGroup from SideMenu.jsx.
 * Kept in sync with src/components/layout/SideMenu/SideMenu.jsx to test matching
 * behavior without loading the React component and its JSX dependencies.
 */
function findActiveGroup(menuGroups, pathname, search) {
  const currentPath = pathname.replace(/^\//, '');
  const currentFull = currentPath + (search || '');
  return menuGroups.find((g) =>
    g.items.some((item) => {
      const itemPath = item.path || item.name;
      if (item.path && item.path.includes('?')) {
        return currentFull === itemPath;
      }
      return item.name === currentPath;
    })
  ) || null;
}

const sampleGroups = [
  {
    group: 'Home',
    section: 'General',
    items: [{ name: 'dashboard', label: 'Dashboard' }],
  },
  {
    group: 'Sales',
    section: 'Commercial',
    items: [
      { name: 'sales-order', label: 'Sales Order' },
      { name: 'sales-invoice', label: 'Sales Invoice' },
    ],
  },
  {
    group: 'Purchases',
    items: [
      { name: 'purchase-order', label: 'Purchase Order' },
      {
        name: 'report-viewer-purchases',
        label: 'Reports',
        path: 'report-viewer?category=purchases',
      },
    ],
  },
];

describe('findActiveGroup', () => {
  it('matches by item name on a simple path', () => {
    const active = findActiveGroup(sampleGroups, '/sales-order');
    assert.equal(active?.group, 'Sales');
  });

  it('returns null when no item matches', () => {
    const active = findActiveGroup(sampleGroups, '/nonexistent');
    assert.equal(active, null);
  });

  it('strips leading slash from pathname', () => {
    const active = findActiveGroup(sampleGroups, '/dashboard');
    assert.equal(active?.group, 'Home');
  });

  it('matches items with query-string paths using the full URL', () => {
    const active = findActiveGroup(
      sampleGroups,
      '/report-viewer',
      '?category=purchases'
    );
    assert.equal(active?.group, 'Purchases');
  });

  it('does not match a query-string item when search does not match', () => {
    const active = findActiveGroup(
      sampleGroups,
      '/report-viewer',
      '?category=sales'
    );
    assert.equal(active, null);
  });

  it('handles an empty search string for plain items', () => {
    const active = findActiveGroup(sampleGroups, '/sales-invoice', '');
    assert.equal(active?.group, 'Sales');
  });

  it('returns the first matching group even if multiple items share a name', () => {
    const groups = [
      { group: 'A', items: [{ name: 'shared', label: 'A' }] },
      { group: 'B', items: [{ name: 'shared', label: 'B' }] },
    ];
    const active = findActiveGroup(groups, '/shared');
    assert.equal(active?.group, 'A');
  });

  it('returns null for an empty menu', () => {
    const active = findActiveGroup([], '/dashboard');
    assert.equal(active, null);
  });
});
