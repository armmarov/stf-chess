import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import { setFeeConfig } from '../../helpers/payments';

const URL = '/api/config/fee';

describe('GET /api/config/fee', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('401 without auth', async () => {
    const res = await request(app).get(URL);
    expect(res.status).toBe(401);
  });

  it('200 for student with current fee', async () => {
    const admin = await createUser('admin');
    await setFeeConfig(50, admin.id);
    const { agent } = await loginAs('student');
    const res = await agent.get(URL);
    expect(res.status).toBe(200);
    expect(Number(res.body.fee)).toBe(50);
  });

  it('200 for teacher', async () => {
    const admin = await createUser('admin');
    await setFeeConfig(30, admin.id);
    const { agent } = await loginAs('teacher');
    const res = await agent.get(URL);
    expect(res.status).toBe(200);
    expect(Number(res.body.fee)).toBe(30);
  });

  it('200 for admin', async () => {
    const { agent, user } = await loginAs('admin');
    await setFeeConfig(75, user.id);
    const res = await agent.get(URL);
    expect(res.status).toBe(200);
    expect(Number(res.body.fee)).toBe(75);
  });

  it('200 for coach', async () => {
    const admin = await createUser('admin');
    await setFeeConfig(25, admin.id);
    const { agent } = await loginAs('coach');
    const res = await agent.get(URL);
    expect(res.status).toBe(200);
  });

  it('404 when fee has not been configured yet', async () => {
    const { agent } = await loginAs('student');
    const res = await agent.get(URL);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/config/fee', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('401 without auth', async () => {
    const res = await request(app).put(URL).send({ fee: 50 });
    expect(res.status).toBe(401);
  });

  it('403 for teacher', async () => {
    const { agent } = await loginAs('teacher');
    const res = await agent.put(URL).send({ fee: 50 });
    expect(res.status).toBe(403);
  });

  it('403 for student', async () => {
    const { agent } = await loginAs('student');
    const res = await agent.put(URL).send({ fee: 50 });
    expect(res.status).toBe(403);
  });

  it('403 for coach', async () => {
    const { agent } = await loginAs('coach');
    const res = await agent.put(URL).send({ fee: 50 });
    expect(res.status).toBe(403);
  });

  it('200 admin sets fee — returns updated value', async () => {
    const { agent } = await loginAs('admin');
    const res = await agent.put(URL).send({ fee: 50 });
    expect(res.status).toBe(200);
    expect(Number(res.body.fee)).toBe(50);
  });

  it('200 admin updates existing fee', async () => {
    const { agent, user } = await loginAs('admin');
    await setFeeConfig(30, user.id);
    const res = await agent.put(URL).send({ fee: 80 });
    expect(res.status).toBe(200);
    expect(Number(res.body.fee)).toBe(80);

    // Confirm persisted via GET
    const getRes = await agent.get(URL);
    expect(Number(getRes.body.fee)).toBe(80);
  });

  it('400 for negative fee', async () => {
    const { agent } = await loginAs('admin');
    const res = await agent.put(URL).send({ fee: -5 });
    expect(res.status).toBe(400);
  });

  it('400 for zero fee', async () => {
    const { agent } = await loginAs('admin');
    const res = await agent.put(URL).send({ fee: 0 });
    expect(res.status).toBe(400);
  });

  it('400 for fee > 10000', async () => {
    const { agent } = await loginAs('admin');
    const res = await agent.put(URL).send({ fee: 10001 });
    expect(res.status).toBe(400);
  });

  it('400 for fee with more than 2 decimal places', async () => {
    const { agent } = await loginAs('admin');
    const res = await agent.put(URL).send({ fee: 10.123 });
    expect(res.status).toBe(400);
  });

  it('400 for non-numeric fee', async () => {
    const { agent } = await loginAs('admin');
    const res = await agent.put(URL).send({ fee: 'fifty' });
    expect(res.status).toBe(400);
  });

  it('200 accepts fee with exactly 2 decimal places', async () => {
    const { agent } = await loginAs('admin');
    const res = await agent.put(URL).send({ fee: 49.99 });
    expect(res.status).toBe(200);
    expect(Number(res.body.fee)).toBe(49.99);
  });

  it('200 accepts maximum fee of 10000', async () => {
    const { agent } = await loginAs('admin');
    const res = await agent.put(URL).send({ fee: 10000 });
    expect(res.status).toBe(200);
  });
});
