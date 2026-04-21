import { Request, Response, NextFunction } from 'express';
import { createRecordSchema, updateRecordSchema } from './records.validators';
import {
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
} from './records.service';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = typeof req.query.studentId === 'string' ? req.query.studentId : undefined;
    const records = await listRecords(studentId);
    res.json({ records });
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const record = await getRecord(req.params.id);
    res.json({ record });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createRecordSchema.safeParse(req.body);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }
    const record = await createRecord(
      parsed.data,
      req.user!.id,
      req.user!.id,
      req.user!.role,
    );
    res.status(201).json({ record });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = updateRecordSchema.safeParse(req.body);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }
    const record = await updateRecord(
      req.params.id,
      parsed.data,
      req.user!.id,
      req.user!.role,
    );
    res.json({ record });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteRecord(req.params.id, req.user!.id, req.user!.role);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
