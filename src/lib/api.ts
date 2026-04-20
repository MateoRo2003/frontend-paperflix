import axios from 'axios';

// All requests go to /api/* which Next.js rewrites server-side to the backend.
// The browser only ever connects to the platform's own origin — no external
// domain to whitelist on school firewalls.
const BASE = '/api';

export const api = axios.create({ baseURL: BASE });

// Attach token if present
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('pf_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 Unauthorized globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Clear invalid credentials and force re-login
      localStorage.removeItem('pf_token');
      localStorage.removeItem('pf_admin');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

// SWR fetcher
export const fetcher = (url: string) => api.get(url).then((r) => r.data);

// Subjects
export const getSubjects     = (all = false)             => api.get('/subjects', { params: all ? { all: 'true' } : {} }).then(r => r.data);
export const getSubject      = (slug: string)            => api.get(`/subjects/${slug}`).then(r => r.data);
export const createSubject   = (data: any)               => api.post('/subjects', data).then(r => r.data);
export const updateSubject   = (id: number, data: any)   => api.put(`/subjects/${id}`, data).then(r => r.data);
export const deleteSubject   = (id: number)              => api.delete(`/subjects/${id}`).then(r => r.data);
export const reorderSubjects = (items: { id: number; order: number }[]) => api.patch('/subjects/reorder', { items }).then(r => r.data);

// Units
export const getUnits        = (subjectId?: number)      => api.get('/units', { params: subjectId ? { subjectId } : {} }).then(r => r.data);
export const createUnit      = (data: any)               => api.post('/units', data).then(r => r.data);
export const updateUnit      = (id: number, data: any)   => api.put(`/units/${id}`, data).then(r => r.data);
export const deleteUnit      = (id: number)              => api.delete(`/units/${id}`).then(r => r.data);
export const reorderUnits   = (items: { id: number; order: number }[]) => api.patch('/units/reorder', { items }).then(r => r.data);

// Resources
export const getResources    = (params: any)             => api.get('/resources', { params }).then(r => r.data);
export const getFeatured     = ()                        => api.get('/resources/featured').then(r => r.data);
export const getResource     = (id: number)              => api.get(`/resources/${id}`).then(r => r.data);
export const trackView       = (id: number)              => api.post(`/resources/${id}/view`).then(r => r.data);
export const getStats        = (from?: string, to?: string) => api.get('/resources/stats', { params: { ...(from ? { from } : {}), ...(to ? { to } : {}) } }).then(r => r.data);
export const getResourceFilters = (subjectId: number, course?: string) =>
  api.get('/resources/filters', { params: { subjectId, ...(course ? { course } : {}) } }).then(r => r.data) as
  Promise<{ courses: string[]; units: { id: number; name: string }[]; activityTypes: string[] }>;
export const scrapeResourceUrl = (url: string) =>
  api.get('/resources/scrape', { params: { url } }).then(r => r.data) as
  Promise<{ title: string; description: string; imageUrl: string }>;
export const createResource  = (data: any)               => api.post('/resources', data).then(r => r.data);
export const bulkCreateResources  = (items: any[])       => api.post('/resources/bulk', { items }).then(r => r.data) as Promise<{ created: number; errors: { row: number; message: string }[] }>;
export const countImageMigration      = ()                          => api.get('/resources/migrate-images/count').then(r => r.data) as Promise<{ total: number; pending: number; alreadyWebp: number; noImage: number; noImageWithUrl: number }>;
export const migrateImagesBatch       = (offset: number, limit = 10) => api.post(`/resources/migrate-images/batch?offset=${offset}&limit=${limit}`).then(r => r.data) as Promise<{ processed: number; skipped: number; converted: number; failed: number; done: boolean; errors: { id: number; title: string; reason: string }[] }>;
export const scrapeMissingImagesBatch = (offset: number, limit = 10) => api.post(`/resources/scrape-missing-images/batch?offset=${offset}&limit=${limit}`).then(r => r.data) as Promise<{ processed: number; saved: number; failed: number; done: boolean; errors: { id: number; title: string; reason: string }[] }>;
export const rescrapeImagesBatch      = (offset: number, limit = 5, subjectId?: number) => api.post(`/resources/rescrape-images/batch?offset=${offset}&limit=${limit}${subjectId ? `&subjectId=${subjectId}` : ''}`).then(r => r.data) as Promise<{ processed: number; updated: number; failed: number; done: boolean; total: number; errors: { id: number; title: string; reason: string }[] }>;
export const updateResource  = (id: number, data: any)   => api.put(`/resources/${id}`, data).then(r => r.data);
export const deleteResource  = (id: number)              => api.delete(`/resources/${id}`).then(r => r.data);

export const getUnitsByCourse         = () => api.get('/resources/units-by-course').then(r => r.data);
export const getDistinctCourses      = () => api.get('/resources/distinct-courses').then(r => r.data) as Promise<string[]>;
export const getDistinctActivityTypes = () => api.get('/resources/distinct-activity-types').then(r => r.data) as Promise<string[]>;
export const getAuthors              = ()               => api.get('/resources/authors').then(r => r.data) as Promise<string[]>;
export const getTopResources         = (limit = 20, from?: string, to?: string) => api.get('/resources/top', { params: { limit, ...(from ? { from } : {}), ...(to ? { to } : {}) } }).then(r => r.data);
export const getStatsByCourse        = (from?: string, to?: string) => api.get('/resources/stats-by-course', { params: { ...(from ? { from } : {}), ...(to ? { to } : {}) } }).then(r => r.data);
export const getStatsByActivityType  = (from?: string, to?: string) => api.get('/resources/stats-by-activity-type', { params: { ...(from ? { from } : {}), ...(to ? { to } : {}) } }).then(r => r.data);
export const uploadResourceImage = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/resources/upload-image', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data) as Promise<{ url: string }>;
};

