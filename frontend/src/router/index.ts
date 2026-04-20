import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import type { Role } from '@/stores/authStore'

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    roles?: Role[]
  }
}

const ROLE_HOME: Record<Role, string> = {
  admin: '/admin',
  teacher: '/teacher',
  coach: '/login', // coach UI deferred to Phase 2
  student: '/student',
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/LoginPage.vue'),
      meta: { public: true },
    },
    {
      path: '/forbidden',
      name: 'forbidden',
      component: () => import('@/pages/ForbiddenPage.vue'),
      meta: { public: true },
    },
    {
      path: '/admin',
      component: () => import('@/layouts/AdminLayout.vue'),
      meta: { roles: ['admin'] },
      children: [
        {
          path: '',
          name: 'admin-dashboard',
          component: () => import('@/pages/admin/DashboardPage.vue'),
        },
        {
          path: 'users',
          name: 'admin-user-list',
          component: () => import('@/pages/admin/users/UserListPage.vue'),
        },
        {
          path: 'users/new',
          name: 'admin-user-new',
          component: () => import('@/pages/admin/users/UserFormPage.vue'),
        },
        {
          path: 'users/:id',
          name: 'admin-user-detail',
          component: () => import('@/pages/admin/users/UserDetailPage.vue'),
        },
        {
          path: 'users/:id/edit',
          name: 'admin-user-edit',
          component: () => import('@/pages/admin/users/UserFormPage.vue'),
        },
        {
          path: 'config/fee',
          name: 'admin-fee-config',
          component: () => import('@/pages/admin/config/FeeConfigPage.vue'),
        },
        {
          path: 'tournaments/new',
          name: 'admin-tournament-new',
          component: () => import('@/pages/admin/tournaments/TournamentFormPage.vue'),
        },
        {
          path: 'tournaments/:id/edit',
          name: 'admin-tournament-edit',
          component: () => import('@/pages/admin/tournaments/TournamentFormPage.vue'),
        },
        {
          path: 'polls/new',
          name: 'admin-poll-new',
          component: () => import('@/pages/admin/polls/PollFormPage.vue'),
        },
        {
          path: 'polls/:id/edit',
          name: 'admin-poll-edit',
          component: () => import('@/pages/admin/polls/PollFormPage.vue'),
        },
      ],
    },
    {
      path: '/teacher',
      component: () => import('@/layouts/TeacherLayout.vue'),
      meta: { roles: ['teacher', 'admin'] },
      children: [
        {
          path: '',
          name: 'teacher-dashboard',
          component: () => import('@/pages/teacher/DashboardPage.vue'),
        },
        {
          path: 'students',
          name: 'teacher-student-list',
          component: () => import('@/pages/teacher/students/StudentListPage.vue'),
        },
        {
          path: 'students/new',
          name: 'teacher-student-new',
          component: () => import('@/pages/teacher/students/StudentFormPage.vue'),
        },
        {
          path: 'students/:id',
          name: 'teacher-student-detail',
          meta: { roles: ['teacher', 'admin'] },
          component: () => import('@/pages/teacher/students/StudentDetailPage.vue'),
        },
        {
          path: 'students/:id/edit',
          name: 'teacher-student-edit',
          component: () => import('@/pages/teacher/students/StudentEditPage.vue'),
        },
      ],
    },
    {
      path: '/student',
      component: () => import('@/layouts/StudentLayout.vue'),
      meta: { roles: ['student'] },
      children: [
        {
          path: '',
          name: 'student-dashboard',
          component: () => import('@/pages/student/DashboardPage.vue'),
        },
        {
          path: 'payments',
          name: 'student-payment-list',
          component: () => import('@/pages/student/payments/PaymentListPage.vue'),
        },
        {
          path: 'payments/:id',
          name: 'student-payment-detail',
          component: () => import('@/pages/student/payments/PaymentDetailPage.vue'),
        },
      ],
    },
    {
      path: '/sessions',
      component: () => import('@/layouts/AppLayout.vue'),
      children: [
        {
          path: '',
          name: 'session-list',
          component: () => import('@/pages/sessions/SessionListPage.vue'),
        },
        {
          path: 'new',
          name: 'session-new',
          meta: { roles: ['admin', 'teacher'] },
          component: () => import('@/pages/sessions/SessionFormPage.vue'),
        },
        {
          path: ':id',
          name: 'session-detail',
          component: () => import('@/pages/sessions/SessionDetailPage.vue'),
        },
        {
          path: ':id/edit',
          name: 'session-edit',
          meta: { roles: ['admin', 'teacher'] },
          component: () => import('@/pages/sessions/SessionFormPage.vue'),
        },
        {
          path: ':id/attendance',
          name: 'session-attendance',
          meta: { roles: ['admin', 'teacher'] },
          component: () => import('@/pages/attendance/AttendanceMarkingPage.vue'),
        },
      ],
    },
    {
      path: '/payments',
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { roles: ['admin', 'teacher'] },
      children: [
        {
          path: 'review',
          name: 'payment-review-list',
          component: () => import('@/pages/payments/PaymentReviewListPage.vue'),
        },
        {
          path: 'review/:id',
          name: 'payment-review-detail',
          component: () => import('@/pages/payments/PaymentReviewDetailPage.vue'),
        },
      ],
    },
    {
      path: '/tournaments',
      component: () => import('@/layouts/AppLayout.vue'),
      children: [
        {
          path: '',
          name: 'tournament-list',
          component: () => import('@/pages/tournaments/TournamentListPage.vue'),
        },
        {
          path: ':id',
          name: 'tournament-detail',
          component: () => import('@/pages/tournaments/TournamentDetailPage.vue'),
        },
      ],
    },
    {
      path: '/polls',
      component: () => import('@/layouts/AppLayout.vue'),
      children: [
        {
          path: '',
          name: 'poll-list',
          component: () => import('@/pages/polls/PollListPage.vue'),
        },
        {
          path: ':id',
          name: 'poll-detail',
          component: () => import('@/pages/polls/PollDetailPage.vue'),
        },
      ],
    },
    {
      path: '/notifications',
      component: () => import('@/layouts/AppLayout.vue'),
      children: [
        {
          path: '',
          name: 'notifications',
          component: () => import('@/pages/NotificationsPage.vue'),
        },
      ],
    },
    {
      path: '/profile',
      component: () => import('@/layouts/AppLayout.vue'),
      children: [
        {
          path: '',
          name: 'profile',
          component: () => import('@/pages/ProfilePage.vue'),
        },
      ],
    },
    {
      path: '/about',
      component: () => import('@/layouts/AppLayout.vue'),
      children: [
        {
          path: '',
          name: 'about',
          component: () => import('@/pages/AboutPage.vue'),
        },
      ],
    },
    {
      path: '/payment-info',
      component: () => import('@/layouts/AppLayout.vue'),
      children: [
        {
          path: '',
          name: 'payment-info',
          component: () => import('@/pages/PaymentInfoPage.vue'),
        },
      ],
    },
    {
      path: '/',
      redirect: '/login',
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/pages/NotFoundPage.vue'),
      meta: { public: true },
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  // Public routes are always accessible
  if (to.meta.public) {
    // Authenticated user hitting /login → send to their dashboard
    if (to.name === 'login' && auth.user) {
      return ROLE_HOME[auth.user.role]
    }
    return true
  }

  // Unauthenticated → login
  if (!auth.user) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  // Role check
  const allowed = to.meta.roles
  if (allowed && !allowed.includes(auth.user.role)) {
    return { name: 'forbidden' }
  }

  return true
})

export default router
