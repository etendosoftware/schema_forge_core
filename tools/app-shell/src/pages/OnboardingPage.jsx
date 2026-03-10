import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Building2,
  User,
  Blocks,
  Upload,
  Rocket,
  ChevronLeft,
  ChevronRight,
  Check,
  FileSpreadsheet,
  Link2,
  Sparkles,
} from 'lucide-react';

const STEPS = [
  { label: 'Company Setup', icon: Building2 },
  { label: 'User Profile', icon: User },
  { label: 'Module Selection', icon: Blocks },
  { label: 'Import Data', icon: Upload },
  { label: 'Review & Launch', icon: Rocket },
];

const INDUSTRIES = [
  'Manufacturing', 'Retail', 'Wholesale', 'Services', 'Technology',
  'Healthcare', 'Construction', 'Agriculture', 'Logistics', 'Other',
];

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'];

const TIMEZONES = [
  'UTC-8 (Pacific)', 'UTC-7 (Mountain)', 'UTC-6 (Central)', 'UTC-5 (Eastern)',
  'UTC+0 (GMT)', 'UTC+1 (CET)', 'UTC+2 (EET)', 'UTC+8 (SGT)', 'UTC+9 (JST)',
];

const MODULES = [
  { key: 'sales', label: 'Sales', description: 'Quotations, orders, invoices' },
  { key: 'purchases', label: 'Purchases', description: 'Purchase orders, receipts' },
  { key: 'inventory', label: 'Inventory', description: 'Stock, movements, warehouses' },
  { key: 'accounting', label: 'Accounting', description: 'GL, payments, reconciliation' },
  { key: 'crm', label: 'CRM', description: 'Leads, deals, activities' },
  { key: 'hr', label: 'HR', description: 'Employees, absences, payroll' },
  { key: 'projects', label: 'Projects', description: 'Tasks, time tracking, docs' },
];

const IMPORT_OPTIONS = [
  {
    key: 'fresh',
    label: 'Start Fresh',
    description: 'Begin with an empty database and configure everything from scratch.',
    icon: Sparkles,
  },
  {
    key: 'csv',
    label: 'Import from CSV',
    description: 'Upload CSV files for products, contacts, and opening balances.',
    icon: FileSpreadsheet,
  },
  {
    key: 'erp',
    label: 'Connect to ERP',
    description: 'Migrate data from an existing ERP system via API integration.',
    icon: Link2,
  },
];

