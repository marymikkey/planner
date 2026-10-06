// Domain constants and record factories.
//
// Every persisted record has: id (string), createdAt, updatedAt (ISO datetime).
// updatedAt is maintained by the store and is what a future sync layer
// (e.g. Supabase) can use for last-write-wins merging.

export const SCHEMA_VERSION = 1;

// IndexedDB object stores / export keys. 'settings' is handled separately.
export const STORE_NAMES = [
  'tasks', 'events', 'routines', 'routineLogs', 'projects',
  'roadmapGroups', 'roadmapTopics', 'subjects', 'healthEntries',
  'meals', 'transactions', 'recurringTransactions', 'financeCategories', 'customMetrics',
];

export const AREAS = ['Work', 'Career & ML', 'Study', 'Health', 'Meals', 'Home', 'Personal', 'Finance'];

export const AREA_META = {
  'Work':        { slug: 'work',     icon: 'work',     color: '#3a62b0' },
  'Career & ML': { slug: 'career',   icon: 'career',   color: '#1f9a73' },
  'Study':       { slug: 'study',    icon: 'study',    color: '#7a55cf' },
  'Health':      { slug: 'health',   icon: 'health',   color: '#d9587a' },
  'Meals':       { slug: 'meals',    icon: 'meals',    color: '#e0662f' },
  'Home':        { slug: 'home',     icon: 'home',     color: '#cf9a2b' },
  'Personal':    { slug: 'personal', icon: 'personal', color: '#a8449a' },
  'Finance':     { slug: 'finance',  icon: 'finance',  color: '#b8860b' },
};

export const PRIORITIES = ['P1', 'P2', 'P3'];
export const ENERGY = ['Low', 'Medium', 'High'];
export const STATUSES = ['Inbox', 'Planned', 'In progress', 'Done', 'Skipped'];
export const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Other'];
export const TOPIC_STATUSES = ['Not started', 'Learning', 'Practicing', 'Confident'];
export const METRIC_TYPES = ['boolean', 'number', 'scale', 'category', 'text'];

export const DEFAULT_PERSONAL_CATEGORIES = ['Social', 'Appointments', 'Errands', 'Admin', 'Other'];
export const DEFAULT_MEAL_TAGS = ['coffee', 'sweet', 'fast food', 'home-cooked', 'restaurant', 'late meal'];

// Note: intentionally generic. Anything personal (a specific medication, etc.)
// can be added as a custom category in Settings and never lives in the repo.
export const DEFAULT_FINANCE_CATEGORIES = [
  'Rent', 'Utilities', 'Groceries', 'Cafes & Restaurants', 'Transport', 'Mobile',
  'Subscriptions', 'Clothing', 'Beauty', 'Household', 'Health', 'Medication', 'Labs',
  'Doctors', 'Gifts', 'Education', 'Taxes & Fees', 'Entertainment', 'Other',
];

export const DEFAULT_ROADMAP_GROUPS = [
  'ML Core', 'Computer Vision', 'LLM', 'Agents', 'Interview Prep', 'Job Search', 'Pet Projects',
];

export const CURRENCIES = {
  RUB: '₽', USD: '$', EUR: '€', GBP: '£', UAH: '₴', KZT: '₸', TRY: '₺', JPY: '¥', CNY: '¥', INR: '₹', PLN: 'zł', CHF: 'CHF',
};

export const DEFAULT_SETTINGS = {
  language: 'ru',             // ru | en
  theme: 'system',            // light | dark | system
  dayStartMin: 5 * 60,        // 05:00
  dayEndMin: 25 * 60,         // 01:00 next day
  weekStart: 1,               // Monday
  macros: false,
  currency: 'RUB',
  areaColors: {},
  personalCategories: DEFAULT_PERSONAL_CATEGORIES,
  mealTags: DEFAULT_MEAL_TAGS,
  weeklyGoals: {},            // { 'YYYY-MM-DD' (week start): 'text' }
  monthlyBudget: 0,
  activityTarget: 4,          // active days per week shown in Momentum
  demo: false,
  onboarded: false,
  seeded: false,
  lastArea: 'Work',
};

export const areaColor = (area, settings) =>
  settings?.areaColors?.[area] || AREA_META[area]?.color || '#777';

export const uid = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// ---- Record factories (defaults live here, in one place) -------------------

export const makeTask = (p = {}) => ({
  title: '', notes: '', area: 'Personal', projectId: null, subjectId: null, topicId: null,
  subcategory: null, priority: 'P2', dueDate: null, dueTime: null, durationMin: null, actualMin: null,
  energy: 'Medium', status: 'Inbox', tags: [],
  scheduledDate: null, startMin: null, endMin: null,
  recurrence: { type: 'none' }, createdDate: null, completedDate: null,
  ...p,
});

// kind: 'event' | 'class' | 'exam'. Recurrence allows weekly classes etc.
// exceptions: dates on which a recurring event is skipped ("clear day").
export const makeEvent = (p = {}) => ({
  title: '', kind: 'event', area: 'Work', projectId: null, subjectId: null, notes: '',
  date: null, startMin: 10 * 60, endMin: 11 * 60, recurrence: { type: 'none' }, exceptions: [],
  ...p,
});

// mode 'fixed'  -> follows recurrence (every Sunday, weekdays, every N days)
// mode 'weekly' -> flexible weekly goal: `target` times per week on any days
export const makeRoutine = (p = {}) => ({
  title: '', area: 'Home', mode: 'fixed', recurrence: { type: 'daily' }, target: 3,
  startMin: null, durationMin: null, notes: '', archived: false, exceptions: [], startDate: null,
  ...p,
});

export const makeProject = (p = {}) => ({
  name: '', area: 'Work', notes: '', deadline: null, archived: false, ...p,
});

export const makeSubject = (p = {}) => ({ name: '', notes: '', archived: false, ...p });

export const makeGroup = (p = {}) => ({ name: '', order: 0, ...p });
export const makeTopic = (p = {}) => ({
  groupId: null, name: '', status: 'Not started', progress: 0, notes: '', resources: [], ...p,
});

export const makeMeal = (p = {}) => ({
  date: null, time: null, type: 'Other', description: '', tags: [],
  calories: null, protein: null, fat: null, carbs: null, ...p,
});

// type: 'expense' | 'income' | 'savings'
export const makeTransaction = (p = {}) => ({
  date: null, type: 'expense', amount: 0, categoryId: null, description: '',
  recurring: false, note: '', templateId: null, ...p,
});

// Recurring transaction template; real transactions are generated from it up to today.
export const makeRecurringTx = (p = {}) => ({
  type: 'expense', amount: 0, categoryId: null, description: '', note: '',
  frequency: 'monthly', startDate: null, lastGenerated: null, active: true, ...p,
});

export const makeMetric = (p = {}) => ({
  name: '', type: 'number', options: [], unit: '', archived: false, ...p,
});
