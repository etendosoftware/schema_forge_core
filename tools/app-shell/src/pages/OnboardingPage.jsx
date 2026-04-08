import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUI } from '@/i18n';
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
  Sparkles,
} from 'lucide-react';

const STEPS = [
  { labelKey: 'onboardingCompanySetup', icon: Building2 },
  { labelKey: 'onboardingUserProfile', icon: User },
  { labelKey: 'onboardingModuleSelection', icon: Blocks },
  { labelKey: 'onboardingImportData', icon: Upload },
  { labelKey: 'onboardingReviewLaunch', icon: Rocket },
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
  { key: 'sales', labelKey: 'moduleSales', descriptionKey: 'moduleSalesDesc' },
  { key: 'purchases', labelKey: 'modulePurchases', descriptionKey: 'modulePurchasesDesc' },
  { key: 'inventory', labelKey: 'moduleInventory', descriptionKey: 'moduleInventoryDesc' },
  { key: 'accounting', labelKey: 'moduleAccounting', descriptionKey: 'moduleAccountingDesc' },
  { key: 'crm', labelKey: 'moduleCrm', descriptionKey: 'moduleCrmDesc' },
  { key: 'hr', labelKey: 'moduleHr', descriptionKey: 'moduleHrDesc' },
  { key: 'projects', labelKey: 'moduleProjects', descriptionKey: 'moduleProjectsDesc' },
];

const IMPORT_OPTIONS = [
  {
    key: 'fresh',
    labelKey: 'importStartFresh',
    descriptionKey: 'importStartFreshDesc',
    icon: Sparkles,
  },
  {
    key: 'csv',
    labelKey: 'importCsv',
    descriptionKey: 'importCsvDesc',
    icon: FileSpreadsheet,
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
  const ui = useUI();
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

  let canNext = true;
  if (step === 0) {
    canNext = Boolean(form.companyName && form.industry && form.companySize && form.timezone);
  } else if (step === 1) {
    canNext = Boolean(form.userName && form.userEmail && form.userRole);
  } else if (step === 2) {
    canNext = form.modules.length > 0;
  }

  const handleLaunch = () => {
    navigate('/dashboard');
  };

  // -- Step renderers ----------------------------------------------------------

  const renderCompanySetup = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-2">
        <Label htmlFor="companyName">{ui('companyName')}</Label>
        <Input
          id="companyName"
          placeholder="Acme Corp"
          value={form.companyName}
          onChange={(e) => set('companyName', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="industry">{ui('industry')}</Label>
        <select
          id="industry"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={form.industry}
          onChange={(e) => set('industry', e.target.value)}
        >
          <option value="">{ui('selectIndustry')}</option>
          {INDUSTRIES.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="companySize">{ui('companySize')}</Label>
        <select
          id="companySize"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={form.companySize}
          onChange={(e) => set('companySize', e.target.value)}
        >
          <option value="">{ui('selectSize')}</option>
          {COMPANY_SIZES.map((s) => (
            <option key={s} value={s}>{s} employees</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="timezone">{ui('timezone')}</Label>
        <select
          id="timezone"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={form.timezone}
          onChange={(e) => set('timezone', e.target.value)}
        >
          <option value="">{ui('selectTimezone')}</option>
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
          {ui('avatarGenerated')}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="userName">{ui('fullName')}</Label>
        <Input
          id="userName"
          placeholder="Jane Smith"
          value={form.userName}
          onChange={(e) => set('userName', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="userEmail">{ui('email')}</Label>
        <Input
          id="userEmail"
          type="email"
          placeholder="jane@acme.com"
          value={form.userEmail}
          onChange={(e) => set('userEmail', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="userRole">{ui('role')}</Label>
        <select
          id="userRole"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={form.userRole}
          onChange={(e) => set('userRole', e.target.value)}
        >
          <option value="">{ui('selectRole')}</option>
          <option value="admin">{ui('administrator')}</option>
          <option value="manager">{ui('manager')}</option>
          <option value="user">{ui('standardUser')}</option>
          <option value="viewer">{ui('viewer')}</option>
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
                <p className="font-medium text-sm">{ui(mod.labelKey)}</p>
                  <p className="text-xs text-muted-foreground">{ui(mod.descriptionKey)}</p>
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
              <p className="font-medium">{ui(opt.labelKey)}</p>
              <p className="text-xs text-muted-foreground">{ui(opt.descriptionKey)}</p>
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
            <Building2 className="h-4 w-4" /> {ui('company')}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">{ui('name')}</span>
            <p className="font-medium">{form.companyName}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{ui('industry')}</span>
            <p className="font-medium">{form.industry}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{ui('size')}</span>
            <p className="font-medium">{form.companySize}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{ui('timezone')}</span>
            <p className="font-medium">{form.timezone}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" /> {ui('userProfile')}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">{ui('name')}</span>
            <p className="font-medium">{form.userName}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{ui('email')}</span>
            <p className="font-medium">{form.userEmail}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{ui('role')}</span>
            <p className="font-medium">{form.userRole}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Blocks className="h-4 w-4" /> {ui('selectedModules')}
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
            <Upload className="h-4 w-4" /> {ui('dataImport')}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p className="font-medium">
            {ui(IMPORT_OPTIONS.find((o) => o.key === form.importMethod)?.labelKey)}
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
        <h1 className="text-2xl font-bold tracking-tight">{ui('setupWizard')}</h1>
        <Badge variant="outline">{ui('stepOf', { step: step + 1, total: STEPS.length })}</Badge>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          {STEPS.map((s, i) => (
            <span
              key={s.labelKey}
              className={i <= step ? 'text-primary font-medium' : ''}
            >
              {ui(s.labelKey)}
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
            {ui(STEPS[step].labelKey)}
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
          {ui('back')}
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
            {ui('next')}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleLaunch}>
            <Rocket className="h-4 w-4 mr-1" />
            {ui('launch')}
          </Button>
        )}
      </div>
    </div>
  );
}
