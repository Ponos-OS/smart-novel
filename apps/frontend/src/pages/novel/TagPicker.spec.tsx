import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { TagPicker } from './TagPicker';
import { useTagSuggestions } from './use-tag-suggestions';

vi.mock('./use-tag-suggestions', () => ({
  useTagSuggestions: vi.fn(),
}));
vi.mock('../../hooks/useDebouncedValue', () => ({
  useDebouncedValue: <T,>(value: T) => value,
}));

function mockSuggestions(
  overrides: Partial<ReturnType<typeof useTagSuggestions>> = {},
) {
  const loadMore = vi.fn();

  vi.mocked(useTagSuggestions).mockReturnValue({
    names: ['adventure', 'fantasy', 'mystery'],
    isLoading: false,
    isError: false,
    hasMore: false,
    isLoadingMore: false,
    loadMore,
    ...overrides,
  });

  return { loadMore };
}

function renderPicker(
  props: {
    initial?: string[];
    onRequestTag?: (name: string) => void;
  } = {},
) {
  const onChange = vi.fn();
  const onSubmit = vi.fn((event: React.FormEvent) =>
    event.preventDefault(),
  );

  function Harness() {
    const [value, setValue] = useState(props.initial ?? []);

    return (
      <form onSubmit={onSubmit}>
        <TagPicker
          value={value}
          onChange={(next) => {
            onChange(next);
            setValue(next);
          }}
          onRequestTag={props.onRequestTag}
        />
      </form>
    );
  }

  render(<Harness />);

  return { onChange, onSubmit, user: userEvent.setup() };
}

describe('TagPicker', () => {
  beforeEach(() => {
    vi.mocked(useTagSuggestions).mockReset();
    mockSuggestions();
  });

  it('only asks the API for suggestions once the field is focused', async () => {
    const { user } = renderPicker();

    expect(useTagSuggestions).toHaveBeenLastCalledWith('', false);

    await user.click(screen.getByRole('combobox', { name: 'Tags' }));

    expect(useTagSuggestions).toHaveBeenLastCalledWith('', true);
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('searches with the typed text, trimmed and lower-cased', async () => {
    const { user } = renderPicker();

    await user.type(
      screen.getByRole('combobox', { name: 'Tags' }),
      '  FAN ',
    );

    expect(useTagSuggestions).toHaveBeenLastCalledWith('fan', true);
  });

  it('does not suggest a tag that is already selected', async () => {
    const { user } = renderPicker({ initial: ['fantasy'] });

    await user.click(screen.getByRole('combobox', { name: 'Tags' }));

    expect(
      screen
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['adventure', 'mystery']);
  });

  it('adds the clicked suggestion as a chip and clears the text', async () => {
    const { user, onChange } = renderPicker();
    const input = screen.getByRole('combobox', {
      name: 'Tags',
    });
    await user.type(input, 'fan');

    await user.click(screen.getByRole('option', { name: 'fantasy' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(['fantasy']);
    expect(input).toHaveValue('');
    expect(
      screen.getByRole('list', { name: 'Selected tags' }),
    ).toHaveTextContent('fantasy');
  });

  it('removes a chip with its button', async () => {
    const { user, onChange } = renderPicker({
      initial: ['fantasy', 'mystery'],
    });

    await user.click(
      screen.getByRole('button', { name: 'Remove fantasy' }),
    );

    expect(onChange).toHaveBeenCalledExactlyOnceWith(['mystery']);
  });

  describe('keyboard', () => {
    it('moves with the arrows, picks with Enter and never submits the form', async () => {
      const { user, onChange, onSubmit } = renderPicker();
      await user.click(
        screen.getByRole('combobox', { name: 'Tags' }),
      );

      await user.keyboard('{ArrowDown}{ArrowDown}');
      expect(
        screen.getByRole('option', { name: 'mystery' }),
      ).toHaveAttribute('aria-selected', 'true');
      await user.keyboard('{ArrowUp}{Enter}');

      expect(onChange).toHaveBeenCalledExactlyOnceWith(['fantasy']);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('does not submit the form on Enter when nothing is highlighted', async () => {
      mockSuggestions({ names: [] });
      const { user, onSubmit } = renderPicker();

      await user.type(
        screen.getByRole('combobox', { name: 'Tags' }),
        'zzz{Enter}',
      );

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('closes the list with Escape', async () => {
      const { user } = renderPicker();
      await user.click(
        screen.getByRole('combobox', { name: 'Tags' }),
      );

      await user.keyboard('{Escape}');

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('removes the last chip with Backspace on an empty field only', async () => {
      const { user, onChange } = renderPicker({
        initial: ['fantasy', 'mystery'],
      });
      const input = screen.getByRole('combobox', {
        name: 'Tags',
      });

      await user.type(input, 'a{Backspace}');
      expect(onChange).not.toHaveBeenCalled();
      await user.keyboard('{Backspace}');

      expect(onChange).toHaveBeenCalledExactlyOnceWith(['fantasy']);
    });
  });

  describe('when nothing matches', () => {
    beforeEach(() => mockSuggestions({ names: [] }));

    it('offers to request the typed tag', async () => {
      const onRequestTag = vi.fn();
      const { user } = renderPicker({ onRequestTag });
      await user.type(
        screen.getByRole('combobox', { name: 'Tags' }),
        ' Slice of Life ',
      );

      await user.click(
        screen.getByRole('button', { name: 'Request tag' }),
      );

      expect(onRequestTag).toHaveBeenCalledExactlyOnceWith(
        'Slice of Life',
      );
    });

    it('does not offer it when the form cannot request tags', async () => {
      const { user } = renderPicker();

      await user.type(
        screen.getByRole('combobox', { name: 'Tags' }),
        'zzz',
      );

      expect(screen.getByText(/No tag matches/)).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Request tag' }),
      ).not.toBeInTheDocument();
    });

    it('does not claim "no match" before anything was typed', async () => {
      const { user } = renderPicker({ onRequestTag: vi.fn() });

      await user.click(
        screen.getByRole('combobox', { name: 'Tags' }),
      );

      expect(
        screen.queryByText(/No tag matches/),
      ).not.toBeInTheDocument();
    });
  });

  it('loads more suggestions on demand and hides the action when there are none left', async () => {
    const { loadMore } = mockSuggestions({ hasMore: true });
    const { user } = renderPicker();
    await user.click(screen.getByRole('combobox', { name: 'Tags' }));

    await user.click(screen.getByRole('button', { name: 'More' }));

    expect(loadMore).toHaveBeenCalledOnce();
  });

  it('shows a loading and an error state', async () => {
    mockSuggestions({ names: [], isLoading: true });
    const { user } = renderPicker();
    await user.click(screen.getByRole('combobox', { name: 'Tags' }));
    expect(screen.getByRole('status')).toHaveTextContent('Searching');

    mockSuggestions({ names: [], isError: true });
    await user.type(
      screen.getByRole('combobox', { name: 'Tags' }),
      'f',
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load',
    );
  });
});
