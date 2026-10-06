// Lightweight UI translation layer (English source strings -> Russian).
//
// Why a DOM-level layer instead of t('key') calls everywhere? Stored data and logic use
// stable English identifiers (areas, statuses, priorities, default category names), so
// translating at display time keeps the data model language-neutral and means exports /
// imports / future sync never depend on the UI language. Exact strings are looked up in
// RU; dynamic strings ("3 open", "Due Today") go through PATTERNS. A MutationObserver
// translates anything rendered later (views, sheets, toasts, chart labels).
// To add a language: add another dictionary + patterns and extend `tr`.

let current = 'ru';
export const lang = () => current;
export const isRu = () => current === 'ru';
export const setLang = (l) => { current = l === 'en' ? 'en' : 'ru'; };
export const locale = () => (current === 'ru' ? 'ru-RU' : 'en-GB');

export const plural = (n, [one, few, many]) => {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  return b === 1 ? one : many;
};

const RU = {
  // navigation & areas
  'Today': 'Сегодня', 'Planner': 'Планер', 'Work': 'Работа', 'Career & ML': 'Карьера и ML', 'Study': 'Учёба', 'Health': 'Здоровье',
  'Meals': 'Питание', 'Home': 'Дом', 'Personal': 'Личное', 'Finance': 'Финансы', 'Analytics': 'Аналитика', 'Settings': 'Настройки',
  'More': 'Ещё', 'All sections': 'Все разделы', 'Skip to content': 'Перейти к содержимому', 'Sidebar': 'Боковая панель', 'Main': 'Главная навигация', 'Primary': 'Основная навигация',
  'Quick add': 'Быстро добавить', 'Quick add (n)': 'Быстро добавить (клавиша n)', 'What to add': 'Что добавить',
  // statuses, priorities, enums
  'Inbox': 'Входящие', 'Planned': 'Запланировано', 'In progress': 'В процессе', 'Done': 'Готово', 'Skipped': 'Пропущено',
  'Low': 'Низкая', 'Medium': 'Средняя', 'High': 'Высокая', 'Energy needed': 'Нужная энергия',
  'Breakfast': 'Завтрак', 'Lunch': 'Обед', 'Dinner': 'Ужин', 'Snack': 'Перекус', 'Other': 'Другое',
  'Not started': 'Не начато', 'Learning': 'Изучаю', 'Practicing': 'Практикую', 'Confident': 'Уверенно',
  'Social': 'Общение', 'Appointments': 'Встречи и приёмы', 'Errands': 'Поручения', 'Admin': 'Бумажные дела',
  'coffee': 'кофе', 'sweet': 'сладкое', 'fast food': 'фастфуд', 'home-cooked': 'домашняя еда', 'restaurant': 'ресторан', 'late meal': 'поздний приём',
  'Rent': 'Аренда', 'Utilities': 'Коммунальные услуги', 'Groceries': 'Продукты', 'Cafes & Restaurants': 'Кафе и рестораны', 'Transport': 'Транспорт',
  'Mobile': 'Связь', 'Subscriptions': 'Подписки', 'Clothing': 'Одежда', 'Beauty': 'Красота', 'Household': 'Хозяйство', 'Medication': 'Лекарства',
  'Labs': 'Анализы', 'Doctors': 'Врачи', 'Gifts': 'Подарки', 'Education': 'Образование', 'Taxes & Fees': 'Налоги и сборы', 'Entertainment': 'Развлечения',
  'ML Core': 'Основы ML', 'Computer Vision': 'Компьютерное зрение', 'LLM': 'LLM', 'Agents': 'Агенты', 'Interview Prep': 'Подготовка к собеседованиям',
  'Job Search': 'Поиск работы', 'Pet Projects': 'Личные проекты',
  'Sun': 'Вс', 'Mon': 'Пн', 'Tue': 'Вт', 'Wed': 'Ср', 'Thu': 'Чт', 'Fri': 'Пт', 'Sat': 'Сб',
  'Sunday': 'Воскресенье', 'Monday': 'Понедельник', 'Tuesday': 'Вторник', 'Wednesday': 'Среда', 'Thursday': 'Четверг', 'Friday': 'Пятница', 'Saturday': 'Суббота',
  'Yesterday': 'Вчера', 'Tomorrow': 'Завтра',
  // generic UI
  'Add': 'Добавить', 'Edit': 'Изменить', 'Delete': 'Удалить', 'Cancel': 'Отмена', 'Save': 'Сохранить', 'Close': 'Закрыть', 'Back': 'Назад', 'Undo': 'Отменить',
  'Duplicate': 'Дублировать', 'Skip': 'Пропустить', 'Restore': 'Вернуть', 'Reload': 'Перезагрузить', 'Pause': 'Пауза', 'Resume': 'Возобновить', 'Stop': 'Остановить',
  'Previous': 'Назад', 'Next': 'Вперёд', 'Day': 'День', 'Week': 'Неделя', 'View': 'Вид', 'Date': 'Дата', 'Time': 'Время', 'Type': 'Тип', 'Name': 'Название',
  'Title': 'Название', 'Notes': 'Заметки', 'Note': 'Заметка', 'Area': 'Раздел', 'Project': 'Проект', 'Course': 'Курс', 'Category': 'Категория', 'Group': 'Группа',
  'General': 'Общее', 'None': 'Нет', 'All': 'Все', 'Free': 'Свободно', 'Yes': 'Да', 'Yes / No': 'Да / Нет', 'Number': 'Число', 'Text': 'Текст', 'Scale 1–10': 'Шкала 1–10',
  'Priority': 'Приоритет', 'Status': 'Статус', 'Tags': 'Теги', 'Duration': 'Длительность', 'Due date': 'Срок', 'Due time': 'Время срока',
  'Start': 'Начало', 'End': 'Конец', 'Starts': 'Начало', 'Ends': 'Конец', 'Repeat': 'Повтор', 'Repeats': 'Повторяется', 'Recurrence': 'Повторение', 'Style': 'Тип',
  'More options': 'Дополнительно', 'Time block (optional)': 'Блок времени (необязательно)', 'Actual time spent': 'Фактически потрачено',
  'Optional. Used for Planned vs Actual in Analytics.': 'Необязательно. Используется в аналитике «план / факт».',
  'Add a title': 'Укажите название', 'Add a name': 'Укажите название', 'Enter an amount': 'Введите сумму', 'Describe the meal': 'Опишите приём пищи',
  'What needs doing?': 'Что нужно сделать?', 'comma, separated': 'через запятую', 'comma, separated options': 'варианты через запятую',
  'Are you sure?': 'Вы уверены?', 'Something went wrong': 'Что-то пошло не так', 'Couldn’t start the app': 'Не удалось запустить приложение',
  'Nothing here.': 'Здесь пока пусто.', 'None yet.': 'Пока ничего.', 'Choose': 'Выбрать', 'Options': 'Варианты', 'Rating': 'Оценка', 'Value': 'Значение',
  '+ custom': '+ своё', 'Add custom tag': 'Добавить свой тег', 'Every': 'Каждые', 'days': 'дн.', 'Weekly on selected days': 'По выбранным дням недели', 'Every N days': 'Каждые N дней',
  'Monthly': 'Ежемесячно', 'Does not repeat': 'Не повторяется', 'Every day': 'Каждый день', 'Every weekday': 'По будням', 'Every week': 'Каждую неделю', 'Every month': 'Каждый месяц',
  'min': 'мин', 'kg': 'кг', 'kcal': 'ккал', 'g': 'г', 'pages': 'стр.', 'cups of coffee': 'чашек кофе', 'times per week': 'раз в неделю',
  // today
  'Weekly goal': 'Цель недели', 'Set a goal for this week…': 'Поставьте цель на эту неделю…', 'Today’s tasks': 'Задачи на сегодня', 'Add a task for today…': 'Добавить задачу на сегодня…',
  'All clear for today. Nicely done.': 'На сегодня всё сделано. Отлично!', 'No tasks for today yet. Add one above, or pull something in from the Planner.': 'Задач на сегодня пока нет. Добавьте выше или возьмите что-нибудь из планера.',
  'Schedule': 'Расписание', 'Event': 'Событие', 'Today’s status': 'Состояние сегодня', 'Check in': 'Отметить', 'Edit check-in': 'Изменить отметку',
  'Sleep': 'Сон', 'Weight': 'Вес', 'Activity': 'Активность', 'Routines': 'Рутины', 'Flexible goals and fixed habits — no pressure.': 'Гибкие цели и постоянные привычки — без давления.',
  'No routines yet. Add one with the + button.': 'Рутин пока нет. Добавьте через кнопку +.', 'This week': 'Эта неделя', 'Momentum, not scorekeeping.': 'Импульс, а не подсчёт баллов.',
  'Home routines': 'Домашние рутины', 'Average sleep': 'Средний сон', 'Tasks completed': 'Выполнено задач', 'Career & ML:': 'Карьера и ML:',
  'Demo mode — everything you see is fictional.': 'Демо-режим — все данные вымышлены.', 'Exit demo & start fresh': 'Выйти из демо и начать с чистого листа',
  'Clear demo data and start with an empty planner?': 'Удалить демо-данные и начать с пустого планера?', 'Clear and start fresh': 'Удалить и начать заново', 'Leave demo mode': 'Выход из демо-режима',
  'Welcome': 'Добро пожаловать', 'A calm place to plan your days, track how you feel and see what helps. Everything stays on this device — no account, no tracking.': 'Спокойное место, чтобы планировать дни, отслеживать самочувствие и понимать, что помогает. Всё хранится только на этом устройстве — без аккаунта и слежки.',
  'You can start with a blank slate or look around with fictional demo data first.': 'Можно начать с чистого листа или сначала осмотреться на вымышленных демо-данных.',
  'Explore with demo data': 'Посмотреть на демо-данных', 'Start fresh': 'Начать с нуля', 'Demo data loaded': 'Демо-данные загружены', 'Update ready — reload to apply.': 'Доступно обновление — перезагрузите страницу.',
  // planner
  'Day options': 'Параметры дня', 'Clear this day': 'Очистить этот день', 'Clear day': 'Очистить день', 'Day cleared': 'День очищен', 'Add event': 'Добавить событие',
  'Remove time blocks and one-off events from this day? Tasks stay in your lists, and recurring events and routines are kept.': 'Убрать с этого дня блоки времени и разовые события? Задачи останутся в списках, повторяющиеся события и рутины сохранятся.',
  'Unscheduled': 'Без времени', 'Drag onto the timeline to block time.': 'Перетащите на шкалу времени, чтобы выделить время.', 'Everything for this day has a time.': 'Всё на этот день уже стоит в расписании.',
  'Not planned yet.': 'Пока не запланировано.', 'Inbox is empty.': 'Входящие пусты.', 'Weekly goals': 'Недельные цели', 'Do them on whichever days suit you.': 'Выполняйте в любые удобные дни.',
  'Drag a task onto a day to plan it.': 'Перетащите задачу на день, чтобы запланировать.', 'Nothing scheduled. Drag a task onto the timeline to block time.': 'Ничего не запланировано. Перетащите задачу на шкалу времени.',
  'Mark done': 'Отметить выполненным', 'Mark not done': 'Снять отметку', 'Drag to resize': 'Потяните, чтобы изменить длительность', 'Drag to schedule': 'Перетащите, чтобы запланировать',
  'Carried over': 'Перенесено', 'Do today': 'Сделать сегодня', 'Postpone to tomorrow': 'Отложить на завтра', 'Moved to tomorrow': 'Перенесено на завтра', 'Reschedule to a date…': 'Перенести на дату…',
  'Reschedule': 'Перенести', 'Move here': 'Перенести сюда', 'Remove time block': 'Убрать блок времени', 'Move to Inbox': 'Во входящие', 'Duplicated': 'Продублировано',
  'Delete this task?': 'Удалить задачу?', 'Task deleted': 'Задача удалена', 'Add a task…': 'Добавить задачу…', 'Progress': 'Прогресс',
  // forms
  'New task': 'Новая задача', 'Edit task': 'Изменить задачу', 'Task': 'Задача', 'Routine': 'Рутина', 'Expense': 'Расход', 'Income': 'Доход', 'Savings': 'Накопления',
  'Meal': 'Приём пищи', 'Transaction': 'Операция', 'Check-in': 'Отметка', 'Metric': 'Метрика', 'Topic': 'Тема',
  'Class name': 'Название занятия', 'Exam or test': 'Экзамен или зачёт', 'Meeting, appointment…': 'Встреча, приём…', 'e.g. Treadmill, Vacuum…': 'например: беговая дорожка, пылесос…',
  'Fixed schedule': 'По расписанию', 'Routine style': 'Тип рутины', 'Times per week': 'Раз в неделю', 'Any days you like — no fixed weekdays needed.': 'В любые дни — привязка к дням недели не нужна.',
  'Time (optional)': 'Время (необязательно)', 'New routine': 'Новая рутина', 'Edit routine': 'Изменить рутину', 'Description': 'Описание', 'One-time': 'Разово',
  'Repeats monthly': 'Повторять каждый месяц', 'Repeats weekly': 'Повторять каждую неделю', 'Optional note': 'Необязательная заметка', 'Amount': 'Сумма',
  'New transaction': 'Новая операция', 'Edit transaction': 'Изменить операцию', 'What did you eat?': 'Что вы ели?', 'Calories': 'Калории', 'Protein': 'Белки', 'Fat': 'Жиры', 'Carbs': 'Углеводы',
  'Log a meal': 'Записать приём пищи', 'Edit meal': 'Изменить приём пищи', 'Wake time': 'Время пробуждения', 'Bedtime': 'Время отхода ко сну', 'Coffee': 'Кофе', 'Steps': 'Шаги',
  'e.g. Walk, Treadmill': 'например: прогулка, дорожка', 'Anything worth remembering': 'Всё, что стоит запомнить', 'How did the day feel? (1–10, optional)': 'Как прошёл день? (1–10, по желанию)',
  'Mood': 'Настроение', 'Energy': 'Энергия', 'Stress': 'Стресс', 'Productivity': 'Продуктивность', 'Overall wellbeing': 'Общее самочувствие', 'Custom metrics': 'Свои метрики',
  'Symptoms': 'Симптомы', 'A lightweight wellbeing log — not medical advice.': 'Лёгкий дневник самочувствия — не медицинская рекомендация.', 'Save check-in': 'Сохранить отметку',
  'Nothing to save yet — fill in anything you like.': 'Пока нечего сохранять — заполните что угодно.', 'Project name': 'Название проекта', 'New project': 'Новый проект', 'Edit project': 'Изменить проект',
  'Deadline': 'Дедлайн', 'Course name': 'Название курса', 'New course': 'Новый курс', 'Edit course': 'Изменить курс', 'Group name': 'Название группы', 'New roadmap group': 'Новая группа роадмапа',
  'Edit group': 'Изменить группу', 'Resources': 'Ресурсы', 'Related tasks': 'Связанные задачи', 'Add related task': 'Добавить связанную задачу', 'One resource per line (title or link)': 'Один ресурс на строку (название или ссылка)',
  'New topic': 'Новая тема', 'Edit topic': 'Изменить тему', 'Metric name': 'Название метрики', 'e.g. pages, glasses': 'например: страницы, стаканы', 'Unit': 'Единица', 'New custom metric': 'Новая метрика',
  'Edit metric': 'Изменить метрику', 'Category name': 'Название категории', 'no limit': 'без лимита', 'New category': 'Новая категория', 'Edit category': 'Изменить категорию', 'Monthly limit': 'Месячный лимит',
  'Quick add:': 'Быстро добавить:',
  // work / career / study / home / personal
  'Projects, deadlines and meetings.': 'Проекты, дедлайны и встречи.', 'All open work tasks': 'Все открытые рабочие задачи', 'Nothing open. Enjoy the quiet.': 'Ничего не открыто. Наслаждайтесь тишиной.',
  'No tasks yet': 'Задач пока нет', 'Tasks that don’t belong to a project.': 'Задачи вне проектов.', 'No projects yet.': 'Проектов пока нет.', 'That project no longer exists.': 'Этот проект больше не существует.',
  'Project notes…': 'Заметки по проекту…', 'Project notes': 'Заметки по проекту', 'Project progress': 'Прогресс проекта', 'Add tasks to see progress.': 'Добавьте задачи, чтобы увидеть прогресс.',
  'Meetings': 'Встречи', 'No upcoming meetings.': 'Ближайших встреч нет.', 'Tasks': 'Задачи', 'Projects': 'Проекты', 'Roadmap': 'Роадмап', 'Career sections': 'Разделы карьеры',
  'Skills, interviews, CV, job search and pet projects.': 'Навыки, собеседования, резюме, поиск работы и личные проекты.', 'Add a career task…': 'Добавить карьерную задачу…', 'No open tasks.': 'Открытых задач нет.',
  'Recently completed': 'Недавно выполнено', 'No topics yet': 'Тем пока нет', 'Add the first topic for this area.': 'Добавьте первую тему для этой группы.', 'Add group': 'Добавить группу', 'New project:': 'Новый проект:',
  'Courses, classes, assignments and exams.': 'Курсы, занятия, задания и экзамены.', 'Class': 'Занятие', 'Exam': 'Экзамен', 'Courses': 'Курсы', 'That course no longer exists.': 'Этот курс больше не существует.',
  'Add a course to organise classes and assignments.': 'Добавьте курс, чтобы вести занятия и задания.', 'Assignments & deadlines': 'Задания и дедлайны', 'Add an assignment…': 'Добавить задание…',
  'No open assignments.': 'Открытых заданий нет.', 'Exams & tests': 'Экзамены и зачёты', 'No upcoming exams.': 'Ближайших экзаменов нет.', 'Classes': 'Занятия', 'These appear automatically in Today and Planner.': 'Они автоматически появляются на экране «Сегодня» и в планере.',
  'No classes yet.': 'Занятий пока нет.', 'Course notes…': 'Заметки по курсу…', 'Course notes': 'Заметки по курсу',
  'Household routines and one-time chores.': 'Домашние рутины и разовые дела.', 'Routines this week': 'Рутины на этой неделе', 'Add a routine to get started.': 'Добавьте рутину, чтобы начать.',
  'Weekly routine completion': 'Выполнение рутин за неделю', 'No routines yet. Try “Vacuum”, “Change bed linen”…': 'Рутин пока нет. Попробуйте «Пылесос», «Сменить бельё»…', 'Chores': 'Дела по дому', 'Add a chore…': 'Добавить дело…',
  'No open chores.': 'Открытых дел нет.', 'Recently done': 'Недавно сделано', 'New routine:': 'Новая рутина:',
  'Social, appointments, errands, admin.': 'Общение, встречи, поручения, бумажные дела.', 'Appointment': 'Встреча', 'Category filter': 'Фильтр категорий', 'Add a personal task': 'Добавить личную задачу',
  'Upcoming appointments & plans': 'Ближайшие встречи и планы', 'Nothing on the calendar.': 'В календаре ничего нет.',
  // health / meals
  'A gentle log for sleep, mood and habits. Not medical advice.': 'Спокойный дневник сна, настроения и привычек. Не медицинская рекомендация.', 'Other day…': 'Другой день…', 'Check-in for…': 'Отметка за…',
  'Edit today’s check-in': 'Изменить сегодняшнюю отметку', 'Fill in only what you like — one number is a complete check-in.': 'Заполняйте только то, что хочется — одного числа достаточно.',
  'No check-in yet today. Weight alone is enough.': 'Сегодня отметки пока нет. Достаточно одного веса.', 'Sleep (hours)': 'Сон (часы)', 'Mood & energy': 'Настроение и энергия', 'Mood (7d)': 'Настроение (7 дн.)', 'Energy (7d)': 'Энергия (7 дн.)',
  'Recent check-ins': 'Последние отметки', 'Notes only': 'Только заметки', 'Your check-ins will appear here.': 'Здесь появятся ваши отметки.', 'Track anything — they stay private to your device.': 'Отслеживайте что угодно — данные остаются на вашем устройстве.',
  'Add metric': 'Добавить метрику', 'No custom metrics yet.': 'Своих метрик пока нет.', 'More charts and correlations live in': 'Больше графиков и корреляций — в разделе', 'What you ate, no counting required.': 'Что вы ели — без подсчёта калорий.',
  'Previous day': 'Предыдущий день', 'Next day': 'Следующий день', 'Nothing logged for this day.': 'За этот день ничего не записано.', 'Last 7 days': 'Последние 7 дней', 'No meals in this window.': 'За этот период приёмов пищи нет.',
  // finance
  'Income, spending and savings at a glance.': 'Доходы, расходы и накопления одним взглядом.', 'Add transaction': 'Добавить операцию', 'Previous month': 'Предыдущий месяц', 'This month': 'Этот месяц', 'Next month': 'Следующий месяц',
  'Set budget': 'Задать бюджет', 'Monthly budget': 'Бюджет на месяц', 'Expenses': 'Расходы', 'Left in budget': 'Остаток бюджета', 'Past the plan this month': 'Выше плана в этом месяце', 'Set a monthly budget below': 'Задайте бюджет ниже',
  'Budget used': 'Бюджет использован', 'Where it went': 'Куда ушли деньги', 'No spending recorded this month.': 'В этом месяце расходов нет.', 'Transactions': 'Операции', 'No transactions this month.': 'В этом месяце операций нет.',
  'Recurring': 'Регулярные', 'Generated automatically on schedule.': 'Создаются автоматически по расписанию.', 'Stop this recurring item? Past transactions are kept.': 'Остановить регулярную операцию? Прошлые операции сохранятся.',
  'Add a transaction and choose “Repeats monthly” to automate it.': 'Добавьте операцию и выберите «Повторять каждый месяц», чтобы автоматизировать.', 'Categories': 'Категории', 'Rename, set monthly limits, or archive.': 'Переименовывайте, задавайте месячные лимиты или архивируйте.',
  'Uncategorised': 'Без категории', 'recurring': 'регулярная', 'Spending': 'Траты',
  // analytics
  'What your data shows, without judgement.': 'Что показывают ваши данные — без оценок.', 'Range': 'Период', 'Daily': 'По дням', 'Weekly': 'По неделям', 'Granularity': 'Детализация', '7-day average': 'Среднее за 7 дней',
  'Activity (minutes)': 'Активность (минуты)', 'Coffee (cups)': 'Кофе (чашки)', 'Planned vs completed tasks': 'Запланированные и выполненные задачи', 'Planned vs completed tasks per week': 'Запланированные и выполненные задачи по неделям',
  'Per week. Plans change — this is just a picture of how it went.': 'По неделям. Планы меняются — это просто картина того, как всё прошло.', 'Completed': 'Выполнено', 'Time by area': 'Время по разделам',
  'Planned duration vs the actual time you logged. Differences are information, not failure.': 'Плановая длительность и фактически записанное время. Разница — это информация, а не провал.',
  'Add durations to tasks to see time by area.': 'Добавьте длительности к задачам, чтобы увидеть время по разделам.', 'Actual only includes tasks where you entered the time spent (open a task → “Actual time spent”).': 'Факт учитывает только задачи, где вы указали потраченное время (задача → «Фактически потрачено»).',
  'Same day': 'В тот же день', '+1 day': '+1 день', '+2 days': '+2 дня', 'Lag': 'Сдвиг', 'Spearman ρ': 'Спирмен ρ', 'Days compared': 'Сравнено дней', 'Correlation explorer': 'Исследователь корреляций',
  'Pick two metrics to look for loose patterns in your own data.': 'Выберите две метрики, чтобы поискать закономерности в своих данных.', 'Metric X': 'Метрика X', 'Metric Y (compared with X)': 'Метрика Y (сравнивается с X)',
  'Correlation does not imply causation.': 'Корреляция не означает причинно-следственную связь.', 'No clear association': 'Явной связи не видно', 'No data in this range yet.': 'За этот период данных пока нет.', 'No overlapping data.': 'Нет пересекающихся данных.',
  'Sleep duration': 'Длительность сна', 'Time on completed tasks': 'Время на выполненные задачи', 'Custom': 'Свои', 'Body': 'Тело', 'Mind': 'Разум', 'Life': 'Жизнь', 'Planned duration': 'Плановая длительность',
  // settings
  'Everything stays on this device.': 'Всё хранится на этом устройстве.', 'Light': 'Светлая', 'Dark': 'Тёмная', 'System': 'Системная', 'Theme': 'Тема', 'Appearance': 'Оформление', 'Language': 'Язык',
  'The timeline expands automatically if something falls outside this range.': 'Шкала времени автоматически расширяется, если что-то выходит за этот диапазон.', 'Day starts': 'День начинается', 'Day ends': 'День заканчивается',
  'An earlier time than the start means after midnight.': 'Время раньше начала означает «после полуночи».', 'Week starts': 'Неделя начинается', 'Enable calories & macros': 'Включить калории и БЖУ',
  'Off by default. When on, meals get optional calories, protein, fat and carbs fields.': 'По умолчанию выключено. Если включить, у приёмов пищи появятся необязательные поля: калории, белки, жиры, углеводы.',
  'Currency': 'Валюта', 'Categories and limits are managed on the Finance page.': 'Категории и лимиты настраиваются на странице «Финансы».', 'Customisation': 'Персонализация', 'Area colours': 'Цвета разделов', 'Reset colours': 'Сбросить цвета',
  'Personal subcategories': 'Подкатегории «Личного»', 'Add subcategory + Enter': 'Добавить подкатегорию + Enter', 'Meal tags': 'Теги питания', 'Add tag + Enter': 'Добавить тег + Enter', 'Finance categories': 'Категории финансов',
  'Manage on Finance page': 'Управлять на странице «Финансы»', 'Custom health metrics': 'Свои метрики здоровья', 'Replace my data': 'Заменить мои данные', 'Import data': 'Импорт данных', 'Import complete': 'Импорт завершён',
  'Importing replaces everything currently stored on this device with the contents of the file. Export a backup first if unsure.': 'Импорт заменит всё, что сейчас хранится на устройстве, содержимым файла. Если не уверены — сначала сделайте резервную копию.',
  'Data': 'Данные', 'Stored in this browser (IndexedDB). Nothing is sent anywhere.': 'Хранится в этом браузере (IndexedDB). Ничего никуда не отправляется.',
  'Storage is unavailable in this browser mode, so data will not persist after closing. Export regularly.': 'В этом режиме браузера хранилище недоступно — данные не сохранятся после закрытия. Делайте экспорт.',
  'You are viewing synthetic demo data.': 'Сейчас показаны вымышленные демо-данные.', 'Export JSON': 'Экспорт JSON', 'Import JSON…': 'Импорт JSON…', 'CSV dataset': 'Набор данных CSV', 'Export CSV': 'Экспорт CSV',
  'Load demo data': 'Загрузить демо-данные', 'Load demo': 'Загрузить демо', 'This replaces your local data with fictional demo content. Export a backup first if you have real data.': 'Это заменит ваши локальные данные вымышленными демо-данными. Если есть настоящие данные — сначала сделайте экспорт.',
  'Reset all data': 'Сбросить все данные', 'Delete everything': 'Удалить всё', 'This permanently deletes everything stored on this device (tasks, health, finance, settings). Consider exporting a backup first.': 'Это навсегда удалит всё, что хранится на устройстве (задачи, здоровье, финансы, настройки). Лучше сначала сделать резервную копию.',
  'All local data cleared': 'Все локальные данные удалены', 'About & privacy': 'О приложении и приватности',
  'This app runs entirely in your browser. There is no account, no server and no analytics; your data never leaves this device unless you export it. It works offline once loaded and can be installed from the Share / browser menu.': 'Приложение работает целиком в браузере. Нет аккаунта, сервера и аналитики; данные не покидают устройство, пока вы сами их не экспортируете. После загрузки работает офлайн и устанавливается через меню «Поделиться» / браузера.',
  'Events & classes': 'События и занятия', 'Routines:': 'Рутины:', 'Routine completions': 'Выполнения рутин', 'Health check-ins': 'Отметки здоровья',
  'That file is not valid JSON.': 'Этот файл — не корректный JSON.', 'File is not a valid export.': 'Файл не является корректным экспортом.', 'This file was not exported from this app.': 'Этот файл экспортирован не из этого приложения.',
  'Export file has no data section.': 'В файле экспорта нет раздела данных.', 'Export was made by a newer version of the app.': 'Экспорт создан более новой версией приложения.',
  // sync
  'Stored in this browser (IndexedDB) and, encrypted, in your own cloud project.': 'Хранится в этом браузере (IndexedDB) и в зашифрованном виде — в вашем собственном облачном проекте.',
  'This app runs entirely in your browser. There is no analytics and no server of ours. Your data stays on this device unless you export it or turn on optional sync, which uploads only encrypted data to your own Supabase project. It works offline once loaded and can be installed from the Share / browser menu.': 'Приложение работает целиком в браузере. Нет аналитики и нет нашего сервера. Данные остаются на устройстве, пока вы сами не экспортируете их или не включите необязательную синхронизацию: она загружает только зашифрованные данные в ваш собственный проект Supabase. После загрузки работает офлайн и устанавливается через меню «Поделиться» / браузера.',
  'Sync': 'Синхронизация', 'Synced': 'Синхронизировано', 'Syncing…': 'Синхронизация…', 'Offline — will retry': 'Нет сети — попробую позже', 'Sync error': 'Ошибка синхронизации',
  'Sync now': 'Синхронизировать сейчас', 'Copy connection code': 'Скопировать код подключения', 'Code copied': 'Код скопирован', 'Could not copy': 'Не удалось скопировать', 'Disconnect': 'Отключить', 'Disconnect sync': 'Отключить синхронизацию',
  'Sync stops on this device. Your data stays here and in the cloud.': 'Синхронизация на этом устройстве остановится. Данные останутся и здесь, и в облаке.',
  'Data is encrypted on this device with your passphrase before it is uploaded. If you forget the passphrase, the cloud copy cannot be recovered.': 'Данные шифруются на устройстве вашей парольной фразой до отправки. Если забыть фразу, облачную копию не восстановить.',
  'Paste the code from your other device (optional)': 'Вставьте код с другого устройства (необязательно)', 'anon / publishable key': 'ключ anon / publishable', 'email': 'почта', 'Account password': 'Пароль аккаунта', 'Encryption passphrase': 'Парольная фраза шифрования',
  'Sync connected': 'Синхронизация подключена', 'Keep your phone and laptop in step. Optional and off by default.': 'Держит телефон и ноутбук в согласии. Необязательно, по умолчанию выключено.',
  'Uses your own free Supabase project (see docs/SYNC_SETUP.md). Everything is encrypted on your device before upload.': 'Использует ваш собственный бесплатный проект Supabase (см. docs/SYNC_SETUP.md). Всё шифруется на устройстве до отправки.',
  'Connection code': 'Код подключения', 'Project URL': 'Адрес проекта', 'Anon key': 'Ключ anon', 'Email': 'Почта', 'Use the same passphrase on every device. It never leaves this device.': 'Используйте одну и ту же фразу на всех устройствах. Она не покидает устройство.',
  'Sign in & connect': 'Войти и подключить', 'Create account & connect': 'Создать аккаунт и подключить', 'SQL for the Supabase project': 'SQL для проекта Supabase', 'Copy SQL': 'Скопировать SQL', 'SQL copied': 'SQL скопирован',
  'Disconnect sync first: demo data would be uploaded to your cloud.': 'Сначала отключите синхронизацию: демо-данные попали бы в ваше облако.',
  'Sync is on: this deletes your data on this device AND in the cloud (all devices). Consider exporting a backup first.': 'Синхронизация включена: данные удалятся на этом устройстве И в облаке (на всех устройствах). Лучше сначала сделать экспорт.',
  // demo content (fictional data shown in demo mode)
  'Project Atlas': 'Проект «Атлас»', 'Project Beacon': 'Проект «Маяк»', 'Portfolio refresh': 'Обновление портфолио', 'Image classifier pet project': 'Личный проект: классификатор изображений',
  'Quarterly delivery. Keep the scope small and the demos regular.': 'Квартальная поставка. Держать объём небольшим, а демо — регулярными.', 'Internal tooling refresh.': 'Обновление внутренних инструментов.',
  'Pick three projects and write clear READMEs.': 'Выбрать три проекта и написать понятные README.', 'Small CNN baseline, then try a pretrained backbone.': 'Небольшая CNN как база, затем предобученная модель.',
  'Statistics 101': 'Статистика 101', 'Intro to Algorithms': 'Введение в алгоритмы', 'Textbook chapters 4–7 for the midterm.': 'Главы 4–7 учебника к промежуточному экзамену.', 'Weekly problem sets. Office hours on Fridays.': 'Еженедельные задачи. Консультации по пятницам.',
  'Linear & logistic regression': 'Линейная и логистическая регрессия', 'Gradient boosting': 'Градиентный бустинг', 'Model evaluation & validation': 'Оценка и валидация моделей', 'Convolutional networks': 'Свёрточные сети',
  'Object detection': 'Детекция объектов', 'Transformers': 'Трансформеры', 'Fine-tuning basics': 'Основы дообучения', 'Tool use & planning': 'Использование инструментов и планирование', 'ML system design': 'Проектирование ML-систем',
  'Coding practice': 'Практика программирования', 'CV / resume': 'Резюме', 'Application tracker': 'Трекер откликов', 'Image classifier': 'Классификатор изображений', 'Compare with a random forest baseline.': 'Сравнить со случайным лесом.',
  'Read the original paper, then a worked implementation.': 'Прочитать оригинальную статью, затем разобрать реализацию.',
  'Team sync': 'Планёрка команды', 'Work meeting: project planning': 'Рабочая встреча: планирование проекта', 'Agenda: milestones, risks.': 'Повестка: вехи, риски.', 'Statistics lecture': 'Лекция по статистике',
  'Algorithms seminar': 'Семинар по алгоритмам', 'Dentist appointment': 'Приём у стоматолога', 'Coffee with a friend': 'Кофе с подругой', 'Statistics midterm': 'Промежуточный экзамен по статистике',
  'Finish project review': 'Закончить ревью проекта', 'Reply to review comments': 'Ответить на комментарии к ревью', 'Submit expense report': 'Сдать отчёт по расходам', 'Prepare demo outline': 'Подготовить план демо',
  'ML interview prep: practice questions': 'Подготовка к ML-собеседованию: практика вопросов', 'Read about transformers': 'Почитать про трансформеры', 'Update CV': 'Обновить резюме',
  'Review gradient boosting notes': 'Повторить конспект по бустингу', 'Write README for classifier': 'Написать README для классификатора', 'Problem set 3': 'Задачи №3', 'Statistics: chapter 6 exercises': 'Статистика: упражнения главы 6',
  'Book a lab appointment': 'Записаться на анализы', 'Meal-prep lunches': 'Заготовить обеды', 'Vacuum the living room': 'Пропылесосить гостиную', 'Replace the hallway light bulb': 'Заменить лампочку в коридоре',
  'Renew documents': 'Обновить документы', 'Pick up a parcel': 'Забрать посылку', 'Plan the weekend': 'Спланировать выходные', 'Review monthly budget': 'Пересмотреть бюджет месяца',
  'Draft summary': 'Набросать резюме', 'Tidy notes': 'Привести заметки в порядок', 'Practice exercises': 'Практические упражнения', 'Plan next steps': 'Спланировать следующие шаги', 'Quick review': 'Быстрый обзор',
  'Prepare materials': 'Подготовить материалы', 'Clean up files': 'Разобрать файлы',
  'Treadmill': 'Беговая дорожка', 'Clean apartment': 'Уборка квартиры', 'Change bed linen': 'Сменить постельное бельё', 'Vacuum': 'Пылесос', 'Wash makeup brushes': 'Помыть кисти для макияжа', 'Evening reading': 'Вечернее чтение',
  'Meditation': 'Медитация', 'Pages read': 'Прочитано страниц', 'Walk': 'Прогулка', 'Yoga': 'Йога', 'Cycling': 'Велосипед',
  'Oatmeal with berries': 'Овсянка с ягодами', 'Scrambled eggs and toast': 'Яичница и тосты', 'Yoghurt and granola': 'Йогурт с гранолой', 'Chicken salad bowl': 'Салат с курицей', 'Vegetable soup and bread': 'Овощной суп с хлебом',
  'Pasta with tomato sauce': 'Паста с томатным соусом', 'Baked salmon with rice': 'Запечённый лосось с рисом', 'Veggie stir-fry': 'Овощи вок', 'Homemade pizza': 'Домашняя пицца', 'Apple and nuts': 'Яблоко и орехи',
  'Chocolate bar': 'Шоколадка', 'Cappuccino and cookie': 'Капучино и печенье', 'Monthly income': 'Доход за месяц', 'Monthly savings': 'Ежемесячные накопления', 'Grocery expense': 'Покупка продуктов',
  'Streaming subscription (demo)': 'Подписка на видеосервис (демо)', 'Get back into a stable rhythm.': 'Вернуться к стабильному ритму.',
  'review': 'ревью', 'reading': 'чтение', 'monthly': 'ежемесячно', 'weekly': 'еженедельно', 'optional': 'необязательно',
};