const INITIAL_FORM = {
  companyName: '',
  industry: '',
  companySize: '',
  timezone: '',
  userName: '',
  userEmail: '',
  userRole: '',
  modules: ['sales', 'inventory'],
  importMethod: 'fresh',
};

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(INITIAL_FORM);

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const toggleModule = (key) =>
    setForm((prev) => ({
      ...prev,
      modules: prev.modules.includes(key)
        ? prev.modules.filter((m) => m !== key)
        : [...prev.modules, key],
    }));

  const canNext =
    step === 0
      ? form.companyName && form.industry && form.companySize && form.timezone
      : step === 1
        ? form.userName && form.userEmail && form.userRole
        : step === 2
          ? form.modules.length > 0
          : true;

  const handleLaunch = () => {
    navigate('/dashboard');
  };

  // -- Step renderers ----------------------------------------------------------

  const renderCompanySetup = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-2">
        <Label htmlFor="companyName">Company Name</Label>
        <Input
          id="companyName"
          placeholder="Acme Corp"
          value={form.companyName}
          onChange={(e) => set('companyName', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="industry">Industry</Label>
        <select
          id="industry"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={form.industry}
          onChange={(e) => set('industry', e.target.value)}
        >
          <option value="">Select industry...</option>
          {INDUSTRIES.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="companySize">Company Size</Label>
        <select
          id="companySize"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={form.companySize}
          onChange={(e) => set('companySize', e.target.value)}
        >
          <option value="">Select size...</option>
          {COMPANY_SIZES.map((s) => (
            <option key={s} value={s}>{s} employees</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="timezone">Timezone</Label>
        <select
          id="timezone"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={form.timezone}
          onChange={(e) => set('timezone', e.target.value)}
        >
          <option value="">Select timezone...</option>
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </div>
    </div>
  );

  const renderUserProfile = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="md:col-span-2 flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-2xl font-semibold">
          {form.userName ? form.userName.charAt(0).toUpperCase() : '?'}
        </div>
        <div className="text-sm text-muted-foreground">
          Avatar will be generated from your initials
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="userName">Full Name</Label>
        <Input
          id="userName"
          placeholder="Jane Smith"
          value={form.userName}
          onChange={(e) => set('userName', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="userEmail">Email</Label>
        <Input
          id="userEmail"
          type="email"
          placeholder="jane@acme.com"
          value={form.userEmail}
          onChange={(e) => set('userEmail', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="userRole">Role</Label>
        <select
          id="userRole"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={form.userRole}
          onChange={(e) => set('userRole', e.target.value)}
        >
          <option value="">Select role...</option>
          <option value="admin">Administrator</option>
          <option value="manager">Manager</option>
          <option value="user">Standard User</option>
          <option value="viewer">Viewer</option>
        </select>
      </div>
    </div>
  );

  const renderModuleSelection = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {MODULES.map((mod) => {
        const selected = form.modules.includes(mod.key);
        return (
          <Card
            key={mod.key}
            className={`cursor-pointer transition-all ${
              selected
                ? 'ring-2 ring-primary border-primary'
                : 'hover:border-muted-foreground/50'
            }`}
            onClick={() => toggleModule(mod.key)}
          >
            <CardContent className="p-4 flex items-start gap-3">
              <div
                className={`mt-0.5 h-5 w-5 rounded border flex items-center justify-center ${
                  selected
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-muted-foreground/30'
                }`}
              >
                {selected && <Check className="h-3.5 w-3.5" />}
              </div>
              <div>
                <p className="font-medium text-sm">{mod.label}</p>
                <p className="text-xs text-muted-foreground">{mod.description}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const renderImportData = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {IMPORT_OPTIONS.map((opt) => {
        const selected = form.importMethod === opt.key;
        const Icon = opt.icon;
        return (
          <Card
            key={opt.key}
            className={`cursor-pointer transition-all ${
              selected
                ? 'ring-2 ring-primary border-primary'
                : 'hover:border-muted-foreground/50'
            }`}
            onClick={() => set('importMethod', opt.key)}
          >
            <CardContent className="p-6 text-center space-y-3">
              <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Icon className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium">{opt.label}</p>
              <p className="text-xs text-muted-foreground">{opt.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const renderReview = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Company
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Name</span>
            <p className="font-medium">{form.companyName}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Industry</span>
            <p className="font-medium">{form.industry}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Size</span>
            <p className="font-medium">{form.companySize}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Timezone</span>
            <p className="font-medium">{form.timezone}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" /> User Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Name</span>
            <p className="font-medium">{form.userName}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Email</span>
            <p className="font-medium">{form.userEmail}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Role</span>
            <p className="font-medium">{form.userRole}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Blocks className="h-4 w-4" /> Selected Modules
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {form.modules.map((key) => {
            const mod = MODULES.find((m) => m.key === key);
            return (
              <Badge key={key} variant="secondary">
                {mod?.label ?? key}
              </Badge>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" /> Data Import
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p className="font-medium">
            {IMPORT_OPTIONS.find((o) => o.key === form.importMethod)?.label}
          </p>
        </CardContent>
      </Card>
    </div>
  );

  const STEP_RENDERERS = [
    renderCompanySetup,
    renderUserProfile,
    renderModuleSelection,
    renderImportData,
    renderReview,
  ];

  const StepIcon = STEPS[step].icon;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Setup Wizard</h1>
        <Badge variant="outline">Step {step + 1} of {STEPS.length}</Badge>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          {STEPS.map((s, i) => (
            <span
              key={s.label}
              className={i <= step ? 'text-primary font-medium' : ''}
            >
              {s.label}
            </span>
          ))}
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StepIcon className="h-5 w-5" />
            {STEPS[step].label}
          </CardTitle>
        </CardHeader>
        <CardContent>{STEP_RENDERERS[step]()}</CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleLaunch}>
            <Rocket className="h-4 w-4 mr-1" />
            Launch
          </Button>
        )}
      </div>
    </div>
  );
}
