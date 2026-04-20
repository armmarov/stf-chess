import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware';
import { roleGuard } from '../../middleware/roleGuard';
import { togglePreAttend, getRoster, markAttend } from './attendance.controller';

// Pre-attendance router (mounted at /api/sessions/:id/pre-attendance)
export const preAttendanceRouter = Router({ mergeParams: true });
preAttendanceRouter.use(authMiddleware);
preAttendanceRouter.post('/', roleGuard(['student', 'teacher', 'admin']), togglePreAttend);

// Attendance roster/marking router (mounted at /api/sessions/:id/attendance)
export const attendanceRouter = Router({ mergeParams: true });
attendanceRouter.use(authMiddleware);
attendanceRouter.get('/', roleGuard(['admin', 'teacher']), getRoster);
attendanceRouter.put('/', roleGuard(['admin', 'teacher']), markAttend);
