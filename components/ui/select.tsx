"use client";

import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label?: string;
  error?: string | undefined;
  children?: ReactNode;
}

interface SelectOption {
  disabled: boolean;
  label: string;
  value: string;
}

function getOptions(children: ReactNode): SelectOption[] {
  return Children.toArray(children)
    .filter(
      (
        child
      ): child is ReactElement<{
        children?: ReactNode;
        disabled?: boolean;
        value?: number | string;
      }> => isValidElement(child) && child.type === "option"
    )
    .map((child) => {
      return {
        disabled: Boolean(child.props.disabled),
        label: String(child.props.children ?? ""),
        value: String(child.props.value ?? ""),
      };
    });
}

function getFirstEnabledIndex(options: SelectOption[]): number {
  return options.findIndex((item) => !item.disabled);
}

export function Select({
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
}: SelectProps): React.JSX.Element {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const options = useMemo(() => getOptions(children), [children]);
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
      const syntheticEvent = {
        currentTarget: { name, value: nextValue },
        target: { name, value: nextValue },
      } as unknown as ChangeEvent<HTMLSelectElement>;
      onChange(syntheticEvent);
    }

    setOpen(false);
  };

  const moveHighlight = (direction: 1 | -1): void => {
    if (options.length === 0) return;

    let index = highlightedIndex;
    if (index < 0) {
      index = selectedIndex >= 0 ? selectedIndex : getFirstEnabledIndex(options);
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
    const fallback = selectedIndex >= 0 ? selectedIndex : getFirstEnabledIndex(options);
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
            flex h-11 w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm
            bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03)_40%,rgba(30,82,190,0.20))]
            text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_12px_30px_rgba(8,20,61,0.42)]
            backdrop-blur-xl
            transition-all duration-200
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70 focus-visible:ring-offset-0
            disabled:cursor-not-allowed disabled:opacity-40
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
            className="
              absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-white/20
              bg-[linear-gradient(165deg,rgba(255,255,255,0.16),rgba(255,255,255,0.04)_38%,rgba(23,57,126,0.36))]
              shadow-[0_16px_40px_rgba(4,10,35,0.65),inset_0_1px_0_rgba(255,255,255,0.18)]
              backdrop-blur-2xl
            "
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
                      flex w-full items-center px-3 py-2.5 text-left text-sm transition-colors duration-150
                      ${option.disabled
                        ? "cursor-not-allowed text-white/30"
                        : "text-white/88"
                      }
                      ${highlighted
                        ? "bg-[linear-gradient(120deg,rgba(120,170,255,0.40),rgba(62,108,208,0.34))]"
                        : "bg-transparent hover:bg-[linear-gradient(120deg,rgba(120,170,255,0.22),rgba(62,108,208,0.22))]"
                      }
                      ${selected ? "font-semibold text-white" : ""}
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
