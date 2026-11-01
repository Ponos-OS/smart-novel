import type { ConfigType } from '@nestjs/config';

import { createHmac } from 'node:crypto';

import { appConfigs } from '../../app/configs/app.config';
import { CursorCodec } from './cursor-codec.service';

const signingSecret = 'b7e1f0c2a94d4c1f8d3e6a5b09c27f41';
const id = 'bb563ad5-1ac4-46c2-a25f-6f62d245f44c';

function createCodec(secret = signingSecret) {
  return new CursorCodec({
    CURSOR_SIGNING_SECRET: secret,
  } as ConfigType<typeof appConfigs>);
}

function signed(body: string, secret = signingSecret) {
  const signature = createHmac('sha256', secret)
    .update(body)
    .digest('base64url');

  return `${body}.${signature}`;
}

describe(CursorCodec.name, () => {
  let uut: CursorCodec;

  beforeEach(() => {
    uut = createCodec();
  });

  it('should give back the id it was given', () => {
    const cursor = uut.encode('novels', id);

    const result = uut.decode(cursor, 'novels');

    expect(result).toBe(id);
  });

  it('should encode the audience and the position, signed', () => {
    const cursor = uut.encode('novels', id);

    const [body, signature] = cursor.split('.');

    expect(
      JSON.parse(Buffer.from(body, 'base64url').toString()),
    ).toStrictEqual({ a: 'novels', k: [id] });
    expect(signature).toBe(
      createHmac('sha256', signingSecret)
        .update(body)
        .digest('base64url'),
    );
  });

  it('should refuse a cursor whose payload was changed', () => {
    const [, signature] = uut.encode('novels', id).split('.');
    const forgedBody = Buffer.from(
      JSON.stringify({
        a: 'novels',
        k: ['904bf826-33be-4172-b63f-665bba9007b9'],
      }),
    ).toString('base64url');

    expect(() =>
      uut.decode(`${forgedBody}.${signature}`, 'novels'),
    ).toThrow('Invalid cursor');
  });

  it('should refuse a cursor whose signature was changed', () => {
    const cursor = uut.encode('novels', id);
    const tampered = `${cursor.slice(0, -1)}${cursor.endsWith('A') ? 'B' : 'A'}`;

    expect(() => uut.decode(tampered, 'novels')).toThrow(
      'Invalid cursor',
    );
  });

  it('should refuse a cursor signed with another key', () => {
    const cursor = createCodec(
      '0d94c1e7a63b4f28b5a0e9d1c8f37a62',
    ).encode('novels', id);

    expect(() => uut.decode(cursor, 'novels')).toThrow(
      'Invalid cursor',
    );
  });

  it('should refuse a cursor issued for another audience', () => {
    const cursor = uut.encode('chapters', id);

    expect(() => uut.decode(cursor, 'novels')).toThrow(
      'Invalid cursor',
    );
  });

  it.each([
    ['empty', ''],
    ['unsigned base64 of an id', Buffer.from(id).toString('base64')],
    ['no signature', 'eyJhIjoibm92ZWxzIn0.'],
    ['too many parts', 'eyJhIjoibm92ZWxzIn0.c2ln.ZXh0cmE'],
    ['not base64', 'not-base64!!'],
  ])('should refuse a malformed cursor: %s', (_case, cursor) => {
    expect(() => uut.decode(cursor, 'novels')).toThrow(
      'Invalid cursor',
    );
  });

  it.each([
    ['position is not a UUID', { a: 'novels', k: ['example-novel'] }],
    ['position is missing', { a: 'novels' }],
    ['position has two keys', { a: 'novels', k: [id, id] }],
  ])(
    'should refuse a correctly signed payload whose %s',
    (_case, payload) => {
      const body = Buffer.from(JSON.stringify(payload)).toString(
        'base64url',
      );

      expect(() => uut.decode(signed(body), 'novels')).toThrow(
        'Invalid cursor',
      );
    },
  );
});
