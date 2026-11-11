import { CustomLoggerService } from 'nestjs-backend-common';

import { LlmClient } from '../../llm';
import { TtsTextService } from './tts-text.service';

describe(TtsTextService.name, () => {
  let uut: TtsTextService;
  let llmClient: LlmClient;
  let logger: CustomLoggerService;

  beforeEach(async () => {
    llmClient = {
      normalizeTextForTts: vi
        .fn()
        .mockImplementation(async (text: string) => ({
          normalizeTextForTts: text,
        })),
    } as any;
    logger = {
      log: vi.fn(),
    } as any;

    uut = new TtsTextService(llmClient, logger);
  });

  describe('toSpeechText', () => {
    it.each(['# Some Title', '## Some Title'])(
      'should convert heading (%s) with colon and pause',
      async (markdown) => {
        const result = await uut.toSpeechText(markdown);

        expect(result).toBe('Some Title:\n');
      },
    );

    it('should handle multiple headings with proper spacing', async () => {
      const markdown = '# First\n\n## Second\n\n### Third';

      const result = await uut.toSpeechText(markdown);

      expect(result).toBe('First:\n\nSecond:\n\nThird:\n');
    });

    it('should handle empty heading', async () => {
      const markdown = '#';

      const result = await uut.toSpeechText(markdown);

      expect(result).toBe('\n');
    });

    it.each([
      '**bold** and *italic*',
      '# **bold** and *italic*',
      '~~bold and italic~~',
    ])('should handle inline formatting (%s)', async (markdown) => {
      const result = await uut.toSpeechText(markdown);

      expect(result).toContain('bold and italic');
    });

    it('should convert simple paragraph', async () => {
      const markdown = 'This is a simple paragraph.';

      const result = await uut.toSpeechText(markdown);

      expect(result).toBe('This is a simple paragraph.\n');
    });

    it('should handle multiple paragraphs with proper spacing', async () => {
      const markdown =
        'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';

      const result = await uut.toSpeechText(markdown);

      expect(result).toBe(
        'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.\n',
      );
    });

    it('should collapse more than 2 blank lines to exactly 2', async () => {
      const markdown = 'First paragraph.\n\n\n\n\nSecond paragraph.';
      const result = await uut.toSpeechText(markdown);

      expect(result).toBe('First paragraph.\n\nSecond paragraph.\n');
    });

    it('should wrap inline code with quotes', async () => {
      const markdown = 'Use `console.log()` to debug.';

      const result = await uut.toSpeechText(markdown);

      expect(result).toBe('Use "console.log()" to debug.\n');
    });

    it('should handle mixed inline formatting', async () => {
      const markdown =
        'This has **bold**, *italic*, ~~strikethrough~~, and `code`.';

      const result = await uut.toSpeechText(markdown);

      expect(result).toBe(
        'This has bold, italic, strikethrough, and "code".\n',
      );
    });

    it.each([
      'Visit [link](https://example.com).',
      'Visit [**link**](https://example.com).',
    ])(
      'should extract link text without its URL (%s)',
      async (markdown) => {
        const result = await uut.toSpeechText(markdown);

        expect(result).toBe('Visit link.\n');
      },
    );

    it('should include URL when includeLinkUrls option is true', async () => {
      const markdown = 'Check out [this link](https://example.com).';

      const result = await uut.toSpeechText(markdown, {
        includeLinkUrls: true,
      });

      expect(result).toBe(
        'Check out this link (link: https://example.com).\n',
      );
    });

    it('should handle multiple links', async () => {
      const markdown =
        '[First](https://first.com) and [Second](https://second.com).';

      const result = await uut.toSpeechText(markdown, {
        includeLinkUrls: true,
      });

      expect(result).toBe(
        'First (link: https://first.com) and Second (link: https://second.com).\n',
      );
    });

    it('should convert image alt text', async () => {
      const markdown =
        '![A beautiful sunset](http://example.com/sunset.jpg)';
      const result = await uut.toSpeechText(markdown);

      expect(result).toBe('A beautiful sunset\n');
    });

    it('should use "image" for images without alt text', async () => {
      const markdown = '![](photo.jpg)';
      const result = await uut.toSpeechText(markdown);

      expect(result).toBe('image\n');
    });

    it('should handle multiple images', async () => {
      const markdown =
        '![First image](first.jpg) ![Second image](second.jpg)';
      const result = await uut.toSpeechText(markdown);

      expect(result).toBe('First image Second image\n');
    });

    it('should convert unordered list with bullet points', async () => {
      const markdown = '- First item\n- Second item\n- Third item';

      const result = await uut.toSpeechText(markdown);

      expect(result).toBe(
        '• First item\n• Second item\n• Third item\n',
      );
    });

    it('should convert ordered list with numbers', async () => {
      const markdown = '1. First item\n2. Second item\n3. Third item';

      const result = await uut.toSpeechText(markdown);

      expect(result).toBe(
        '1. First item\n2. Second item\n3. Third item\n',
      );
    });

    it('should handle nested lists', async () => {
      const markdown =
        '- Item 1\n  - Nested 1.1\n  - Nested 1.2\n- Item 2';

      const result = await uut.toSpeechText(markdown);

      expect(result).toBe(
        '• Item 1\n• Nested 1.1\n• Nested 1.2\n\n• Item 2\n',
      );
    });

    it('should handle ordered list with nested unordered list', async () => {
      const markdown = '1. First\n   - Sub A\n   - Sub B\n2. Second';

      const result = await uut.toSpeechText(markdown);

      expect(result).toBe(
        '1. First\n• Sub A\n• Sub B\n\n2. Second\n',
      );
    });

    it('should handle list items with inline formatting', async () => {
      const markdown =
        '- **Bold** item\n- *Italic* item\n- `Code` item';

      const result = await uut.toSpeechText(markdown);

      expect(result).toBe(
        '• Bold item\n• Italic item\n• "Code" item\n',
      );
    });

    it('should maintain correct numbering in ordered lists', async () => {
      const markdown = '1. First\n1. Second\n1. Third';

      const result = await uut.toSpeechText(markdown);

      expect(result).toBe('1. First\n2. Second\n3. Third\n');
    });

    it('should convert blockquote with Quote prefix', async () => {
      const markdown = '> This is a quote.';

      const result = await uut.toSpeechText(markdown);

      expect(result).toBe('Quote: This is a quote.\n');
    });

    it('should handle multi-line blockquote', async () => {
      const markdown = '> First line.\n> Second line.\n> Third line.';

      const result = await uut.toSpeechText(markdown);

      expect(result).toBe(
        'Quote: First line.\nSecond line.\nThird line.\n',
      );
    });

    it('should handle blockquote with inline formatting', async () => {
      const markdown = '> This is **bold** and *italic*.';

      const result = await uut.toSpeechText(markdown);

      expect(result).toBe('Quote: This is bold and italic.\n');
    });

    it('should handle multiple separate blockquotes', async () => {
      const markdown = '> First quote.\n\n> Second quote.';

      const result = await uut.toSpeechText(markdown);

      expect(result).toBe(
        'Quote: First quote.\n\nQuote: Second quote.\n',
      );
    });

    it.each([
      '```\nconst x = 42;\n```',
      '```javascript\nconst x = 42;\n```',
    ])(
      'should convert code block with Code prefix',
      async (markdown) => {
        const result = await uut.toSpeechText(markdown);

        expect(result).toBe('Code: const x = 42;\n');
      },
    );

    it.each([
      '```\nline 1   \nline 2\t\t\nline 3\n```',
      '```\nline 1\nline 2\nline 3\n```',
    ])('should sanitize breaks in code blocks', async (markdown) => {
      const result = await uut.toSpeechText(markdown);

      expect(result).toBe('Code: line 1\nline 2\nline 3\n');
    });

    it('should handle indented code blocks', async () => {
      const markdown = '    const x = 42;\n    const y = 100;';

      const result = await uut.toSpeechText(markdown);

      expect(result).toBe('Code: const x = 42;\nconst y = 100;\n');
    });

    it.each([
      'Before\n\n***\n\nAfter',
      'Before\n\n---\n\nAfter',
      'Before\n\n___\n\nAfter',
    ])(
      'should handle horizontal rule as pause (%j)',
      async (markdown) => {
        const result = await uut.toSpeechText(markdown);

        expect(result).toBe('Before\n\nAfter\n');
      },
    );

    describe('complex markdown', () => {
      it('should handle document with mixed elements', async () => {
        const markdown = `# Chapter 1

This is the introduction paragraph with **bold** and *italic* text.

## Section 1.1

Here's a list:
- Item 1
- Item 2
- Item 3

> This is an important quote.

And some code:
\`\`\`
const x = 42;
\`\`\`

Visit [our website](https://example.com) for more.`;

        const result = await uut.toSpeechText(markdown);

        expect(result).toContain('Chapter 1:');
        expect(result).toContain(
          'This is the introduction paragraph with bold and italic text.',
        );
        expect(result).toContain('Section 1.1:');
        expect(result).toContain('• Item 1');
        expect(result).toContain(
          'Quote: This is an important quote.',
        );
        expect(result).toContain('Code: const x = 42;');
        expect(result).toContain('Visit our website for more.');
      });

      it('should handle nested complex structures', async () => {
        const markdown = `# Main Title

1. First item with **bold**
   - Nested item A
   - Nested item B with \`code\`
2. Second item with [link](https://example.com)

> Quote with *emphasis* and ~~strikethrough~~.`;

        const result = await uut.toSpeechText(markdown);

        expect(result).toContain('Main Title:');
        expect(result).toContain('1. First item with bold');
        expect(result).toContain('• Nested item A');
        expect(result).toContain('• Nested item B with "code"');
        expect(result).toContain('2. Second item with link');
        expect(result).toContain(
          'Quote: Quote with emphasis and strikethrough.',
        );
      });

      it('should strip trailing whitespace before newlines', async () => {
        const markdown =
          'Line with trailing spaces  \nAnother line  \nThird line';

        const result = await uut.toSpeechText(markdown);

        // Markdown treats double space + newline as hard break, which becomes <br> in HTML. The service renders it differently - it's actually a single paragraph with hard breaks
        expect(result).not.toMatch(/[ \t]+\n/);
      });

      it('should always end with single newline', async () => {
        const markdown = 'Simple text';

        const result = await uut.toSpeechText(markdown);

        expect(result).toMatch(/\n$/);
        expect(result).not.toMatch(/\n\n$/);
      });

      it('should handle empty markdown', async () => {
        const markdown = '';

        const result = await uut.toSpeechText(markdown);

        expect(result).toBe('\n');
      });

      it('should handle markdown with only whitespace', async () => {
        const markdown = '   \n\n   \n\n   ';

        const result = await uut.toSpeechText(markdown);

        expect(result).toBe('\n');
      });
    });

    describe('GFM (GitHub Flavored Markdown) features', () => {
      it('should handle tables (basic rendering)', async () => {
        const markdown = `| Column 1 | Column 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |`;

        const result = await uut.toSpeechText(markdown);

        // Tables are NOT explicitly handled by the service, so they render as empty. This is expected behavior - the service focuses on narrative content
        expect(result).toBe('\n');
      });

      it('should handle task lists', async () => {
        const markdown = `- [x] Completed task
- [ ] Incomplete task
- [x] Another completed task`;

        const result = await uut.toSpeechText(markdown);

        expect(result).toContain('• Completed task');
        expect(result).toContain('• Incomplete task');
        expect(result).toContain('• Another completed task');
      });

      it('should handle autolinks', async () => {
        const markdown = 'Visit https://example.com for more info.';
        const result = await uut.toSpeechText(markdown);

        expect(result).toContain('https://example.com');
      });
    });

    describe('edge cases', () => {
      it('should handle deeply nested structures', async () => {
        const markdown = `- Level 1
  - Level 2
    - Level 3
      - Level 4`;

        const result = await uut.toSpeechText(markdown);

        expect(result).toContain('• Level 1');
        expect(result).toContain('• Level 2');
        expect(result).toContain('• Level 3');
        expect(result).toContain('• Level 4');
      });

      it('should handle special characters in text', async () => {
        const markdown =
          'Text with special chars: & < > " \' @ # $ % ^';

        const result = await uut.toSpeechText(markdown);

        expect(result).toBe(
          'Text with special chars: & < > " \' @ # $ % ^\n',
        );
      });

      it('should handle unicode characters', async () => {
        const markdown = 'Text with unicode: 你好 مرحبا 🎉 ñ é ü';

        const result = await uut.toSpeechText(markdown);

        expect(result).toBe(
          'Text with unicode: 你好 مرحبا 🎉 ñ é ü\n',
        );
      });

      it('should handle escaped markdown characters', async () => {
        const markdown = 'Escaped \\*asterisks\\* and \\[brackets\\]';

        const result = await uut.toSpeechText(markdown);

        expect(result).toBe('Escaped *asterisks* and [brackets]\n');
      });

      it('should handle very long paragraphs', async () => {
        const longText = 'Lorem ipsum '.repeat(100).trim();
        const markdown = longText;

        const result = await uut.toSpeechText(markdown);

        expect(result).toContain('Lorem ipsum');
        expect(result.length).toBeGreaterThan(1000);
      });
    });
  });

  describe('normalizeTtsText', () => {
    it('should forward the safe-pass result to the LLM client', async () => {
      await uut.normalizeTtsText('ahhh~ CRAAAACK [Boost]');

      expect(llmClient.normalizeTextForTts).toHaveBeenCalledWith(
        'ahh craack , Boost,',
      );
    });

    it('should return the value produced by the LLM', async () => {
      llmClient.normalizeTextForTts = vi.fn().mockResolvedValue({
        normalizeTextForTts: 'polished output',
      });

      const result = await uut.normalizeTtsText('raw input');

      expect(result).toBe('polished output');
    });

    it('should propagate errors from the LLM client', async () => {
      llmClient.normalizeTextForTts = vi
        .fn()
        .mockRejectedValue(new Error('Beatrice down'));

      await expect(uut.normalizeTtsText('anything')).rejects.toThrow(
        'Beatrice down',
      );
    });

    it('should log after a successful LLM call', async () => {
      await uut.normalizeTtsText('hello');

      expect(logger.log).toHaveBeenCalledWith(
        'LLM TTS normalization succeeded',
        { context: TtsTextService.name },
      );
    });

    describe('safe-pass transformations', () => {
      it.each([
        ['ahhh~', 'ahh'],
        ['oooh~!', 'ooh!'],
        ['ahhh~ yes', 'ahh yes'],
      ])(
        'should strip elongation tildes (%s → %s)',
        async (input, expected) => {
          await uut.normalizeTtsText(input);

          expect(llmClient.normalizeTextForTts).toHaveBeenCalledWith(
            expected,
          );
        },
      );

      it('should preserve tildes NOT used as elongation markers', async () => {
        await uut.normalizeTtsText('path~name');

        expect(llmClient.normalizeTextForTts).toHaveBeenCalledWith(
          'path~name',
        );
      });

      it.each([
        ['ahhhhhhhh', 'ahh'],
        ['CRAAAACK', 'craack'],
        ['WHOOOOOSH!', 'whoosh!'],
        ['BOOOOOOM', 'boom'],
        ['SLAAAAAAM', 'slaam'],
        ['whattttt', 'whatt'],
      ])(
        'should collapse repeated letters (%s → %s)',
        async (input, expected) => {
          await uut.normalizeTtsText(input);

          expect(llmClient.normalizeTextForTts).toHaveBeenCalledWith(
            expected,
          );
        },
      );

      it.each(['book', 'feel'])(
        'should NOT collapse normal double letters (%s)',
        async (input) => {
          await uut.normalizeTtsText(input);

          expect(llmClient.normalizeTextForTts).toHaveBeenCalledWith(
            input,
          );
        },
      );

      it.each([
        ['ahhh......', 'ahh...'],
        ['hmm........', 'hmm...'],
      ])(
        'should collapse excessive dots (%s → %s)',
        async (input, expected) => {
          await uut.normalizeTtsText(input);

          expect(llmClient.normalizeTextForTts).toHaveBeenCalledWith(
            expected,
          );
        },
      );

      it('should preserve "..." as-is', async () => {
        await uut.normalizeTtsText('wait...');

        expect(llmClient.normalizeTextForTts).toHaveBeenCalledWith(
          'wait...',
        );
      });

      it.each([
        ['CRACK', 'crack'],
        ['BOOM!', 'boom!'],
        ['THE BIG BOOM', 'the big boom'],
        ['He heard a CRACK and ran', 'He heard a crack and ran'],
      ])(
        'should lowercase ALL CAPS words (%s → %s)',
        async (input, expected) => {
          await uut.normalizeTtsText(input);

          expect(llmClient.normalizeTextForTts).toHaveBeenCalledWith(
            expected,
          );
        },
      );

      it.each(['I am fine', 'Hello'])(
        'should NOT lowercase non-all-caps words (%s)',
        async (input) => {
          await uut.normalizeTtsText(input);

          expect(llmClient.normalizeTextForTts).toHaveBeenCalledWith(
            input,
          );
        },
      );

      it.each([
        ['She activated [Boost]', 'She activated , Boost,'],
        ['He cast 【Fireball】', 'He cast , Fireball,'],
        ['[DIVINE SHIELD]', ', divine shield,'],
        ['Used [Boost] and [Shield]', 'Used , Boost, and , Shield,'],
      ])(
        'should replace bracketed skill markers (%s → %s)',
        async (input, expected) => {
          await uut.normalizeTtsText(input);

          expect(llmClient.normalizeTextForTts).toHaveBeenCalledWith(
            expected,
          );
        },
      );

      it('should apply multiple safe-pass transformations together', async () => {
        await uut.normalizeTtsText('CRAAAACCKKKK!');

        expect(llmClient.normalizeTextForTts).toHaveBeenCalledWith(
          'craacckk!',
        );
      });
    });
  });
});
