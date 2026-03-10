import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useInspector } from "./InspectorProvider";
import { AddFieldDialog } from "./AddFieldDialog.jsx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export function SchemaInspector() {
  const {
    schema,
    selectedField,
    selectedEntity,
    selectField,
    updateField,
    removeField,
  } = useInspector();

  const [addDialogOpen, setAddDialogOpen] = useState(false);

  if (!selectedField) return null;

  const entity = schema?.entities?.find((e) => e.name === selectedEntity);
  const field = entity?.fields?.find((f) => f.name === selectedField);

  if (!field) return null;

  const handleClose = () => selectField(null, null);

  const handleUpdate = (key, value) => {
    updateField(selectedEntity, selectedField, { [key]: value });
  };

  const handleRemove = () => {
    removeField(selectedEntity, selectedField);
    handleClose();
  };

  return (
    <Sheet open={!!selectedField} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{field.name}</SheetTitle>
          <SheetDescription>
            {field.column} &middot; {selectedEntity}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 py-6">
          {/* Visibility */}
          <div className="flex flex-col gap-2">
            <Label>Visibility</Label>
            <Select
              value={field.visibility}
              onValueChange={(value) => handleUpdate("visibility", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editable">Editable</SelectItem>
                <SelectItem value="readOnly">Read Only</SelectItem>
                <SelectItem value="discarded">Discarded</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Required */}
          <div className="flex items-center justify-between">
            <Label htmlFor="required-switch">Required</Label>
            <Switch
              id="required-switch"
              checked={field.required}
              onCheckedChange={(checked) => handleUpdate("required", checked)}
            />
          </div>

          {/* Grid */}
          <div className="flex items-center justify-between">
            <Label htmlFor="grid-switch">Grid</Label>
            <Switch
              id="grid-switch"
              checked={field.grid}
              onCheckedChange={(checked) => handleUpdate("grid", checked)}
            />
          </div>

          {/* Form */}
          <div className="flex items-center justify-between">
            <Label htmlFor="form-switch">Form</Label>
            <Switch
              id="form-switch"
              checked={field.form}
              onCheckedChange={(checked) => handleUpdate("form", checked)}
            />
          </div>

          {/* Searchable */}
          <div className="flex items-center justify-between">
            <Label htmlFor="searchable-switch">Searchable</Label>
            <Switch
              id="searchable-switch"
              checked={field.searchable}
              onCheckedChange={(checked) => handleUpdate("searchable", checked)}
            />
          </div>

          <Separator />

          {/* Remove Field */}
          <Button variant="destructive" onClick={handleRemove}>
            <Trash2 className="mr-2 h-4 w-4" />
            Remove Field
          </Button>

          {/* Add Field */}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Field
          </Button>

          <AddFieldDialog
            open={addDialogOpen}
            onOpenChange={setAddDialogOpen}
            entityName={selectedEntity}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
