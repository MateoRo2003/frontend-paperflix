export interface Subject {
  id: number;
  name: string;
  slug: string;
  icon: string;
  color: string;
  order: number;
  isActive: boolean;
  resourceCount?: number;
}

export interface Unit {
  id: number;
  subjectId: number;
  name: string;
  code?: string;
  course?: string;
  oaDescription?: string;
  order: number;
}

export interface Resource {
  id: number;
  subjectId: number;
  unitId?: number;
  title: string;
  description?: string;
  activityType?: string;
  author?: string;
  imageUrl?: string;
  linkUrl?: string;
  course?: string;
  oaCode?: string;
  oaDescription?: string;
  order: number;
  views: number;
  isActive?: boolean;
  subject?: Subject;
  unit?: Unit;
}

export interface PaginatedResources {
  data: Resource[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SubjectStat {
  id: number;
  name: string;
  slug: string;
  count: number;
  views: number;
  color?: string;
}

export interface GlobalStats {
  subjects: SubjectStat[];
  total: number;
  totalViews: number;
}

export interface Slide {
  id: number;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  linkUrl?: string;
  buttonText?: string;
  order: number;
  isActive: boolean;
}

export interface Suggestion {
  id: number;
  title: string;
  description?: string;
  linkUrl?: string;
  imageUrl?: string;
  teacherName?: string;
  course?: string;
  activityType?: string;
  subjectName?: string;
  subjectId?: number;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}
