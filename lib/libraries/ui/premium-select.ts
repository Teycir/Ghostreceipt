import {
  Children,
  isValidElement,
  type ChangeEvent,
  type ReactElement,
  type ReactNode,
} from 'react';

export interface PremiumSelectOption {
  disabled: boolean;
  label: string;
  value: string;
}

export const PREMIUM_SELECT_CLASSES = {
  trigger:
    'flex h-11 w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm ' +
    'bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03)_40%,rgba(30,82,190,0.20))] ' +
    'text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_12px_30px_rgba(8,20,61,0.42)] ' +
    'backdrop-blur-xl transition-all duration-200 focus-visible:outline-none ' +
    'focus-visible:ring-2 focus-visible:ring-blue-300/70 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-40',
  panel:
    'absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-white/16 ' +
    'bg-[linear-gradient(160deg,rgba(8,12,30,0.96),rgba(5,9,24,0.94)_48%,rgba(15,33,84,0.90))] ' +
    'shadow-[0_22px_54px_rgba(2,6,22,0.86),inset_0_1px_0_rgba(255,255,255,0.10)] backdrop-blur-2xl',
  optionBase: 'flex w-full items-center px-3 py-2.5 text-left text-sm transition-colors duration-150',
  optionDisabled: 'cursor-not-allowed text-white/30',
  optionEnabled: 'text-white/92',
  optionHighlighted:
    'bg-[linear-gradient(120deg,rgba(66,110,212,0.70),rgba(44,82,178,0.72))]',
  optionHover:
    'bg-transparent hover:bg-[linear-gradient(120deg,rgba(54,94,196,0.54),rgba(30,62,149,0.58))]',
  optionSelected: 'font-semibold text-white',
} as const;

export function extractPremiumSelectOptions(children: ReactNode): PremiumSelectOption[] {
  return Children.toArray(children)
    .filter(
      (
        child
      ): child is ReactElement<{
        children?: ReactNode;
        disabled?: boolean;
        value?: number | string;
      }> => isValidElement(child) && child.type === 'option'
    )
    .map((child) => ({
      disabled: Boolean(child.props.disabled),
      label: String(child.props.children ?? ''),
      value: String(child.props.value ?? ''),
    }));
}

export function getFirstEnabledPremiumSelectIndex(options: PremiumSelectOption[]): number {
  return options.findIndex((item) => !item.disabled);
}

export function createSelectLikeChangeEvent(
  name: string | undefined,
  value: string
): ChangeEvent<HTMLSelectElement> {
  return {
    currentTarget: { name, value },
    target: { name, value },
  } as unknown as ChangeEvent<HTMLSelectElement>;
}
