import type {
  Blockquote,
  Code,
  Heading,
  List,
  ListItem,
  Paragraph,
  PhrasingContent,
  Root,
  RootContent,
  ThematicBreak,
} from 'mdast';

import { Injectable } from '@nestjs/common';
import { isArray, isNotEmptyObject, isObject } from 'class-validator';
import { CustomLoggerService, isNil } from 'nestjs-backend-common';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { SKIP, visit } from 'unist-util-visit';

import { LlmClient } from '../../llm';

interface TtsOptions {
  /** @description when true, append the URL after link text, e.g., "(link: https://...)" */
  includeLinkUrls?: boolean;
}

@Injectable()
export class TtsTextService {
  constructor(
    private readonly llmClient: LlmClient,
    private readonly logger: CustomLoggerService,
  ) {}

  async toSpeechText(
    markdown: string,
    options: TtsOptions = {},
  ): Promise<string> {
    const root = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .parse(markdown) as Root;
    const serializer = new TtsSerializer(options);

    return serializer.walk(root).finish();
  }

  /**
   * @description Normalization pipeline:
   *
   * Applies a deterministic structural regex pass first (safe transforms that cannot change meaning), then delegates the remaining semantic normalization to Beatrice.
   */
  async normalizeTtsText(text: string): Promise<string> {
    const safeResult = this.regexSafePass(text);

    const { normalizeTextForTts } =
      await this.llmClient.normalizeTextForTts(safeResult);

    this.logger.log('LLM TTS normalization succeeded', {
      context: TtsTextService.name,
    });

    return normalizeTextForTts;
  }

  /**
   * @description Deterministic, structural-only regex transformations that are always safe to apply (cannot change meaning).
   */
  private regexSafePass(text: string): string {
    let result = text;

    result = this.stripElongationTildes(result);
    result = this.collapseRepeatedLetters(result);
    result = this.collapseExcessiveDots(result);
    result = this.lowercaseAllCapsWords(result);
    result = this.replaceBracketedSkills(result);

    return result;
  }

