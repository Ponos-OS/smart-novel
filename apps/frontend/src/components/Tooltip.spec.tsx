import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('shows its content on hover and closes with Escape', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Delete chapter">
        <button>Delete</button>
      </Tooltip>,
    );

    await user.hover(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Delete chapter',
    );

    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument(),
    );
  });

  it('shows its content when the trigger gets keyboard focus', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Delete chapter">
        <button>Delete</button>
      </Tooltip>,
    );

    await user.tab();

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Delete chapter',
    );
  });

  it('leaves the trigger and its accessible name as they are', () => {
    render(
      <Tooltip content="Delete chapter">
        <button>Delete</button>
      </Tooltip>,
    );

    expect(
      screen.getByRole('button', { name: 'Delete' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
