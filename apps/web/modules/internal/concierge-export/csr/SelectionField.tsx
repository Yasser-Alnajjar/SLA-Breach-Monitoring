"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SelectionFieldOption } from "@/lib/types/concierge-export";

interface SelectionFieldProps {
  id: string;
  label: string;
  placeholder: string;
  value: string | null;
  options: SelectionFieldOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
}

/**
 * A labelled Select that turns read-only when there's exactly one option:
 * the value is already decided, so it's shown rather than offered.
 */
export function SelectionField({ id, label, placeholder, value, options, disabled, onChange }: SelectionFieldProps) {
  const readOnly = options.length === 1 && value === options[0]!.value;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value ?? ""} onValueChange={onChange} disabled={disabled || readOnly}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
