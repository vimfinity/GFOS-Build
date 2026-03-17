import type { ComboboxOption } from '@/components/ui/combobox-field';

export interface NodeScriptChoice {
  name: string;
  command: string;
}

export function getNodeScriptChoices(scripts: Record<string, string> | undefined): NodeScriptChoice[] {
  return Object.entries(scripts ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, command]) => ({ name, command }));
}

export function getNodeScriptComboboxOptions(
  scripts: Record<string, string> | undefined,
): ComboboxOption[] {
  return getNodeScriptChoices(scripts).map((script) => ({
    value: script.name,
    label: script.name,
    description: script.command,
    keywords: [script.name, script.command],
  }));
}
