// Synthetic demo data. Entirely fake and generated at runtime relative to "today"
// (nothing personal is stored in the repository). A seeded PRNG keeps it stable.

import * as store from './store.js';
import { todayISO, addDays, dow, startOfWeek, addMonths, monthKey } from './dates.js';
import {
  makeTask, makeEvent, makeRoutine, makeProject, makeSubject, makeTopic, makeMeal,
  makeTransaction, makeRecurringTx, makeMetric, uid,
} from './models.js';
import { tr } from '../i18n.js';
import { routineLogId } from './queries.js';
import { materializeRecurringTx } from './actions.js';

function rng(seed) {
  let a = seed;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export async function loadDemoData() {
  await store.resetAll();
  const R = rng(42);
  const between = (a, b) => a + R() * (b - a);
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const today = todayISO();
  const day = (n) => addDays(today, n);
  const cat = (name) => store.list('financeCategories').find((c) => c.name === name)?.id;

  // Projects / subjects
  const pAtlas = uid('prj'), pBeacon = uid('prj'), pPortfolio = uid('prj'), pPet = uid('prj');
  store.putMany('projects', [
    makeProject({ id: pAtlas, name: 'Project Atlas', area: 'Work', deadline: day(21), notes: 'Quarterly delivery. Keep the scope small and the demos regular.' }),
    makeProject({ id: pBeacon, name: 'Project Beacon', area: 'Work', deadline: day(45), notes: 'Internal tooling refresh.' }),
    makeProject({ id: pPortfolio, name: 'Portfolio refresh', area: 'Career & ML', deadline: day(30), notes: 'Pick three projects and write clear READMEs.' }),
    makeProject({ id: pPet, name: 'Image classifier pet project', area: 'Career & ML', notes: 'Small CNN baseline, then try a pretrained backbone.' }),
  ]);
  const sStats = uid('sub'), sAlgo = uid('sub');
  store.putMany('subjects', [
    makeSubject({ id: sStats, name: 'Statistics 101', notes: 'Textbook chapters 4–7 for the midterm.' }),
    makeSubject({ id: sAlgo, name: 'Intro to Algorithms', notes: 'Weekly problem sets. Office hours on Fridays.' }),
  ]);

  // Roadmap topics
  const groups = Object.fromEntries(store.list('roadmapGroups').map((g) => [g.name, g.id]));
  const topic = (g, name, status, progress, notes = '') => makeTopic({ groupId: groups[g], name, status, progress, notes });
  store.putMany('roadmapTopics', [
    topic('ML Core', 'Linear & logistic regression', 'Confident', 90),
    topic('ML Core', 'Gradient boosting', 'Practicing', 65, 'Compare with a random forest baseline.'),
    topic('ML Core', 'Model evaluation & validation', 'Practicing', 55),
    topic('Computer Vision', 'Convolutional networks', 'Learning', 40),
    topic('Computer Vision', 'Object detection', 'Not started', 0),
    topic('LLM', 'Transformers', 'Learning', 35, 'Read the original paper, then a worked implementation.'),
    topic('LLM', 'Fine-tuning basics', 'Not started', 0),
    topic('Agents', 'Tool use & planning', 'Not started', 0),
    topic('Interview Prep', 'ML system design', 'Learning', 30),
    topic('Interview Prep', 'Coding practice', 'Practicing', 50),
    topic('Job Search', 'CV / resume', 'Practicing', 70),
    topic('Job Search', 'Application tracker', 'Learning', 25),
    topic('Pet Projects', 'Image classifier', 'Learning', 30),
  ]);
  const topicBy = (name) => store.list('roadmapTopics').find((t) => t.name === name)?.id;

  // Events
  store.putMany('events', [
    makeEvent({ title: 'Team sync', area: 'Work', projectId: pAtlas, date: day(-30), startMin: 600, endMin: 630, recurrence: { type: 'weekdays' } }),
    makeEvent({ title: 'Work meeting: project planning', area: 'Work', projectId: pAtlas, date: today, startMin: 14 * 60, endMin: 15 * 60, notes: 'Agenda: milestones, risks.' }),
    makeEvent({ title: 'Statistics lecture', kind: 'class', area: 'Study', subjectId: sStats, date: day(-30), startMin: 9 * 60 + 30, endMin: 11 * 60, recurrence: { type: 'weekly', days: [2, 4] } }),
    makeEvent({ title: 'Algorithms seminar', kind: 'class', area: 'Study', subjectId: sAlgo, date: day(-30), startMin: 13 * 60, endMin: 14 * 60 + 30, recurrence: { type: 'weekly', days: [3] } }),
    makeEvent({ title: 'Dentist appointment', area: 'Personal', date: day(2), startMin: 16 * 60, endMin: 17 * 60 }),
    makeEvent({ title: 'Coffee with a friend', area: 'Personal', date: day(4), startMin: 18 * 60, endMin: 19 * 60 + 30 }),
    makeEvent({ title: 'Statistics midterm', kind: 'exam', area: 'Study', subjectId: sStats, date: day(12), startMin: 10 * 60, endMin: 12 * 60 }),
  ]);

  // Tasks: open
  const t = (p) => makeTask({ createdDate: day(-5), ...p });
  const open = [
    t({ title: 'Finish project review', area: 'Work', projectId: pAtlas, priority: 'P1', dueDate: today, durationMin: 90, energy: 'High', status: 'In progress', tags: ['review'] }),
    t({ title: 'Reply to review comments', area: 'Work', projectId: pAtlas, priority: 'P2', dueDate: today, dueTime: '17:00', durationMin: 30, status: 'Planned' }),
    t({ title: 'Submit expense report', area: 'Work', priority: 'P2', dueDate: day(-1), durationMin: 20, status: 'Planned' }),
    t({ title: 'Prepare demo outline', area: 'Work', projectId: pBeacon, priority: 'P3', dueDate: day(3), durationMin: 45, status: 'Planned' }),
    t({ title: 'ML interview prep: practice questions', area: 'Career & ML', topicId: topicBy('ML system design'), priority: 'P1', dueDate: today, scheduledDate: today, startMin: 19 * 60, endMin: 20 * 60, durationMin: 60, energy: 'High', status: 'Planned' }),
    t({ title: 'Read about transformers', area: 'Career & ML', topicId: topicBy('Transformers'), priority: 'P2', dueDate: today, durationMin: 60, status: 'Planned', tags: ['reading'] }),
    t({ title: 'Update CV', area: 'Career & ML', topicId: topicBy('CV / resume'), priority: 'P2', dueDate: day(2), durationMin: 45, status: 'Planned' }),
    t({ title: 'Review gradient boosting notes', area: 'Career & ML', priority: 'P3', dueDate: day(5), durationMin: 40, status: 'Planned', recurrence: { type: 'weekly', days: [dow(day(5))] } }),
    t({ title: 'Write README for classifier', area: 'Career & ML', projectId: pPet, priority: 'P3', durationMin: 60, status: 'Inbox' }),
    t({ title: 'Problem set 3', area: 'Study', subjectId: sAlgo, priority: 'P1', dueDate: day(1), durationMin: 120, status: 'In progress' }),
    t({ title: 'Statistics: chapter 6 exercises', area: 'Study', subjectId: sStats, priority: 'P2', dueDate: day(4), durationMin: 90, status: 'Planned' }),
    t({ title: 'Book a lab appointment', area: 'Health', priority: 'P3', dueDate: day(6), durationMin: 10, status: 'Planned' }),
    t({ title: 'Meal-prep lunches', area: 'Meals', priority: 'P3', dueDate: day(1), durationMin: 60, status: 'Planned' }),
    t({ title: 'Vacuum the living room', area: 'Home', priority: 'P3', dueDate: today, durationMin: 25, status: 'Planned' }),
    t({ title: 'Replace the hallway light bulb', area: 'Home', priority: 'P3', status: 'Inbox' }),
    t({ title: 'Renew documents', subcategory: 'Admin', area: 'Personal', priority: 'P2', dueDate: day(9), durationMin: 30, status: 'Planned' }),
    t({ title: 'Pick up a parcel', subcategory: 'Errands', area: 'Personal', priority: 'P3', dueDate: day(1), durationMin: 30, status: 'Planned' }),
    t({ title: 'Plan the weekend', subcategory: 'Social', area: 'Personal', priority: 'P3', status: 'Inbox' }),
    t({ title: 'Review monthly budget', area: 'Finance', priority: 'P2', dueDate: day(3), durationMin: 30, status: 'Planned' }),
  ];
  // Tasks: completed history for analytics
  const doneTasks = [];
  const areas = ['Work', 'Career & ML', 'Study', 'Home', 'Personal', 'Health'];
  for (let i = 45; i >= 1; i--) {
    const n = Math.floor(between(0, 4));
    for (let k = 0; k < n; k++) {
      const area = pick(areas);
      const dur = pick([20, 30, 45, 60, 90, 120]);
      doneTasks.push(makeTask({
        title: pick(['Draft summary', 'Tidy notes', 'Practice exercises', 'Plan next steps', 'Quick review', 'Prepare materials', 'Clean up files']),
        area, priority: pick(['P1', 'P2', 'P2', 'P3']), dueDate: day(-i), durationMin: dur,
        actualMin: R() < 0.6 ? Math.round(dur * between(0.6, 1.3) / 5) * 5 : null,
        status: 'Done', completedDate: day(-i), createdDate: day(-i - 2), energy: pick(['Low', 'Medium', 'High']),
      }));
    }
  }
  store.putMany('tasks', [...open, ...doneTasks]);

  // Routines + logs
  const rTread = uid('rtn'), rLinen = uid('rtn'), rVac = uid('rtn'), rBrush = uid('rtn'), rClean = uid('rtn'), rRead = uid('rtn');
  const start = day(-45);
  const routines = [
    makeRoutine({ id: rTread, title: 'Treadmill', area: 'Health', mode: 'weekly', target: 4, startDate: start }),
    makeRoutine({ id: rClean, title: 'Clean apartment', area: 'Home', mode: 'weekly', target: 2, startDate: start }),
    makeRoutine({ id: rLinen, title: 'Change bed linen', area: 'Home', mode: 'fixed', recurrence: { type: 'weekly', days: [0] }, startDate: start }),
    makeRoutine({ id: rVac, title: 'Vacuum', area: 'Home', mode: 'fixed', recurrence: { type: 'weekly', days: [3, 6] }, startDate: start }),
    makeRoutine({ id: rBrush, title: 'Wash makeup brushes', area: 'Home', mode: 'fixed', recurrence: { type: 'interval', every: 14 }, startDate: start }),
    makeRoutine({ id: rRead, title: 'Evening reading', area: 'Personal', mode: 'fixed', recurrence: { type: 'daily' }, startMin: 21 * 60 + 30, durationMin: 30, startDate: start }),
  ];
  store.putMany('routines', routines);
  const logs = [];
  for (let i = 45; i >= 0; i--) {
    const d = day(-i);
    const log = (id) => logs.push({ id: routineLogId(id, d), routineId: id, date: d });
    if (R() < 0.5) log(rTread);
    if (R() < 0.3) log(rClean);
    if (dow(d) === 0 && R() < 0.85) log(rLinen);
    if ((dow(d) === 3 || dow(d) === 6) && R() < 0.75) log(rVac);
    if (R() < 0.6 && i > 0) log(rRead);
  }
  store.putMany('routineLogs', logs);

  // Custom metrics
  const mMed = uid('met'), mRead = uid('met');
  store.putMany('customMetrics', [
    makeMetric({ id: mMed, name: 'Meditation', type: 'boolean' }),
    makeMetric({ id: mRead, name: 'Pages read', type: 'number', unit: 'pages' }),
  ]);

  // Health: 60 days, with mild structure (sleep influences mood/energy; coffee nudges bedtime).
  const health = [];
  let weight = 68.4;
  for (let i = 60; i >= 0; i--) {
    const d = day(-i);
    if (i !== 0 && R() < 0.12) continue; // a few gaps are realistic
    weight += between(-0.25, 0.22) - 0.01;
    const coffee = Math.floor(between(0, 4.5));
    const bed = Math.round((23 * 60 + between(-50, 100) + coffee * 8) / 5) * 5; // minutes from midnight (may exceed 1440)
    const sleepMin = Math.round(Math.max(330, Math.min(600, between(400, 500) - (bed - 1410) * 0.25)) / 5) * 5;
    const wake = bed + sleepMin;
    const sleepQ = (sleepMin - 420) / 60;
    const clamp = (v) => Math.max(1, Math.min(10, Math.round(v)));
    const active = R() < 0.5;
    const mood = clamp(6 + sleepQ * 1.2 + between(-1.5, 1.5));
    health.push({
      id: d, date: d, weight: Math.round(weight * 10) / 10,
      bedtimeMin: bed % 1440, wakeMin: wake % 1440, sleepMin, coffee,
      activity: active ? pick(['Treadmill', 'Walk', 'Yoga', 'Cycling']) : null,
      activityMin: active ? pick([25, 30, 40, 55]) : null,
      steps: R() < 0.6 ? Math.round(between(3500, 11000) / 100) * 100 : null,
      mood, energy: clamp(5.5 + sleepQ * 1.4 + between(-1.5, 1.5)), stress: clamp(5 - sleepQ * 0.8 + between(-2, 2)),
      productivity: clamp(mood * 0.6 + 2.5 + between(-1.5, 1.5)), wellbeing: clamp(mood * 0.7 + 2 + between(-1, 1)),
      symptoms: '', notes: '',
      custom: { [mMed]: R() < 0.55, ...(R() < 0.7 ? { [mRead]: Math.round(between(5, 45)) } : {}) },
    });
  }
  store.putMany('healthEntries', health);

  // Meals (last 6 days)
  const meals = [];
  const menu = {
    Breakfast: ['Oatmeal with berries', 'Scrambled eggs and toast', 'Yoghurt and granola'],
    Lunch: ['Chicken salad bowl', 'Vegetable soup and bread', 'Pasta with tomato sauce'],
    Dinner: ['Baked salmon with rice', 'Veggie stir-fry', 'Homemade pizza'],
    Snack: ['Apple and nuts', 'Chocolate bar', 'Cappuccino and cookie'],
  };
  for (let i = 0; i < 6; i++) {
    for (const [type, time] of [['Breakfast', '08:15'], ['Lunch', '13:00'], ['Dinner', '19:30'], ['Snack', '16:30']]) {
      if (type === 'Snack' && R() < 0.4) continue;
      const desc = pick(menu[type]);
      const tags = [];
      if (/Cappuccino|coffee/i.test(desc)) tags.push('coffee');
      if (/Chocolate|cookie/i.test(desc)) tags.push('sweet');
      if (type !== 'Snack') tags.push(R() < 0.75 ? 'home-cooked' : 'restaurant');
      meals.push(makeMeal({ date: day(-i), time, type, description: desc, tags }));
    }
  }
  store.putMany('meals', meals);

  // Finance: 3 months
  const txs = [];
  for (let m = 2; m >= 0; m--) {
    const first = `${addMonths(monthKey(today), -m)}-01`;
    txs.push(makeTransaction({ date: first, type: 'income', amount: 150000, categoryId: null, description: 'Monthly income' }));
    txs.push(makeTransaction({ date: first, type: 'expense', amount: 42000, categoryId: cat('Rent'), description: 'Rent', recurring: true }));
    txs.push(makeTransaction({ date: first, type: 'savings', amount: 20000, description: 'Monthly savings' }));
  }
  const spend = [['Groceries', 400, 3200], ['Cafes & Restaurants', 500, 2800], ['Transport', 150, 900], ['Household', 300, 2500], ['Entertainment', 400, 3000], ['Beauty', 500, 3500], ['Health', 600, 4000], ['Clothing', 1500, 6500]];
  for (let i = 59; i >= 0; i--) {
    if (R() < 0.45) continue;
    const [name, lo, hi] = pick(spend);
    txs.push(makeTransaction({ date: day(-i), type: 'expense', amount: Math.round(between(lo, hi) / 10) * 10, categoryId: cat(name), description: name === 'Groceries' ? 'Grocery expense' : name }));
  }
  txs.push(makeTransaction({ date: day(-3), type: 'expense', amount: 1900, categoryId: cat('Utilities'), description: 'Utilities' }));
  store.putMany('transactions', txs);
  store.put('recurringTransactions', makeRecurringTx({
    type: 'expense', amount: 599, categoryId: cat('Subscriptions'), description: 'Streaming subscription (demo)', frequency: 'monthly',
    startDate: addDays(today, -62), lastGenerated: null,
  }));
  materializeRecurringTx();

  const weekKey = startOfWeek(today, store.getSettings().weekStart);
  store.updateSettings({
    demo: true, onboarded: true, monthlyBudget: 90000,
    weeklyGoals: { [weekKey]: tr('Get back into a stable rhythm.') },
  });
  // Category limits for a few categories
  for (const [name, limit] of [['Groceries', 18000], ['Cafes & Restaurants', 10000], ['Entertainment', 6000]]) {
    const c = store.list('financeCategories').find((x) => x.name === name);
    if (c) store.put('financeCategories', { ...c, limit });
  }
}