const WEEKDAY = { Sun: 'Вс', Mon: 'Пн', Tue: 'Вт', Wed: 'Ср', Thu: 'Чт', Fri: 'Пт', Sat: 'Сб' };
const STRENGTH = { negligible: 'Пренебрежимо слабая', weak: 'Слабая', moderate: 'Умеренная', strong: 'Сильная', 'very strong': 'Очень сильная' };
const tasksWord = (n) => plural(n, ['задача', 'задачи', 'задач']);

// [regex, replacer(match..., ) -> string]. Captured groups are translated recursively where useful.
const PATTERNS = [
  [/^next (Today|Tomorrow|Yesterday|.*\d.*)$/, (m, a) => `ближайшее: ${tr(a)}`],
  [/^(.+) colour$/, (m, a) => `Цвет: ${tr(a)}`, true],
  [/^(.+) progress$/, (m, a) => `Прогресс: ${tr(a)}`, true],
  [/^(Mood|Energy|Stress|Productivity|Overall wellbeing) (\d+)$/, (m, a, n) => `${tr(a)} ${n}`, true],
  [/^(\d+) open · (\d+) done$/, (m, a, b) => `Открыто: ${a} · выполнено: ${b}`],
  [/^(\d+) open$/, (m, a) => `Открыто: ${a}`],
  [/^(\d+) of (\d+) tasks (?:done|complete)$/, (m, a, b) => `Выполнено ${a} из ${b}`],
  [/^(\d+) open assignments?$/, (m, a) => `Открытых заданий: ${a}`],
  [/^Completed today \((\d+)\)$/, (m, a) => `Выполнено сегодня (${a})`],
  [/^Done \((\d+)\)$/, (m, a) => `Готово (${a})`],
  [/^Carried over · (.+)$/, (m, a) => `Перенесено · ${a}`],
  [/^by (\d\d:\d\d)$/, (m, a) => `до ${a}`],
  [/^Due (Today|Tomorrow|Yesterday|.*\d.*)$/, (m, a) => `Срок: ${tr(a)}`],
  [/^Exam (Today|Tomorrow|Yesterday|.*\d.*)$/, (m, a) => `Экзамен: ${tr(a)}`],
  [/^Deadline (.+) · (\d+) days past$/, (m, a, n) => `Дедлайн ${a} · просрочено дн.: ${n}`],
  [/^Deadline (.+) · (\d+) days to go$/, (m, a, n) => `Дедлайн ${a} · осталось дн.: ${n}`],
  [/^Deadline (.+) · today$/, (m, a) => `Дедлайн ${a} · сегодня`],
  [/^Deadline (.*\d.*)$/, (m, a) => `Дедлайн: ${a}`],
  [/^Goal (\d+)× \/ week$/, (m, a) => `Цель: ${a}× в неделю`],
  [/^(\d+) \/ (\d+) this week$/, (m, a, b) => `${a} / ${b} на этой неделе`],
  [/^(\d+) of (\d+) this week$/, (m, a, b) => `${a} из ${b} на этой неделе`],
  [/^(\d+) of (\d+) done so far — whatever fits is enough\.$/, (m, a, b) => `Сделано ${a} из ${b} — достаточно того, что получается.`],
  [/^Every ((?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)(?:, (?:Sun|Mon|Tue|Wed|Thu|Fri|Sat))*)$/, (m, a) => `По дням: ${a.split(', ').map((d) => WEEKDAY[d]).join(', ')}`],
  [/^Every (\d+) days$/, (m, a) => `Каждые ${a} дн.`],
  [/^Add a task to (.+)…$/, (m, a) => `Добавить задачу в «${a}»…`, true],
  [/^Add to (.+)…$/, (m, a) => `Добавить в «${tr(a)}»…`, true],
  [/^Add to (.+)$/, (m, a) => `Добавить на ${a}`, true],
  [/^More actions for (.+)$/, (m, a) => `Действия: ${a}`, true],
  [/^Priority (P\d)$/, (m, a) => `Приоритет ${a}`, true],
  [/^Complete: (.+)$/, (m, a) => `Выполнить: ${a}`, true],
  [/^Mark not done: (.+)$/, (m, a) => `Снять отметку: ${a}`, true],
  [/^Complete (.+)$/, (m, a) => `Выполнить: ${a}`, true],
  [/^Reopen (.+)$/, (m, a) => `Открыть снова: ${a}`, true],
  [/^Toggle (.+)$/, (m, a) => `Переключить: ${a}`, true],
  [/^Unmark (.+)$/, (m, a) => `Снять отметку: ${a}`, true],
  [/^Mark (.+)$/, (m, a) => `Отметить: ${a}`, true],
  [/^(.+), (\d\d:\d\d) to (\d\d:\d\d)(, done)?$/, (m, t, a, b, d) => `${t}, с ${a} до ${b}${d ? ', выполнено' : ''}`],
  [/^Decrease (.+)$/, (m, a) => `Уменьшить: ${tr(a)}`, true],
  [/^Increase (.+)$/, (m, a) => `Увеличить: ${tr(a)}`, true],
  [/^Remove (.+)$/, (m, a) => `Убрать: ${tr(a)}`, true],
  [/^Check-in · (.+)$/, (m, a) => `Отметка · ${a === 'today' ? 'сегодня' : a}`],
  [/^Delete this (.+)\? This can’t be undone\.$/, (m, a) => `Удалить («${tr(a).toLowerCase()}»)? Это нельзя отменить.`],
  [/^(.+) · (\d+)% avg$/, (m, a, p) => `${a} · в среднем ${p}%`],
  [/^(\d+) topics?$/, (m, a) => `Тем: ${a}`],
  [/^(\d+)%(?: · (\d+) open tasks?)?( · has notes)?$/, (m, p, n, notes) => `${p}%${n ? ` · открытых задач: ${n}` : ''}${notes ? ' · есть заметки' : ''}`],
  [/^(\d+) this month$/, (m, a) => `В этом месяце: ${a}`],
  [/^(\d+)% of budget used$/, (m, a) => `Использовано ${a}% бюджета`],
  [/^Limit (.+)$/, (m, a) => `Лимит ${a}`],
  [/^(.+) \/ (.+) · over limit$/, (m, a, b) => `${a} / ${b} · выше лимита`],
  [/^Week of (.+)$/, (m, a) => `Неделя с ${a}`],
  [/^(Weekly|Monthly) (total|average)$/, (m, p, k) => `${p === 'Weekly' ? 'Недельная' : 'Месячная'} ${k === 'total' ? 'сумма' : 'средняя'}`],
  [/^Planned (.+) · Actual (.+)$/, (m, a, b) => `План: ${a} · Факт: ${b}`],
  [/^Not enough overlapping data yet \((\d+) of (\d+) days needed\)\.$/, (m, a, b) => `Пока недостаточно пересекающихся данных (${a} из ${b} дней).`],
  [/^(Negligible|Weak|Moderate|Strong|Very strong) (positive|negative) association$/i, (m, s, d) => `${STRENGTH[s.toLowerCase()]} ${d.toLowerCase() === 'positive' ? 'положительная' : 'отрицательная'} связь`],
  [/^(.+) and (.+) (on the same day|\d+ days? later)\.( Small sample — treat as a hint only\.)?$/, (m, a, b, lag, small) =>
    `${tr(a)} и ${tr(b)} ${lag === 'on the same day' ? 'в один и тот же день' : `со сдвигом +${lag.split(' ')[0]} дн.`}.${small ? ' Выборка небольшая — считайте это лишь подсказкой.' : ''}`],
  [/^Scatter plot of (.+) and (.+)$/, (m, a, b) => `Диаграмма рассеяния: ${tr(a)} и ${tr(b)}`, true],
  [/^Each dot is one day$/, () => 'Каждая точка — один день'],
  [/^vertical axis: (.+)$/, (m, a) => `вертикальная ось: ${tr(a)}`],
  [/^Day total: (.+)$/, (m, a) => `Итого за день: ${a.split(' · ').map(tr).join(' · ')}`],
  [/^(\d+) kcal$/, (m, a) => `${a} ккал`],
  [/^P (\d+)g$/, (m, a) => `Б ${a} г`], [/^F (\d+)g$/, (m, a) => `Ж ${a} г`], [/^C (\d+)g$/, (m, a) => `У ${a} г`],
  [/^mood (\d+)$/, (m, a) => `настроение ${a}`],
  [/^(\d+) min active$/, (m, a) => `${a} мин активности`],
  [/^(\d+(?:[.,]\d+)?) (kg|min)$/, (m, a, u) => `${a} ${u === 'kg' ? 'кг' : 'мин'}`],
  [/^(\d+) cups?$/, (m, a) => `${a} ${plural(+a, ['чашка', 'чашки', 'чашек'])}`],
  [/^(\d+(?:\.\d+)?)h$/, (m, a) => `${a} ч`],
  [/^Number \((.+)\)$/, (m, a) => `Число (${tr(a)})`],
  [/^Reset to (.+)$/, (m, a) => `Сбросить: ${a}`],
  [/^Account: (.+)$/, (m, a) => `Аккаунт: ${a}`],
  [/^(.+) · Last sync: (.+?)(?: · waiting to send: (\d+))?$/, (m, a, b, n) => `${tr(a)} · Последняя синхронизация: ${b}${n ? ` · ждут отправки: ${n}` : ''}`],
  [/^Import failed: (.+)$/, (m, a) => `Не удалось импортировать: ${tr(a)}`],
  [/^Couldn’t save: (.+)$/, (m, a) => `Не удалось сохранить: ${a}`],
  [/^(Breakfast|Lunch|Dinner|Snack|Other) (\d+)$/, (m, a, n) => `${tr(a)} ${n}`],
  [/^([a-z][a-z -]*) · (\d+)$/, (m, a, n) => `${tr(a)} · ${n}`],
  [/^(\d+) (Low|Medium|High)$/, (m, a, b) => `${a} ${tr(b)}`],
];

