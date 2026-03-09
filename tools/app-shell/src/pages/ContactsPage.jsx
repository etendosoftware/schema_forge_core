import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { KPIHeader } from '@/components/contract-ui/KPIHeader';
import { KanbanBoard } from '@/components/contract-ui/KanbanBoard';
import { Chatter } from '@/components/contract-ui/Chatter';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Users, Search, Mail, Phone, MapPin, X, Plus } from 'lucide-react';

const COLUMNS = [
  { id: 'customer', title: 'Customers', color: 'blue' },
  { id: 'vendor', title: 'Vendors', color: 'green' },
  { id: 'both', title: 'Customer & Vendor', color: 'purple' },
  { id: 'prospect', title: 'Prospects', color: 'yellow' },
];

const ALL_CONTACTS = [
  { id: 'BP-001', columnId: 'customer', title: 'Empresa ABC S.L.', subtitle: 'Madrid, Spain', avatar: 'E', badges: ['VIP'], value: 52000 },
  { id: 'BP-002', columnId: 'customer', title: 'Tech Solutions', subtitle: 'Barcelona, Spain', avatar: 'T', value: 28000 },
  { id: 'BP-003', columnId: 'customer', title: 'Global Trade Ltd', subtitle: 'London, UK', avatar: 'G', badges: ['VIP'], value: 85000 },
  { id: 'BP-004', columnId: 'vendor', title: 'Suministros Garcia', subtitle: 'Valencia, Spain', avatar: 'S' },
  { id: 'BP-005', columnId: 'vendor', title: 'Nordic Components', subtitle: 'Stockholm, Sweden', avatar: 'N' },
  { id: 'BP-006', columnId: 'both', title: 'Iberica Industrial', subtitle: 'Bilbao, Spain', avatar: 'I', value: 34000 },
  { id: 'BP-007', columnId: 'both', title: 'Mediterranean Foods', subtitle: 'Sevilla, Spain', avatar: 'M', value: 15000 },
  { id: 'BP-008', columnId: 'prospect', title: 'StartupXYZ', subtitle: 'Remote', avatar: 'S' },
  { id: 'BP-009', columnId: 'prospect', title: 'New Retail Co', subtitle: 'Malaga, Spain', avatar: 'N' },
  { id: 'BP-010', columnId: 'customer', title: 'Zaragoza Motors', subtitle: 'Zaragoza, Spain', avatar: 'Z', value: 19000 },
];

const KPIS = [
  { label: 'Total Contacts', value: 156, format: 'number', icon: Users },
  { label: 'Customers', value: 89, format: 'number', trend: 5 },
  { label: 'Vendors', value: 42, format: 'number' },
  { label: 'Pending Balance', value: 27300, format: 'currency', trend: -8 },
];

const MOCK_EMAILS = {
  'BP-001': 'contact@empresaabc.es',
  'BP-002': 'info@techsolutions.com',
  'BP-003': 'sales@globaltrade.co.uk',
  'BP-004': 'pedidos@suministrosgarcia.es',
  'BP-005': 'order@nordiccomponents.se',
  'BP-006': 'admin@ibericaindustrial.es',
  'BP-007': 'hello@medfoods.es',
  'BP-008': 'hi@startupxyz.io',
  'BP-009': 'info@newretailco.es',
  'BP-010': 'ventas@zaragozamotors.es',
};

const MOCK_PHONES = {
  'BP-001': '+34 91 555 1234',
  'BP-002': '+34 93 444 5678',
  'BP-003': '+44 20 7946 0958',
  'BP-004': '+34 96 333 4567',
  'BP-005': '+46 8 123 4567',
  'BP-006': '+34 94 222 3456',
  'BP-007': '+34 95 111 2345',
  'BP-008': '+1 555 987 6543',
  'BP-009': '+34 95 666 7890',
  'BP-010': '+34 97 888 9012',
};

const CHATTER_MESSAGES = [
  { id: '1', author: 'Ana Garcia', text: 'Renewed annual contract for $52,000', timestamp: '2026-03-08T10:30:00', type: 'note' },
  { id: '2', author: 'System', text: 'Invoice INV-0142 sent via email', timestamp: '2026-03-07T14:00:00', type: 'system' },
  { id: '3', author: 'Pedro Lopez', text: 'Meeting scheduled for Q2 review', timestamp: '2026-03-05T09:00:00', type: 'note' },
];

const CATEGORY_LABEL = {
  customer: 'Customer',
  vendor: 'Vendor',
  both: 'Customer & Vendor',
  prospect: 'Prospect',
};

