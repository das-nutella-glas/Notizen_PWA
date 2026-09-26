import { FormEvent, type CSSProperties, useEffect, useMemo, useState } from 'react';

type Note = {
  id: string;
  title: string;
  text: string;
  createdAt: number;
  deadline?: string;
  completed: boolean;
  priority?: number;
};

type View = 'daily' | 'list' | 'calendar';
type CalendarSelection = { date: string; noteIds: string[] } | null;
type User = { id: string; name: string };
type AuthResponse = { user: User; token: string; linkCode?: string };

const initialNotes: Note[] = [
  { id: 'welcome', title: 'Willkommen', text: 'Willkommen in deinem Gedankenraum.', createdAt: Date.now() - 1000 * 60 * 5, completed: false },
  { id: 'idea', title: 'Eine kleine Idee', text: 'Eine kleine Idee ist der Anfang von etwas Großem.', createdAt: Date.now() - 1000 * 60 * 4, completed: false },
];

const icons = {
  spark: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16h16l-2 3H7l-3-3Z" /><path d="M12 16V4l7 8h-7M3 21c2-1.2 4-1.2 6 0s4 1.2 6 0 4-1.2 6 0" /></svg>,
  plus: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>,
  check: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7" /></svg>,
  trash: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>,
  edit: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16.5-.75 3.25L6.5 19 18 7.5 15.5 5 4 16.5ZM14 6.5l2.5 2.5" /></svg>,
  moon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.5 8.5 0 1 0 20.5 15.2Z" /></svg>,
  list: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h11M8 12h11M8 18h11M4 6h.01M4 12h.01M4 18h.01" /></svg>,
  calendar: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M16 3v4M8 3v4M3.5 10h17" /></svg>,
  left: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>,
  right: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>,
  close: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>,
  trashAll: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /><path d="m17 17 4 4M21 17l-4 4" /></svg>,
  user: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20c.7-3.2 3-5 7.5-5s6.8 1.8 7.5 5" /></svg>,
};

const getDeviceId = () => {
  const stored = localStorage.getItem('gedankenraum-device-id');
  if (stored) return stored;
  const deviceId = crypto.randomUUID();
  localStorage.setItem('gedankenraum-device-id', deviceId);
  return deviceId;
};

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('gedankenraum-session');
  const headers = new Headers(options.headers);
  headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);
  const response = await fetch(`/api/${path}`, { ...options, headers });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? 'Die Anfrage ist fehlgeschlagen.');
  return data;
}

function getInitialNotes(): Note[] {
  const saved = localStorage.getItem('gedankenraum-notes');
  if (!saved) return initialNotes;
  try {
    return (JSON.parse(saved) as Array<Partial<Note>>).map((note) => ({
      id: note.id ?? crypto.randomUUID(),
      title: note.title ?? 'Ohne Titel',
      text: note.text ?? '',
      createdAt: note.createdAt ?? Date.now(),
      deadline: note.deadline,
      completed: note.completed ?? false,
      priority: note.priority,
    }));
  } catch {
    return initialNotes;
  }
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short' }).format(new Date(`${date}T12:00:00`));
}