const cache = new Map();

export function tr(text, attr = false) {
  if (current !== 'ru' || !text) return text;
  const key = text.trim();
  if (!key) return text;
  const ck = attr ? `@${key}` : key;
  if (cache.has(ck)) return text.replace(key, () => cache.get(ck));
  let out = RU[key];
  if (out === undefined) {
    for (const [re, fn, attrOnly] of PATTERNS) {
      if (attrOnly && !attr) continue; // loose patterns only apply to attributes, never to user text
      const m = key.match(re);
      if (m) { out = fn(...m); break; }
    }
  }
  if (out === undefined && key.includes(' · ')) {
    const parts = key.split(' · ').map((p) => tr(p));
    out = parts.join(' · ');
  }
  if (out === undefined) out = key;
  if (cache.size < 4000) cache.set(ck, out);
  return text.replace(key, () => out);
}

// ---- DOM translation -------------------------------------------------------
const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
let observer = null;

function translateNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const p = node.parentElement;
    if (p && (p.tagName === 'SCRIPT' || p.tagName === 'STYLE' || p.closest('[data-no-i18n]'))) return;
    const out = tr(node.nodeValue);
    if (out !== node.nodeValue) node.nodeValue = out;
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    if (node.hasAttribute('data-no-i18n')) return;
    for (const a of ATTRS) {
      const v = node.getAttribute(a);
      if (v) { const out = tr(v, true); if (out !== v) node.setAttribute(a, out); }
    }
  }
}

export function translateTree(root) {
  if (current !== 'ru' || !root) return;
  translateNode(root);
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let n = walker.nextNode();
  while (n) { translateNode(n); n = walker.nextNode(); }
}

export function startI18n() {
  document.documentElement.lang = current;
  if (observer) return;
  observer = new MutationObserver((records) => {
    if (current !== 'ru') return;
    for (const r of records) {
      if (r.type === 'childList') r.addedNodes.forEach((n) => translateTree(n));
      else if (r.type === 'characterData') translateNode(r.target);
      else if (r.type === 'attributes') translateNode(r.target);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  translateTree(document.body);
}