function formatCurrency(value) {
  if (value == null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function DetailPanel({ contact, onClose }) {
  if (!contact) return null;

  const tags = [CATEGORY_LABEL[contact.columnId]];
  if (contact.badges) {
    tags.push(...contact.badges);
  }

  return (
    <div className="w-[380px] shrink-0 border-l bg-background overflow-y-auto">
      <div className="p-4">
        {/* Close button */}
        <div className="flex justify-end mb-2">
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close detail panel">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Avatar and name */}
        <div className="flex flex-col items-center text-center mb-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl font-bold mb-3">
            {contact.avatar}
          </div>
          <h2 className="text-lg font-semibold">{contact.title}</h2>
          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
            <MapPin className="h-3.5 w-3.5" />
            {contact.subtitle}
          </p>
        </div>

        <Separator className="my-4" />

        {/* Contact info */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{MOCK_EMAILS[contact.id] || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>{MOCK_PHONES[contact.id] || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>{contact.subtitle}</span>
          </div>
        </div>

        <Separator className="my-4" />

        {/* Activity summary */}
        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm font-medium">Activity Summary</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Last sale</span>
              <span className="font-medium">Mar 2, 2026</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total invoiced (12m)</span>
              <span className="font-medium">{contact.value ? formatCurrency(contact.value) : '-'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Pending balance</span>
              <span className="font-medium">{contact.value ? formatCurrency(Math.round(contact.value * 0.12)) : '-'}</span>
            </div>
          </CardContent>
        </Card>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mt-4">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary">{tag}</Badge>
          ))}
        </div>

        {/* Chatter */}
        <Chatter
          entityType="contact"
          entityId={contact.id}
          messages={CHATTER_MESSAGES}
          collapsed={false}
        />
      </div>
    </div>
  );
}

function ListView({ contacts, onRowClick }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left p-3 font-medium">Name</th>
            <th className="text-left p-3 font-medium">Category</th>
            <th className="text-left p-3 font-medium">Location</th>
            <th className="text-left p-3 font-medium">Email</th>
            <th className="text-right p-3 font-medium">Total Invoiced</th>
            <th className="text-right p-3 font-medium">Pending Balance</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((c) => (
            <tr
              key={c.id}
              className="border-b last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors"
              onClick={() => onRowClick(c)}
            >
              <td className="p-3 font-medium">{c.title}</td>
              <td className="p-3">
                <Badge variant="outline" className="text-xs">
                  {CATEGORY_LABEL[c.columnId]}
                </Badge>
              </td>
              <td className="p-3 text-muted-foreground">{c.subtitle}</td>
              <td className="p-3 text-muted-foreground">{MOCK_EMAILS[c.id] || '-'}</td>
              <td className="p-3 text-right tabular-nums">{c.value ? formatCurrency(c.value) : '-'}</td>
              <td className="p-3 text-right tabular-nums">{c.value ? formatCurrency(Math.round(c.value * 0.12)) : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ContactsPage() {
  const [search, setSearch] = useState('');
  const [activeView, setActiveView] = useState('kanban');
  const [selectedContact, setSelectedContact] = useState(null);
  const [cards, setCards] = useState(ALL_CONTACTS);

  const filteredCards = useMemo(() => {
    if (!search.trim()) return cards;
    const q = search.toLowerCase();
    return cards.filter(
      (c) => c.title.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q)
    );
  }, [cards, search]);

  function handleDragEnd(cardId, fromColumnId, toColumnId) {
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, columnId: toColumnId } : c))
    );
  }

  function handleCardClick(card) {
    setSelectedContact(card);
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 p-6 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-[240px]"
              />
            </div>
            <Button asChild>
              <Link to="/business-partner">
                <Plus className="h-4 w-4 mr-1.5" />
                New Contact
              </Link>
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <KPIHeader kpis={KPIS} />

        {/* Tab switcher */}
        <div className="flex gap-1 mb-4">
          <Button
            variant={activeView === 'kanban' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('kanban')}
          >
            Kanban
          </Button>
          <Button
            variant={activeView === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('list')}
          >
            List
          </Button>
        </div>

        {/* Content */}
        {activeView === 'kanban' ? (
          <KanbanBoard
            columns={COLUMNS}
            cards={filteredCards}
            onDragEnd={handleDragEnd}
            onCardClick={handleCardClick}
          />
        ) : (
          <ListView contacts={filteredCards} onRowClick={handleCardClick} />
        )}
      </div>

      {/* Detail side panel */}
      {selectedContact && (
        <DetailPanel
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
        />
      )}
    </div>
  );
}
