import { useMemo, useState } from "react";
import { Search, Plus } from "lucide-react";
import { useInspector } from "./InspectorProvider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AddFieldDialog({ open, onOpenChange, entityName }) {
  const { schema, schemaRaw, addField } = useInspector();
  const [search, setSearch] = useState("");
  const [selectedFieldName, setSelectedFieldName] = useState(null);
  const [visibility, setVisibility] = useState("editable");
  const [required, setRequired] = useState(false);
  const [grid, setGrid] = useState(false);
  const [form, setForm] = useState(true);
  const [searchable, setSearchable] = useState(false);

  const availableFields = useMemo(() => {
    const rawEntity = schemaRaw?.entities?.find((e) => e.name === entityName);
    const curatedEntity = schema?.entities?.find((e) => e.name === entityName);
    if (!rawEntity?.fields) return [];
    const curatedNames = new Set(
      (curatedEntity?.fields ?? []).map((f) => f.name)
    );
    return rawEntity.fields.filter((f) => !curatedNames.has(f.name));
  }, [schema, schemaRaw, entityName]);

  const filteredFields = useMemo(() => {
    if (!search.trim()) return availableFields;
    const q = search.toLowerCase();
    return availableFields.filter(
      (f) =>
        f.name?.toLowerCase().includes(q) ||
        f.column?.toLowerCase().includes(q)
    );
  }, [availableFields, search]);

  const selectedRawField = useMemo(
    () => availableFields.find((f) => f.name === selectedFieldName) ?? null,
    [availableFields, selectedFieldName]
  );

  function resetState() {
    setSearch("");
    setSelectedFieldName(null);
    setVisibility("editable");
    setRequired(false);
    setGrid(false);
    setForm(true);
    setSearchable(false);
  }

  function handleOpenChange(nextOpen) {
    if (!nextOpen) resetState();
    onOpenChange(nextOpen);
  }

  function handleAdd() {
    if (!selectedRawField) return;
    addField(entityName, {
      ...selectedRawField,
      visibility,
      required,
      grid,
      form,
      searchable,
    });
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Field</DialogTitle>
          <DialogDescription>
            Select a field from the raw schema to add to {entityName}.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or column..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Field list */}
        <div className="flex-1 min-h-0 overflow-y-auto border rounded-md max-h-48">
          {filteredFields.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">
              No available fields found.
            </p>
          ) : (
            <ul className="divide-y">
              {filteredFields.map((field) => (
                <li
                  key={field.name}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedFieldName(field.name)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedFieldName(field.name);
                    }
                  }}
                  className={`px-3 py-2 cursor-pointer text-sm transition-colors hover:bg-accent ${
                    selectedFieldName === field.name ? "bg-primary/10" : ""
                  }`}
                >
                  <span className="font-medium">{field.name}</span>
                  <span className="mx-1.5 text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{field.column}</span>
                  <span className="mx-1.5 text-muted-foreground">·</span>
                  <span className="text-muted-foreground text-xs">
                    {field.type}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Configuration panel */}
        {selectedRawField && (
          <div className="space-y-3 border rounded-md p-3">
            <p className="text-sm font-medium">
              Configure: {selectedRawField.name}
            </p>

            {/* Visibility */}
            <div className="flex items-center justify-between">
              <Label htmlFor="add-visibility">Visibility</Label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger id="add-visibility" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editable">Editable</SelectItem>
                  <SelectItem value="readOnly">Read Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Required */}
            <div className="flex items-center justify-between">
              <Label htmlFor="add-required">Required</Label>
              <Switch
                id="add-required"
                checked={required}
                onCheckedChange={setRequired}
              />
            </div>

            {/* Grid */}
            <div className="flex items-center justify-between">
              <Label htmlFor="add-grid">Grid</Label>
              <Switch
                id="add-grid"
                checked={grid}
                onCheckedChange={setGrid}
              />
            </div>

            {/* Form */}
            <div className="flex items-center justify-between">
              <Label htmlFor="add-form">Form</Label>
              <Switch
                id="add-form"
                checked={form}
                onCheckedChange={setForm}
              />
            </div>

            {/* Searchable */}
            <div className="flex items-center justify-between">
              <Label htmlFor="add-searchable">Searchable</Label>
              <Switch
                id="add-searchable"
                checked={searchable}
                onCheckedChange={setSearchable}
              />
            </div>
          </div>
        )}

        {/* Add button */}
        <Button
          onClick={handleAdd}
          disabled={!selectedRawField}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-1" />
          {selectedRawField ? `Add ${selectedRawField.name}` : "Select a field"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
