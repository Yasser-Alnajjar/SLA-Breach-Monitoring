"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@components/ui/tooltip";
import {
  useComboboxAnchor,
  Combobox,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxClear,
  ComboboxTrigger,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
} from "@components/ui/combobox";

export interface ComboboxOption {
  label: string;
  value: string;
}

interface MultiComboboxProps {
  options: Array<ComboboxOption>;
  selected: Array<string>;
  onChange: (selected: Array<string>) => void;
  onCreateOption?: (inputValue: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  allSelectedText?: string;
  className?: string;
  disabled?: boolean;
  maxSelected?: number;
  creatable?: boolean;
  createText?: string;
}

const MAX_VISIBLE = 200;

const CREATE_OPTION_VALUE = "__create__";

export function MultiCombobox({
  options,
  selected,
  onChange,
  onCreateOption,
  placeholder = "Select items...",
  searchPlaceholder = "Search...",
  emptyText = "No items found.",
  allSelectedText = "All items selected.",
  className,
  disabled = false,
  maxSelected,
  creatable = false,
  createText = "Create",
}: MultiComboboxProps) {
  const anchor = useComboboxAnchor();
  const [inputValue, setInputValue] = React.useState("");

  // Set lookup keeps the two passes below O(n) instead of O(n*m) —
  // matters once `options` reaches catalog size and re-filters per keystroke.
  const selectedSet = React.useMemo(() => new Set(selected), [selected]);

  const selectedOptions = React.useMemo(
    () => options.filter((o) => selectedSet.has(o.value)),
    [options, selectedSet],
  );

  // Selected values are excluded from the list; the chips are the only
  // representation of a selection, and the only way to remove one.
  const allMatchingOptions = React.useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    return options.filter(
      (o) =>
        !selectedSet.has(o.value) &&
        (!query || o.label.toLowerCase().includes(query)),
    );
  }, [options, inputValue, selectedSet]);

  const overflow = Math.max(0, allMatchingOptions.length - MAX_VISIBLE);
  const visibleOptions = React.useMemo(
    () => allMatchingOptions.slice(0, MAX_VISIBLE),
    [allMatchingOptions],
  );

  const canCreateOption = React.useMemo(() => {
    if (!creatable || !inputValue.trim()) return false;
    const lower = inputValue.toLowerCase().trim();
    return !options.some(
      (o) => o.label.toLowerCase() === lower || o.value.toLowerCase() === lower,
    );
  }, [creatable, inputValue, options]);

  // Distinguishes an exhausted catalog from a query with no hits.
  const allSelected =
    allMatchingOptions.length === 0 &&
    selectedOptions.length === options.length;

  const handleCreateOption = React.useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;

      const newValue = trimmed.toLowerCase().replace(/\s+/g, "-");
      if (!selectedSet.has(newValue)) {
        if (maxSelected && selected.length >= maxSelected) return;
        onChange([...selected, newValue]);
      }
      onCreateOption?.(trimmed);
      setInputValue("");
    },
    [selected, selectedSet, onChange, onCreateOption, maxSelected],
  );

  const handleValueChange = (value: Array<ComboboxOption>) => {
    if (value.some((o) => o.value === CREATE_OPTION_VALUE)) {
      handleCreateOption(inputValue);
      return;
    }

    const next = value.map((o) => o.value);
    if (maxSelected && next.length > maxSelected) return;
    onChange(next);
  };

  return (
    <Combobox
      multiple
      value={selectedOptions}
      onValueChange={handleValueChange}
      inputValue={inputValue}
      onInputValueChange={setInputValue}
      disabled={disabled}
      filter={null}
      autoHighlight
    >
      <ComboboxChips
        ref={anchor}
        className={cn("w-full max-w-full", className)}
      >
        {selectedOptions.map((option) => (
          <ComboboxChip key={option.value} className="max-w-44">
            <Tooltip>
              <TooltipTrigger className="min-w-0 truncate">
                {option.label}
              </TooltipTrigger>
              <TooltipContent>{option.label}</TooltipContent>
            </Tooltip>
          </ComboboxChip>
        ))}
        <ComboboxChipsInput
          placeholder={
            selectedOptions.length === 0 ? placeholder : searchPlaceholder
          }
          onKeyDown={(event) => {
            if (event.key !== "Enter" || !canCreateOption) return;

            event.preventDefault();
            event.stopPropagation();

            handleCreateOption(inputValue);
          }}
        />
        <ComboboxClear />
        <ComboboxTrigger />
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxList>
          {canCreateOption && (
            <ComboboxItem
              value={{ label: inputValue.trim(), value: CREATE_OPTION_VALUE }}
            >
              <span className="me-1">+</span>
              {createText} &ldquo;{inputValue.trim()}&rdquo;
            </ComboboxItem>
          )}
          {visibleOptions.length === 0 && !canCreateOption ? (
            <div className="flex w-full justify-center py-2 text-center text-xs/relaxed text-muted-foreground">
              {allSelected ? allSelectedText : emptyText}
            </div>
          ) : (
            <>
              {visibleOptions.map((option) =>
                option.label.length > 150 ? (
                  <Tooltip key={option.value}>
                    <TooltipTrigger asChild>
                      <ComboboxItem value={option}>
                        <span className="min-w-0 flex-1 truncate">
                          {option.label}
                        </span>
                      </ComboboxItem>
                    </TooltipTrigger>
                    <TooltipContent>{option.label}</TooltipContent>
                  </Tooltip>
                ) : (
                  <ComboboxItem key={option.value} value={option}>
                    <span className="min-w-0 flex-1 truncate">
                      {option.label}
                    </span>
                  </ComboboxItem>
                ),
              )}
              {overflow > 0 && (
                <div className="border-t px-3 py-2 text-xs text-muted-foreground">
                  Showing {visibleOptions.length} of {allMatchingOptions.length}
                  . Type to refine.
                </div>
              )}
            </>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
