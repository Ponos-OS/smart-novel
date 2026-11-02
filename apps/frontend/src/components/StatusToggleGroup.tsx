import { ToggleGroup } from 'radix-ui';

interface StatusToggleGroupProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

export function StatusToggleGroup<T extends string>({
  value,
  options,
  onChange,
}: StatusToggleGroupProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      // Pressing the selected item again would leave nothing selected.
      onValueChange={(next) => {
        if (next) {
          onChange(next as T);
        }
      }}
      aria-label="Filter by status"
      className="flex gap-2"
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          className="cursor-pointer rounded-lg border border-gray-600 px-3 py-1.5 text-sm text-gray-300 outline-none transition-colors hover:bg-gray-700 focus-visible:ring-2 focus-visible:ring-blue-500 data-[state=on]:border-blue-500 data-[state=on]:bg-blue-900 data-[state=on]:text-blue-100"
        >
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
