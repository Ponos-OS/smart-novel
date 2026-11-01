import {
  parseApplications,
  StoredWriterApplication,
} from './writer-application';

const pending: StoredWriterApplication = {
  note: 'I have been writing serialized fantasy for six years.',
  appliedAt: '2026-10-31T09:00:00.000Z',
  rejectionReason: null,
  reviewedBy: null,
  reviewedAt: null,
};

describe(parseApplications.name, () => {
  it('should accept an empty history and reviewed and unreviewed entries', () => {
    const reviewed: StoredWriterApplication = {
      ...pending,
      rejectionReason: 'Please add writing samples',
      reviewedBy: '364554362732740610',
      reviewedAt: '2026-11-01T10:30:00.000Z',
    };

    const result = parseApplications([reviewed, pending]);

    expect(result).toStrictEqual([reviewed, pending]);
    expect(parseApplications([])).toStrictEqual([]);
  });

  it.each([
    { scenario: 'not an array', value: { note: 'x' } },
    { scenario: 'null', value: null },
    { scenario: 'an entry that is not an object', value: ['note'] },
    {
      scenario: 'an entry without a note',
      value: [{ ...pending, note: undefined }],
    },
    {
      scenario: 'a note that is not a string',
      value: [{ ...pending, note: 7 }],
    },
    {
      scenario: 'an application date that is not an ISO date',
      value: [{ ...pending, appliedAt: 'yesterday' }],
    },
    {
      scenario: 'a review date that is not an ISO date',
      value: [{ ...pending, reviewedAt: '2026-11-01' }],
    },
    {
      scenario: 'a review field that is a number',
      value: [{ ...pending, reviewedBy: 12 }],
    },
    {
      scenario: 'a missing review field',
      value: [{ note: 'x', appliedAt: pending.appliedAt }],
    },
  ])('should refuse $scenario', ({ value }) => {
    const result = () => parseApplications(value);

    expect(result).toThrow('malformed');
  });
});