// Courses
export const getCourses      = ()                        => api.get('/courses').then(r => r.data);
export const createCourse    = (data: any)               => api.post('/courses', data).then(r => r.data);
export const updateCourse    = (id: number, data: any)   => api.put(`/courses/${id}`, data).then(r => r.data);
export const deleteCourse    = (id: number)              => api.delete(`/courses/${id}`).then(r => r.data);
export const seedCourses     = ()                        => api.post('/courses/seed').then(r => r.data) as Promise<{ inserted: number }>;

// Activity Types
export const getActivityTypes  = ()                        => api.get('/activity-types').then(r => r.data);
export const createActivityType = (data: any)              => api.post('/activity-types', data).then(r => r.data);
export const updateActivityType = (id: number, data: any)  => api.put(`/activity-types/${id}`, data).then(r => r.data);
export const deleteActivityType = (id: number)             => api.delete(`/activity-types/${id}`).then(r => r.data);
export const seedActivityTypes  = ()                       => api.post('/activity-types/seed').then(r => r.data) as Promise<{ inserted: number }>;

// Auth
export const login           = (email: string, pw: string) => api.post('/auth/login', { email, password: pw }).then(r => r.data);

// Settings
export const getSettings    = ()                              => api.get('/settings').then(r => r.data);
export const updateSetting  = (key: string, value: string)   => api.patch(`/settings/${key}`, { value }).then(r => r.data);

// Slides (carousel)
export const getSlides        = ()                        => api.get('/slides').then(r => r.data);
export const getAllSlides      = ()                        => api.get('/slides/all').then(r => r.data);
export const createSlide      = (data: any)               => api.post('/slides', data).then(r => r.data);
export const updateSlide      = (id: number, data: any)   => api.put(`/slides/${id}`, data).then(r => r.data);
export const deleteSlide      = (id: number)              => api.delete(`/slides/${id}`).then(r => r.data);
export const reorderSlides    = (ids: number[])           => api.patch('/slides/reorder', { ids }).then(r => r.data);
export const uploadSlideImage = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/slides/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
};

// Suggestions — POST público, resto requiere JWT
export const createSuggestion    = (data: any)           => api.post('/suggestions', data).then(r => r.data);
export const getSuggestions      = (status?: string)     => api.get('/suggestions', { params: status ? { status } : {} }).then(r => r.data);
export const getPendingCount     = ()                    => api.get('/suggestions/count-pending').then(r => r.data);
export const approveSuggestion   = (id: number)          => api.patch(`/suggestions/${id}/approve`).then(r => r.data);
export const rejectSuggestion    = (id: number)          => api.patch(`/suggestions/${id}/reject`).then(r => r.data);
export const deleteSuggestion    = (id: number)          => api.delete(`/suggestions/${id}`).then(r => r.data);