  /**
   * @description Removes tildes used as elongation markers after word characters.
   * @example `"ahhh~"` → `"ahhh"`,  `"oooh~!"` → `"oooh!"`
   */
  private stripElongationTildes(text: string): string {
    return text.replace(/(\w)~(?=\s|[!?.,;:'")\]]|$)/g, '$1');
  }

  /**
   * @description Collapses 3 or more identical consecutive letters down to 2
   * @example `"ahhhhhh"` → `"ahh"`,  `"CRAAAACK"` → `"CRAACK"`
   */
  private collapseRepeatedLetters(text: string): string {
    /**
     * @description Maximum number of identical consecutive letters before the excess is trimmed (e.g. "ahhhhhh" → "ahh").
     */
    const MAX_CONSECUTIVE_LETTERS = 2 as const;

    return text.replace(
      /([a-zA-Z])\1{2,}/g,
      (_match, letter: string) => {
        return letter.repeat(MAX_CONSECUTIVE_LETTERS);
      },
    );
  }

  /**
   * @description Collapses 4 or more consecutive dots down to `"..."`.
   * @example `"......"` → `"..."`
   */
  private collapseExcessiveDots(text: string): string {
    return text.replace(/\.{4,}/g, '...');
  }

  /**
   * @description Converts fully-uppercase words (2+ chars) to lowercase so TTS reads them naturally instead of spelling them, single-char `"I"` is left alone.
   * @example `"CRACK"` → `"crack"`
   */
  private lowercaseAllCapsWords(text: string): string {
    return text.replace(/\b([A-Z]{2,})\b/g, (_match, word: string) =>
      word.toLowerCase(),
    );
  }

  /**
   * @description Replaces square-bracket and fullwidth-bracket markers with commas so TTS reads them as a spoken pause.
   * @example `"[Boost]"` → `", Boost,"`,  `"【Fireball】"` → `", Fireball,"`
   */
  private replaceBracketedSkills(text: string): string {
    return text.replace(
      /[[\u3010]([^\]\u3011]+)[\]\u3011]/g,
      ', $1,',
    );
  }
}

/** @internal helper that holds the emission state and pure formatting rules. */
class TtsSerializer {
  private readonly includeLinkUrls: boolean;
  private readonly out: string[] = [];

  constructor({ includeLinkUrls = false }: TtsOptions = {}) {
    this.includeLinkUrls = includeLinkUrls;
  }

  /** @description entrypoint for walking the AST. */
  walk(root: Root): this {
    visit(root, (node) => {
      switch (node.type) {
        case 'heading':
          this.emitHeading(node as Heading);
          return SKIP;

        case 'paragraph':
          this.emitParagraph(node as Paragraph);
          return SKIP;

        case 'list':
          this.emitList(node as List);
          return SKIP;

        case 'blockquote':
          this.emitBlockquote(node as Blockquote);
          return SKIP;

        case 'code':
          this.emitCode(node as Code);
          return SKIP;

        case 'thematicBreak':
          this.emitThematicBreak(node as ThematicBreak);
          return SKIP;

        default:
          // Let unhandled nodes bubble down normally
          return;
      }
    });

    return this;
  }

  /** @description applies the final normalizations and returns the output. */
  finish(): string {
    const s = this.out
      .join('')
      // collapse >2 blank lines to exactly 2
      .replace(/\n{3,}/g, '\n\n')
      // strip trailing whitespace before newline
      .replace(/[ \t]+\n/g, '\n')
      .trim();

    return s + '\n';
  }

  private emitHeading(node: Heading): void {
    const text = this.inlineToString(node.children);
    if (text) {
      this.out.push(text);
      this.out.push(':');
      this.newline(2); // stronger pause
    }
  }

  private emitParagraph(node: Paragraph): void {
    this.emitInlineNodes(node.children);
    this.newline(2);
  }

  private emitList(node: List): void {
    let index = 1;

    for (const item of node.children as ListItem[]) {
      const bullet = node.ordered ? `${index++}. ` : '• ';

      this.out.push(bullet);

      // Each list item can contain paragraphs or nested lists
      for (const child of item.children) {
        if (child.type === 'paragraph') {
          this.emitInlineNodes(child.children);
          continue;
        }

        if (child.type === 'list') {
          // Make nested lists audible with a small break before rendering
          this.newline();
          this.emitList(child as List);
          continue;
        }

        // Fallback: try to consume any phrasing content inside
        this.emitInlineChildrenIfAny(child as RootContent);
      }

      this.newline(); // short pause between items
    }

    this.newline(); // extra gap after the whole list
  }

  private emitBlockquote(node: Blockquote): void {
    this.out.push('Quote: ');

    for (const child of node.children) {
      if (child.type === 'paragraph') {
        this.emitInlineNodes(child.children);
        continue;
      }

      this.emitInlineChildrenIfAny(child as RootContent);
    }

    this.newline(2);
  }

  private emitCode(node: Code): void {
    this.out.push('Code: ');
    // Trim trailing spaces/tabs per line to avoid awkward TTS pauses
    this.out.push(node.value.replace(/[ \t]+$/gm, ''));
    this.newline(2);
  }

  private emitThematicBreak(_node: ThematicBreak): void {
    this.newline(2);
  }

  private emitInline(
    node: PhrasingContent,
    buffer: string[] = this.out,
  ): void {
    switch (node.type) {
      case 'text': {
        buffer.push(node.value);

        break;
      }

      case 'emphasis':
      case 'strong':
      case 'delete': {
        if (node.children) {
          for (const child of node.children) {
            this.emitInline(child as PhrasingContent, buffer);
          }
        }

        break;
      }

      case 'inlineCode': {
        // Quote inline code for clearer TTS delivery
        buffer.push(`"${node.value}"`);
        break;
      }

      case 'link': {
        if (node.children) {
          for (const child of node.children) {
            this.emitInline(child as PhrasingContent, buffer);
          }
        }

        if (this.includeLinkUrls && node.url) {
          buffer.push(` (link: ${node.url})`);
        }

        break;
      }

      case 'image': {
        buffer.push(node.alt || 'image');

        break;
      }

      default: {
        if (!('children' in node) || !isArray(node.children)) {
          break;
        }

        // If anything else slips in, attempt to traverse children defensively
        // (This keeps behavior resilient across mdast extensions)
        for (const child of node.children) {
          this.emitInline(child as PhrasingContent, buffer);
        }

        break;
      }
    }
  }

  private emitInlineNodes(
    nodes: PhrasingContent[],
    buffer: string[] = this.out,
  ): void {
    for (const node of nodes) {
      this.emitInline(node, buffer);
    }
  }

  private inlineToString(nodes: PhrasingContent[]): string {
    const tmp: string[] = [];

    this.emitInlineNodes(nodes, tmp);

    return tmp.join('');
  }

  /**
   * @description tries to find and emit inline content inside an arbitrary content node.
   */
  private emitInlineChildrenIfAny(node: RootContent): void {
    if (!('children' in node) || !isArray(node.children)) {
      return;
    }

    // Many mdast nodes expose children; when they do, walk them and take phrasing descendants
    for (const child of node.children) {
      if (
        isNil(child) ||
        !isNotEmptyObject(child) ||
        !isObject<any>(child)
      ) {
        continue;
      }

      // Paragraph → phrasing content
      if (child.type === 'paragraph') {
        this.emitInlineNodes((child as Paragraph).children);
        continue;
      }

      // Attempt to recurse into nested children (best-effort)
      this.emitInlineChildrenIfAny(child as RootContent);
    }
  }

  private newline(n = 1): void {
    if (n > 0) {
      this.out.push('\n'.repeat(n));
    }
  }
}
