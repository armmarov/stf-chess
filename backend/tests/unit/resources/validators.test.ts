import {
  createResourceSchema,
  updateResourceSchema,
  resourceTypeEnum,
} from '../../../src/modules/resources/resources.validators';

describe('resourceTypeEnum', () => {
  it('accepts book, homework, app', () => {
    expect(resourceTypeEnum.safeParse('book').success).toBe(true);
    expect(resourceTypeEnum.safeParse('homework').success).toBe(true);
    expect(resourceTypeEnum.safeParse('app').success).toBe(true);
  });

  it('rejects invalid type', () => {
    expect(resourceTypeEnum.safeParse('video').success).toBe(false);
    expect(resourceTypeEnum.safeParse('').success).toBe(false);
    expect(resourceTypeEnum.safeParse('Book').success).toBe(false);
  });
});

describe('createResourceSchema', () => {
  const valid = { title: 'Chess Book', type: 'book' };

  it('valid minimal input passes', () => {
    expect(createResourceSchema.safeParse(valid).success).toBe(true);
  });

  it('valid full input passes', () => {
    expect(
      createResourceSchema.safeParse({
        ...valid,
        description: 'A great book',
        url: 'https://chess.example.com',
        isEnabled: true,
      }).success,
    ).toBe(true);
  });

  it('missing title → error', () => {
    expect(createResourceSchema.safeParse({ type: 'book' }).success).toBe(false);
  });

  it('empty string title → error', () => {
    expect(createResourceSchema.safeParse({ title: '', type: 'book' }).success).toBe(false);
  });

  it('title over 200 chars → error', () => {
    expect(
      createResourceSchema.safeParse({ title: 'a'.repeat(201), type: 'book' }).success,
    ).toBe(false);
  });

  it('missing type → error', () => {
    expect(createResourceSchema.safeParse({ title: 'Test' }).success).toBe(false);
  });

  it('invalid type value → error', () => {
    expect(createResourceSchema.safeParse({ title: 'Test', type: 'video' }).success).toBe(false);
  });

  it('invalid url → error', () => {
    expect(
      createResourceSchema.safeParse({ ...valid, url: 'not-a-url' }).success,
    ).toBe(false);
  });

  it('empty string url → undefined (preprocessed)', () => {
    const result = createResourceSchema.safeParse({ ...valid, url: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.url).toBeUndefined();
  });

  it('isEnabled \'true\' string → true', () => {
    const result = createResourceSchema.safeParse({ ...valid, isEnabled: 'true' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isEnabled).toBe(true);
  });

  it('isEnabled \'false\' string → false', () => {
    const result = createResourceSchema.safeParse({ ...valid, isEnabled: 'false' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isEnabled).toBe(false);
  });

  it('isEnabled not provided → defaults to true', () => {
    const result = createResourceSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isEnabled).toBe(true);
  });

  it('isEnabled boolean true passes', () => {
    const result = createResourceSchema.safeParse({ ...valid, isEnabled: true });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isEnabled).toBe(true);
  });
});

describe('updateResourceSchema', () => {
  it('empty object is valid (all optional)', () => {
    expect(updateResourceSchema.safeParse({}).success).toBe(true);
  });

  it('title update valid', () => {
    expect(updateResourceSchema.safeParse({ title: 'New Title' }).success).toBe(true);
  });

  it('empty string title → error', () => {
    expect(updateResourceSchema.safeParse({ title: '' }).success).toBe(false);
  });

  it('invalid type → error', () => {
    expect(updateResourceSchema.safeParse({ type: 'magazine' }).success).toBe(false);
  });

  it('empty string description → null (preprocessed)', () => {
    const result = updateResourceSchema.safeParse({ description: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBeNull();
  });

  it('invalid url → error', () => {
    expect(updateResourceSchema.safeParse({ url: 'not-a-url' }).success).toBe(false);
  });

  it('empty string url → null (preprocessed)', () => {
    const result = updateResourceSchema.safeParse({ url: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.url).toBeNull();
  });

  it('isEnabled \'true\' → true', () => {
    const result = updateResourceSchema.safeParse({ isEnabled: 'true' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isEnabled).toBe(true);
  });

  it('isEnabled \'false\' → false', () => {
    const result = updateResourceSchema.safeParse({ isEnabled: 'false' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isEnabled).toBe(false);
  });

  it('removeImage string valid', () => {
    expect(updateResourceSchema.safeParse({ removeImage: 'true' }).success).toBe(true);
  });

  it('removeFile string valid', () => {
    expect(updateResourceSchema.safeParse({ removeFile: 'true' }).success).toBe(true);
  });
});
