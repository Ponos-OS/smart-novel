import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { ConversationPane } from './ConversationPane';

type Props = Omit<
  Parameters<typeof ConversationPane>[0],
  'composerText' | 'onComposerTextChange'
>;

function Harness(props: Props) {
  const [text, setText] = useState('');

  return (
    <ConversationPane
      {...props}
      composerText={text}
      onComposerTextChange={setText}
    />
  );
}

function renderPane(props: Partial<Props> = {}) {
  const onSend = vi.fn();

  render(
    <Harness
      messages={[]}
      pendingMessage={null}
      isPending={false}
      error={null}
      onSend={onSend}
      {...props}
    />,
  );

  return { onSend };
}

describe(ConversationPane.name, () => {
  it('lists the messages in a live log, each labelled with who wrote it', () => {
    // Act
    renderPane({
      messages: [
        { id: 'a', role: 'user', content: 'Forbid resale.' },
        { id: 'b', role: 'assistant', content: 'I forbade resale.' },
      ],
    });

    // Assert
    const log = screen.getByRole('log', {
      name: 'Conversation with the license assistant',
    });
    const items = screen.getAllByRole('listitem');
    expect(log).toBeInTheDocument();
    expect(items[0]).toHaveTextContent('You');
    expect(items[0]).toHaveTextContent('Forbid resale.');
    expect(items[1]).toHaveTextContent('Assistant');
    expect(items[1]).toHaveTextContent('I forbade resale.');
  });

  it('shows the message being sent, and locks the composer until the answer comes', () => {
    // Act
    renderPane({ pendingMessage: 'Forbid resale.', isPending: true });

    // Assert
    expect(screen.getByRole('listitem')).toHaveTextContent(
      'You (sending...)',
    );
    expect(screen.getByLabelText('Your message')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Sending...' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('region', { name: 'Conversation' }),
    ).toHaveAttribute('aria-busy', 'true');
  });

  it('announces an error, with the reference to quote to support', () => {
    // Act
    renderPane({
      error: {
        kind: 'unavailable',
        messageKey: 'error.unavailable',
        requestId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        retryable: true,
      },
    });

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The assistant is not available right now. Your conversation and draft are kept; try again later. (reference: f47ac10b-58cc-4372-a567-0e02b2c3d479)',
    );
  });

  describe('composer', () => {
    it('sends the trimmed message with Enter and clears the box once it was sent', async () => {
      // Arrange
      const user = userEvent.setup();
      const { onSend } = renderPane();
      onSend.mockImplementation((_message, onSent) => onSent());
      const box = screen.getByLabelText('Your message');

      // Act
      await user.type(box, '  Forbid resale.  {Enter}');

      // Assert
      expect(onSend).toHaveBeenCalledExactlyOnceWith(
        'Forbid resale.',
        expect.any(Function),
      );
      expect(box).toHaveValue('');
    });

    it('keeps what the author wrote when the send fails', async () => {
      // Arrange
      const user = userEvent.setup();
      const { onSend } = renderPane();
      const box = screen.getByLabelText('Your message');

      // Act
      await user.type(box, 'Forbid resale.');
      await user.click(screen.getByRole('button', { name: 'Send' }));

      // Assert
      expect(onSend).toHaveBeenCalledOnce();
      expect(box).toHaveValue('Forbid resale.');
    });

    it('adds a line with Shift+Enter instead of sending', async () => {
      // Arrange
      const user = userEvent.setup();
      const { onSend } = renderPane();
      const box = screen.getByLabelText('Your message');

      // Act
      await user.type(box, 'One{Shift>}{Enter}{/Shift}Two');

      // Assert
      expect(onSend).not.toHaveBeenCalled();
      expect(box).toHaveValue('One\nTwo');
    });

    it('cannot send an empty message', async () => {
      // Arrange
      const user = userEvent.setup();
      const { onSend } = renderPane();

      // Act
      await user.type(
        screen.getByLabelText('Your message'),
        '   {Enter}',
      );

      // Assert
      expect(
        screen.getByRole('button', { name: 'Send' }),
      ).toBeDisabled();
      expect(onSend).not.toHaveBeenCalled();
    });

    it('refuses a message over the limit and says so without relying on colour', () => {
      // Arrange
      const { onSend } = renderPane();
      const box = screen.getByLabelText('Your message');

      // Act
      fireEvent.change(box, { target: { value: 'a'.repeat(2001) } });
      fireEvent.keyDown(box, { key: 'Enter' });

      // Assert
      expect(box).toHaveAttribute('aria-invalid', 'true');
      expect(
        screen.getByText(/2001 \/ 2000 - too long/),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Send' }),
      ).toBeDisabled();
      expect(onSend).not.toHaveBeenCalled();
    });
  });
});