function App() {
  const [notes, setNotes] = useState<Note[]>(getInitialNotes);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftText, setDraftText] = useState('');
  const [draftDeadline, setDraftDeadline] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [view, setView] = useState<View>('list');
  const [isNightMode, setIsNightMode] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [calendarSelection, setCalendarSelection] = useState<CalendarSelection>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('gedankenraum-user');
    return saved ? JSON.parse(saved) as User : import.meta.env.DEV ? { id: 'local-dev', name: 'Lokaler Test' } : null;
  });
  const [authOpen, setAuthOpen] = useState(() => !localStorage.getItem('gedankenraum-session') && !import.meta.env.DEV);
  const [authMode, setAuthMode] = useState<'register' | 'link'>('register');
  const [profileOpen, setProfileOpen] = useState(false);
  const [authName, setAuthName] = useState('');
  const [linkCode, setLinkCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [dailyIds, setDailyIds] = useState<string[]>(() => JSON.parse(localStorage.getItem('gedankenraum-daily') ?? '[]') as string[]);
  const [dailyDonePopup, setDailyDonePopup] = useState(false);
  const [calendarCreateDate, setCalendarCreateDate] = useState<string | null>(null);

  useEffect(() => localStorage.setItem('gedankenraum-notes', JSON.stringify(notes)), [notes]);
  useEffect(() => localStorage.setItem('gedankenraum-daily', JSON.stringify(dailyIds)), [dailyIds]);
  useEffect(() => {
    const token = localStorage.getItem('gedankenraum-session');
    if (!token) return;
    api<{ notes: Note[] }>('notes').then((result) => setNotes(result.notes)).catch(() => {
      localStorage.removeItem('gedankenraum-session');
      localStorage.removeItem('gedankenraum-user');
      setUser(null);
      setAuthOpen(true);
    });
  }, []);

  const openNotes = useMemo(() => notes.filter((note) => !note.completed), [notes]);
  const completedNotes = useMemo(() => notes.filter((note) => note.completed), [notes]);
  const deadlineNotes = useMemo(() => notes.filter((note) => note.deadline), [notes]);
  const monthLabel = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(calendarMonth);
  const monthDays = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const firstWeekday = (new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay() + 6) % 7;
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const dailyNotes = dailyIds.map((id) => notes.find((note) => note.id === id)).filter((note): note is Note => Boolean(note));
  const completedDaily = dailyNotes.filter((note) => note.completed).length;
  useEffect(() => {
    if (dailyIds.length === 3 && completedDaily === 3) setDailyDonePopup(true);
  }, [completedDaily, dailyIds.length]);
  useEffect(() => {
    if (localStorage.getItem('gedankenraum-daily-date') !== todayKey) {
      localStorage.setItem('gedankenraum-daily-date', todayKey);
      setDailyIds([]);
    }
  }, [todayKey]);

  async function saveNote(event: FormEvent, forcedDeadline?: string) {
    event.preventDefault();
    const title = draftTitle.trim();
    const text = draftText.trim();
    const deadline = forcedDeadline ?? draftDeadline;
    if (!title) return;
    const token = localStorage.getItem('gedankenraum-session');
    if (editingId) {
      setNotes((current) => current.map((note) => note.id === editingId ? { ...note, title, text, deadline: deadline || undefined } : note));
      if (token) await api(`notes/${editingId}`, { method: 'PUT', body: JSON.stringify({ title, text, deadline, completed: notes.find((note) => note.id === editingId)?.completed ?? false }) });
      setEditingId(null);
    } else {
      const newNote = { id: crypto.randomUUID(), title, text, createdAt: Date.now(), deadline: deadline || undefined, completed: false };
      setNotes((current) => [newNote, ...current]);
      if (token) {
        await api('notes', { method: 'POST', body: JSON.stringify(newNote) });
      }
    }
    setDraftTitle('');
    setDraftText('');
    setDraftDeadline('');
  }

  function editNote(note: Note) {
    setDraftTitle(note.title);
    setDraftText(note.text);
    setDraftDeadline(note.deadline ?? '');
    setEditingId(note.id);
    setView('list');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function toggleNote(id: string) {
    const note = notes.find((item) => item.id === id);
    if (!note) return;
    const completed = !note.completed;
    if (!note.completed && dailyIds.includes(id)) {
      const position = dailyIds.indexOf(id);
      const previous = notes.find((item) => item.id === dailyIds[position - 1]);
      if (position > 0 && previous && !previous.completed) return;
    }
    setNotes((current) => current.map((note) => note.id === id ? { ...note, completed: !note.completed } : note));
    if (localStorage.getItem('gedankenraum-session')) await api(`notes/${id}`, { method: 'PUT', body: JSON.stringify({ ...note, completed }) });
  }

  function deleteCompleted() {
    const completedIds = new Set(completedNotes.map((note) => note.id));
    setNotes((current) => current.filter((note) => !completedIds.has(note.id)));
    setDailyIds((current) => current.filter((id) => !completedIds.has(id)));
  }

  function selectDaily(id: string) {
    setDailyIds((current) => current.length >= 3 && !current.includes(id) ? current : current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function deleteNote(id: string) {
    setNotes((current) => current.filter((note) => note.id !== id));
    if (localStorage.getItem('gedankenraum-session')) await api(`notes/${id}`, { method: 'DELETE' });
    setSelectedNoteId(null);
    setCalendarSelection(null);
  }

  async function authenticate(event: FormEvent) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError('');
    const localNotes = notes;
    try {
      const result = authMode === 'register'
        ? await api<AuthResponse>('auth/register', { method: 'POST', body: JSON.stringify({ name: authName, deviceId: getDeviceId() }) })
        : await api<AuthResponse>('auth/link', { method: 'POST', body: JSON.stringify({ code: linkCode, deviceId: getDeviceId() }) });
      localStorage.setItem('gedankenraum-session', result.token);
      localStorage.setItem('gedankenraum-user', JSON.stringify(result.user));
      setUser(result.user);
      setAuthOpen(false);
      if (authMode === 'register') {
        await Promise.all(localNotes.map((note) => api('notes', {
          method: 'POST',
          body: JSON.stringify(note),
        })));
      }
      const remote = await api<{ notes: Note[] }>('notes');
      setNotes(remote.notes);
      setAuthName('');
      setLinkCode('');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Anmeldung fehlgeschlagen.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function createLinkCode() {
    try {
      const result = await api<{ code: string }>('auth/code', { method: 'POST' });
      setGeneratedCode(result.code);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Code konnte nicht erstellt werden.');
    }
  }

  function logout() {
    localStorage.removeItem('gedankenraum-session');
    localStorage.removeItem('gedankenraum-user');
    setUser(null);
    setProfileOpen(false);
    setAuthOpen(true);
  }

  function changeView(nextView: View) {
    setCalendarSelection(null);
    setSelectedNoteId(null);
    setView(nextView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleTouchEnd(endX: number) {
    if (touchStart === null || Math.abs(endX - touchStart) < 55) return;
    if (selectedNoteId || calendarSelection) {
      setSelectedNoteId(null);
      setCalendarSelection(null);
      setTouchStart(null);
      return;
    }
    const views: View[] = ['daily', 'list', 'calendar'];
    const currentIndex = views.indexOf(view);
    const nextIndex = endX < touchStart
      ? (currentIndex + 1) % views.length
      : (currentIndex - 1 + views.length) % views.length;
    changeView(views[nextIndex]);
    setTouchStart(null);
  }

  function openCalendarDate(date: string, noteIds: string[]) {
    if (noteIds.length === 1) {
      setSelectedNoteId(noteIds[0]);
      setCalendarSelection(null);
    } else if (noteIds.length > 1) {
      setCalendarSelection({ date, noteIds });
      setSelectedNoteId(null);
    }
  }

  function renderNote(note: Note, index = 0) {
    return <article className="note-card glass-card" style={{ '--delay': `${index * 70}ms` } as CSSProperties} key={note.id}>
      <button className={`complete-button${note.completed ? ' selected' : ''}`} onClick={() => toggleNote(note.id)} aria-label={note.completed ? 'Als offen markieren' : 'Als erledigt markieren'}>{icons.check}</button>
      <div className="note-main"><h3>{note.title}</h3><p>{note.text}</p>{note.deadline && <span className="deadline-label">{formatDate(note.deadline)}</span>}</div>
      <div className="note-actions"><button onClick={() => editNote(note)} aria-label="Notiz bearbeiten">{icons.edit}</button><button onClick={() => deleteNote(note.id)} aria-label="Notiz löschen">{icons.trash}</button></div>
    </article>;
  }

  const calendarDays = Array.from({ length: monthDays }, (_, index) => {
    const day = index + 1;
    const date = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayNotes = deadlineNotes.filter((note) => note.deadline === date);
    const isToday = today.getFullYear() === calendarMonth.getFullYear()
      && today.getMonth() === calendarMonth.getMonth()
      && today.getDate() === day;

    return { day, date, dayNotes, isToday };
  });

  return (
    <main className={`app-shell${isNightMode ? ' night-mode' : ''}`} onTouchStart={(event) => setTouchStart(event.touches[0].clientX)} onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0].clientX)}>
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <section className="app-content">
        <header className="topbar"><div className="brand"><span className="brand-mark">{icons.spark}</span><span>Gedankenraum</span></div><div className="topbar-actions"><button className="icon-button" onClick={() => setIsNightMode((current) => !current)} aria-label="Darstellung wechseln">{icons.moon}</button><button className={`icon-button profile-button${user ? ' signed-in' : ''}`} onClick={() => user ? setProfileOpen(true) : setAuthOpen(true)} aria-label="Profil öffnen">{icons.user}</button></div></header>

        {view === 'daily' ? <div className="view-panel daily-panel">
          <section className="daily-hero"><p className="eyebrow">DEIN FOKUS FÜR HEUTE</p><h1>Deine <em>3 heutigen</em><br />Aufgaben</h1><div className="daily-progress"><div className="progress-track"><span style={{ width: `${completedDaily * 33.333}%` }} /></div><div className="progress-boxes">{[1, 2, 3].map((step) => <span className={completedDaily >= step ? 'filled' : ''} key={step}>{completedDaily >= step ? icons.check : step}</span>)}</div></div></section>
          <div className="daily-actions"><span>{dailyIds.length}/3 ausgewählt</span></div>
          <div className="daily-list">{dailyNotes.map((note, index) => <article className={`daily-task glass-card${note.completed ? ' completed' : ''}`} key={note.id}><span className="task-number">{index + 1}</span><button className="complete-button" onClick={() => toggleNote(note.id)} aria-label="Aufgabe abhaken">{icons.check}</button><div className="note-main"><h3>{note.title}</h3><p>{note.text || 'Keine Notiz'}</p></div></article>)}</div>
          {dailyIds.length < 3 && <p className="daily-hint">Wähle unten aus den offenen Aufgaben genau drei Aufgaben für heute aus.</p>}
        </div> : view === 'list' ? <div className="view-panel">
          <section className="hero"><p className="eyebrow">WILLKOMMEN IN DEINEM GEDANKENRAUM</p><h1>Was geht dir<br /><em>durch den Kopf?</em></h1></section>
          <form className="note-composer glass-card" onSubmit={saveNote}>
            <input className="title-input" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="Neue Aufgabe" aria-label="Titel der Aufgabe" required />
            <textarea value={draftText} onChange={(event) => setDraftText(event.target.value)} placeholder="Notizen (optional)" aria-label="Notiztext" rows={3} />
            <div className="deadline-row"><label htmlFor="deadline">Ablaufdatum <span>(optional)</span></label><input id="deadline" type="date" value={draftDeadline} onChange={(event) => setDraftDeadline(event.target.value)} /></div>
            <div className="composer-footer"><button className="add-button large" type="submit" disabled={!draftTitle.trim()}>{editingId ? 'Speichern' : 'Hinzufügen'} <span>{icons.plus}</span></button></div>
          </form>
          <section className="notes-section"><div className="section-heading"><div><span className="section-kicker">DEINE GEDANKENSAMMLUNG</span><h2>Offene Aufgaben</h2></div><span className="count-badge">{openNotes.length}</span></div><div className="notes-list">{openNotes.length === 0 && <div className="empty-state">Alles erledigt. Zeit für neue Aufgaben.</div>}{openNotes.map((note, index) => <div className="selectable-task" key={note.id}><button className={`daily-select${dailyIds.includes(note.id) ? ' selected' : ''}`} onClick={() => selectDaily(note.id)} aria-label="Für heute auswählen">{dailyIds.includes(note.id) ? dailyIds.indexOf(note.id) + 1 : '+'}</button>{renderNote(note, index)}</div>)}</div></section>
          {completedNotes.length > 0 && <section className="completed-section"><div className="section-heading"><div><span className="section-kicker">ABGESCHLOSSEN</span><h2>Erledigte Aufgaben</h2></div><div className="heading-actions"><span className="count-badge muted">{completedNotes.length}</span><button className="clear-completed" onClick={deleteCompleted} aria-label="Alle erledigten Aufgaben löschen">{icons.trashAll}</button></div></div><div className="notes-list">{completedNotes.map(renderNote)}</div></section>}
        </div> : <div className="view-panel calendar-panel">
          <section className="calendar-hero"><p className="eyebrow">DEIN ÜBERBLICK</p><h1>Dein <em>Kalender</em></h1></section>
          <section className="calendar-card glass-card">
            <div className="calendar-header">
              <button className="calendar-arrow" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} aria-label="Vorheriger Monat">{icons.left}</button>
              <h2>{monthLabel}</h2>
              <button className="calendar-arrow" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} aria-label="Nächster Monat">{icons.right}</button>
            </div>
            <div className="weekday-row">{['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day) => <span key={day}>{day}</span>)}</div>
            <div className="calendar-grid">
              {Array.from({ length: firstWeekday }, (_, index) => <span className="calendar-day blank" key={`blank-${index}`} />)}
              {calendarDays.map(({ day, date, dayNotes, isToday }) => (
                <div className={`calendar-day${isToday ? ' today' : ''}${dayNotes.length ? ' has-notes' : ''}`} key={date} onClick={() => dayNotes.length === 0 && setCalendarCreateDate(date)}>
                  {dayNotes.length > 1 ? (
                    <button className="calendar-date-button" onClick={() => openCalendarDate(date, dayNotes.map((note) => note.id))}>{day}</button>
                  ) : <span>{day}</span>}
                  <button className="calendar-add" onClick={(event) => { event.stopPropagation(); setCalendarCreateDate(date); }} aria-label={`Aufgabe am ${formatDate(date)} hinzufügen`}>+</button>
                  <div className="calendar-events">
                    {dayNotes.map((note) => (
                      <button
                        className={`calendar-event${note.completed ? ' completed' : ''}`}
                        key={note.id}
                        onClick={(event) => { event.stopPropagation(); setSelectedNoteId(note.id); }}
                        title={note.title}
                      >
                        <span>{note.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="deadline-list"><div className="section-heading"><div><span className="section-kicker">TERMINE</span><h2>Mit Ablaufdatum</h2></div><span className="count-badge">{deadlineNotes.length}</span></div>{deadlineNotes.length === 0 ? <div className="empty-state">Noch keine Notiz hat ein Ablaufdatum.</div> : <div className="notes-list">{deadlineNotes.sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? '')).map(renderNote)}</div>}</section>
        </div>}

        <nav className="bottom-nav" aria-label="Ansichten"><button className={view === 'daily' ? 'active' : ''} onClick={() => changeView('daily')}>{icons.check}<span>Heute</span></button><button className={view === 'list' ? 'active' : ''} onClick={() => changeView('list')}>{icons.list}<span>Aufgaben</span></button><button className={view === 'calendar' ? 'active' : ''} onClick={() => changeView('calendar')}>{icons.calendar}<span>Kalender</span></button></nav>
        {selectedNoteId && (() => { const selectedNote = notes.find((note) => note.id === selectedNoteId); return selectedNote ? <div className="modal-backdrop" role="presentation" onClick={() => setSelectedNoteId(null)}><section className="event-modal glass-card" role="dialog" aria-modal="true" aria-labelledby="event-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setSelectedNoteId(null)} aria-label="Popup schließen">{icons.close}</button><span className="section-kicker">EREIGNIS</span><h2 id="event-title">{selectedNote.title}</h2><p>{selectedNote.text}</p>{selectedNote.deadline && <span className="deadline-label">{formatDate(selectedNote.deadline)}</span>}<div className="modal-actions"><button className={`modal-action complete${selectedNote.completed ? ' is-selected' : ''}`} onClick={() => { toggleNote(selectedNote.id); setSelectedNoteId(null); }} aria-label={selectedNote.completed ? 'Als offen markieren' : 'Als erledigt markieren'}>{icons.check}</button><button className="modal-action" onClick={() => editNote(selectedNote)} aria-label="Ereignis bearbeiten">{icons.edit}</button><button className="modal-action danger" onClick={() => deleteNote(selectedNote.id)} aria-label="Ereignis löschen">{icons.trash}</button></div></section></div> : null; })()}
        {calendarSelection && <div className="modal-backdrop" role="presentation" onClick={() => setCalendarSelection(null)}><section className="event-modal picker-modal glass-card" role="dialog" aria-modal="true" aria-labelledby="picker-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setCalendarSelection(null)} aria-label="Popup schließen">{icons.close}</button><span className="section-kicker">{formatDate(calendarSelection.date)}</span><h2 id="picker-title">Welches Ereignis?</h2><div className="modal-event-list">{calendarSelection.noteIds.map((id) => { const note = notes.find((item) => item.id === id); return note ? <button className="event-option" key={note.id} onClick={() => { setSelectedNoteId(note.id); setCalendarSelection(null); }}><span className="event-option-title">{note.title}</span><span>{note.text}</span>{icons.right}</button> : null; })}</div></section></div>}
        {calendarCreateDate && <div className="modal-backdrop" role="presentation" onClick={() => setCalendarCreateDate(null)}><section className="event-modal glass-card" role="dialog" aria-modal="true" aria-labelledby="calendar-create-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setCalendarCreateDate(null)} aria-label="Popup schließen">{icons.close}</button><span className="section-kicker">{formatDate(calendarCreateDate)}</span><h2 id="calendar-create-title">Aufgabe für diesen Tag</h2><form onSubmit={async (event) => { await saveNote(event, calendarCreateDate); setCalendarCreateDate(null); }}><input className="auth-input" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="Neue Aufgabe" required autoFocus /><textarea className="calendar-create-text" value={draftText} onChange={(event) => setDraftText(event.target.value)} placeholder="Notizen (optional)" rows={3} /><button className="add-button large" type="submit" disabled={!draftTitle.trim()}>Aufgabe hinzufügen <span>{icons.plus}</span></button></form></section></div>}
        {profileOpen && user && <div className="modal-backdrop" role="presentation" onClick={() => setProfileOpen(false)}><section className="event-modal profile-modal glass-card" role="dialog" aria-modal="true" aria-labelledby="profile-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setProfileOpen(false)} aria-label="Profil schließen">{icons.close}</button><span className="section-kicker">DEIN PROFIL</span><h2 id="profile-title">{user.name}</h2><p>{import.meta.env.DEV ? 'Lokaler Testmodus: Notizen werden in diesem Browser gespeichert.' : 'Deine Notizen werden sicher in deiner Cloudflare-Datenbank gespeichert.'}</p>{!import.meta.env.DEV && <><button className="link-code-button" onClick={createLinkCode}>Code für weiteres Gerät erstellen</button>{generatedCode && <div className="generated-code"><span>10 Minuten gültig</span><strong>{generatedCode}</strong></div>}<button className="logout-button" onClick={logout}>Konto wechseln</button></>}</section></div>}
        {authOpen && <div className="modal-backdrop" role="presentation"><section className="event-modal auth-modal glass-card" role="dialog" aria-modal="true" aria-labelledby="auth-title" onClick={(event) => event.stopPropagation()}><span className="section-kicker">WILLKOMMEN</span><h2 id="auth-title">{authMode === 'register' ? 'Dein Gedankenraum' : 'Gerät verbinden'}</h2><p>{authMode === 'register' ? 'Lege einen Namen für dein Konto fest. Ein Passwort ist nicht nötig.' : 'Gib den 8-stelligen Code von deinem bereits angemeldeten Gerät ein.'}</p><form onSubmit={authenticate}>{authMode === 'register' ? <input className="auth-input" value={authName} onChange={(event) => setAuthName(event.target.value)} placeholder="Dein Name" maxLength={60} autoFocus required /> : <input className="auth-input code-input" value={linkCode} onChange={(event) => setLinkCode(event.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="12345678" inputMode="numeric" autoFocus required />}<button className="add-button large" type="submit" disabled={authBusy}>{authMode === 'register' ? 'Konto erstellen' : 'Gerät verbinden'}</button></form>{authError && <p className="auth-error">{authError}</p>}<button className="auth-switch" onClick={() => { setAuthMode(authMode === 'register' ? 'link' : 'register'); setAuthError(''); }}>{authMode === 'register' ? 'Ich habe bereits einen Verbindungscode' : 'Neues Konto erstellen'}</button></section></div>}
        {dailyDonePopup && <div className="modal-backdrop" role="presentation" onClick={() => setDailyDonePopup(false)}><section className="event-modal glass-card success-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><span className="success-icon">{icons.check}</span><h2>Sehr gut, alles für heute erledigt</h2><button className="add-button large" onClick={() => setDailyDonePopup(false)}>Weiter</button></section></div>}
      </section>
    </main>
  );
}

export default App;
