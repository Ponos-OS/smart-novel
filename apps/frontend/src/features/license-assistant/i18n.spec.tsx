import { render, screen } from '@testing-library/react';

import {
  format,
  LicenseAssistantMessagesProvider,
  useMessages,
} from './i18n';
import { enMessages, type Messages } from './messages';

function Probe() {
  const t = useMessages();

  return <p>{t('start.customize', { name: 'CC BY 4.0' })}</p>;
}

describe('license assistant messages', () => {
  describe(format.name, () => {
    it.each([
      [
        'Customize {name}',
        { name: 'CC BY 4.0' },
        'Customize CC BY 4.0',
      ],
      ['{count} / {max}', { count: 12, max: 4000 }, '12 / 4000'],
      ['Saved {date}', {}, 'Saved {date}'],
      ['No placeholders', { name: 'unused' }, 'No placeholders'],
    ])('should fill %j', (template, values, expected) => {
      const result = format(template, values);

      expect(result).toBe(expected);
    });
  });

  it('should speak English without a provider', () => {
    render(<Probe />);

    expect(screen.getByText('Customize CC BY 4.0')).toBeVisible();
  });

  it('should speak the language of the provider', () => {
    const messages: Messages = {
      ...enMessages,
      'start.customize': 'Personnaliser {name}',
    };

    render(
      <LicenseAssistantMessagesProvider messages={messages}>
        <Probe />
      </LicenseAssistantMessagesProvider>,
    );

    expect(screen.getByText('Personnaliser CC BY 4.0')).toBeVisible();
  });

  it('should have no empty message', () => {
    const empty = Object.entries(enMessages).filter(
      ([, message]) => !message.trim(),
    );

    expect(empty).toEqual([]);
  });
});
