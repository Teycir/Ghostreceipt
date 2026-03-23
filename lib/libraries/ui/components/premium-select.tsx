"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  PREMIUM_SELECT_CLASSES,
  createSelectLikeChangeEvent,
  extractPremiumSelectOptions,
  getFirstEnabledPremiumSelectIndex,
} from '../premium-select';

export interface PremiumSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label?: string;
  error?: string | undefined;
  children?: ReactNode;
}

export function PremiumSelect({
  label,
  error,
  className = "",
  children,
  value,
  defaultValue,
  onChange,
  name,
  id,
  disabled = false,
}: PremiumSelectProps): React.JSX.Element {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const options = useMemo(() => extractPremiumSelectOptions(children), [children]);
  const controlled = value !== undefined;
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [internalValue, setInternalValue] = useState<string>(() => {
    if (defaultValue !== undefined) {
      return String(defaultValue);
    }
    return options[0]?.value ?? "";
  });
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selectedValue = controlled ? String(value ?? "") : internalValue;
  const selectedIndex = options.findIndex((option) => option.value === selectedValue);
  const selectedOption = options[selectedIndex] ?? options[0];

  useEffect(() => {
    if (!open) return;

    const handleOutside = (event: MouseEvent): void => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const selectValue = (nextValue: string): void => {
    if (!controlled) {
      setInternalValue(nextValue);
    }

    if (onChange) {
      onChange(createSelectLikeChangeEvent(name, nextValue));
    }

    setOpen(false);
  };

  const moveHighlight = (direction: 1 | -1): void => {
    if (options.length === 0) return;

    let index = highlightedIndex;
    if (index < 0) {
      index = selectedIndex >= 0 ? selectedIndex : getFirstEnabledPremiumSelectIndex(options);
    }

    for (let i = 0; i < options.length; i += 1) {
      index = (index + direction + options.length) % options.length;
      if (!options[index]?.disabled) {
        setHighlightedIndex(index);
        return;
      }
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (disabled) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      moveHighlight(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) setOpen(true);
      moveHighlight(-1);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const highlightedOption = options[highlightedIndex];
      if (open && highlightedOption && !highlightedOption.disabled) {
        selectValue(highlightedOption.value);
      } else {
        setOpen((prev) => !prev);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const fallback =
      selectedIndex >= 0 ? selectedIndex : getFirstEnabledPremiumSelectIndex(options);
    setHighlightedIndex(fallback);
  }, [open, selectedIndex, options]);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-white/70">
          {label}
        </label>
      )}

      <div ref={rootRef} className="relative">
        <button
          id={selectId}
          type="button"
          name={name}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-invalid={Boolean(error)}
          aria-controls={`${selectId}-listbox`}
          onClick={() => setOpen((prev) => !prev)}
          onKeyDown={handleKeyDown}
          className={`
            ${PREMIUM_SELECT_CLASSES.trigger}
            ${error
              ? "border-red-500/50"
              : "border-white/25 hover:border-blue-200/35"
            }
            ${open ? "border-blue-200/50" : ""}
            ${className}
          `}
        >
          <span className={selectedOption ? "text-white" : "text-white/55"}>
            {selectedOption?.label ?? "Select..."}
          </span>
          <span
            className={`pointer-events-none text-white/75 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M6 9L12 15L18 9"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>

        {open && (
          <ul
            id={`${selectId}-listbox`}
            role="listbox"
            aria-labelledby={selectId}
            className={PREMIUM_SELECT_CLASSES.panel}
          >
            {options.map((option, index) => {
              const selected = option.value === selectedValue;
              const highlighted = index === highlightedIndex;
              return (
                <li key={`${option.value}-${index}`} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={option.disabled}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => selectValue(option.value)}
                    className={`
                      ${PREMIUM_SELECT_CLASSES.optionBase}
                      ${option.disabled
                        ? PREMIUM_SELECT_CLASSES.optionDisabled
                        : PREMIUM_SELECT_CLASSES.optionEnabled
                      }
                      ${highlighted
                        ? PREMIUM_SELECT_CLASSES.optionHighlighted
                        : PREMIUM_SELECT_CLASSES.optionHover
                      }
                      ${selected ? PREMIUM_SELECT_CLASSES.optionSelected : ""}
                    `}
                  >
                    {option.label}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {error && <span className="text-xs text-red-400/90">{error}</span>}
    </div>
  );
}
