import { FormEvent, type CSSProperties, useEffect, useMemo, useState } from 'react';

type Note = {
  id: string;
  title: string;
  text: string;
  createdAt: number;
  deadline?: string;
  completed: boolean;
};

type View = 'list' | 'calendar';
type CalendarSelection = { date: string; noteIds: string[] } | null;

const initialNotes: Note[] = [
  { id: 'welcome', title: 'Willkommen', text: 'Willkommen in deinem Gedankenraum.', createdAt: Date.now() - 1000 * 60 * 5, completed: false },
  { id: 'idea', title: 'Eine kleine Idee', text: 'Eine kleine Idee ist der Anfang von etwas Großem.', createdAt: Date.now() - 1000 * 60 * 4, completed: false },
];

const icons = {
  spark: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 1.55 6.45L20 10l-6.45 1.55L12 18l-1.55-6.45L4 10l6.45-1.55L12 2Z" /><path d="m19 16 .63 2.37L22 19l-2.37.63L19 22l-.63-2.37L16 19l2.37-.63L19 16Z" /></svg>,
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
};

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

  useEffect(() => localStorage.setItem('gedankenraum-notes', JSON.stringify(notes)), [notes]);

  const openNotes = useMemo(() => notes.filter((note) => !note.completed), [notes]);
  const completedNotes = useMemo(() => notes.filter((note) => note.completed), [notes]);
  const deadlineNotes = useMemo(() => notes.filter((note) => note.deadline), [notes]);
  const monthLabel = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(calendarMonth);
  const monthDays = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const firstWeekday = (new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay() + 6) % 7;
  const today = new Date();

  function saveNote(event: FormEvent) {
    event.preventDefault();
    const title = draftTitle.trim();
    const text = draftText.trim();
    if (!title || !text) return;
    if (editingId) {
      setNotes((current) => current.map((note) => note.id === editingId ? { ...note, title, text, deadline: draftDeadline || undefined } : note));
      setEditingId(null);
    } else {
      setNotes((current) => [{ id: crypto.randomUUID(), title, text, createdAt: Date.now(), deadline: draftDeadline || undefined, completed: false }, ...current]);
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

  function toggleNote(id: string) {
    setNotes((current) => current.map((note) => note.id === id ? { ...note, completed: !note.completed } : note));
  }

  function deleteNote(id: string) {
    setNotes((current) => current.filter((note) => note.id !== id));
    setSelectedNoteId(null);
    setCalendarSelection(null);
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
    changeView(endX < touchStart ? 'calendar' : 'list');
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
        <header className="topbar"><div className="brand"><span className="brand-mark">{icons.spark}</span><span>Gedankenraum</span></div><button className="icon-button" onClick={() => setIsNightMode((current) => !current)} aria-label="Darstellung wechseln">{icons.moon}</button></header>

        {view === 'list' ? <div className="view-panel">
          <section className="hero"><p className="eyebrow">DEIN RUHIGER ORT FÜR IDEEN</p><h1>Was geht dir<br /><em>durch den Kopf?</em></h1></section>
          <form className="note-composer glass-card" onSubmit={saveNote}>
            <input className="title-input" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="Titel deiner Idee" aria-label="Titel der Notiz" required />
            <textarea value={draftText} onChange={(event) => setDraftText(event.target.value)} placeholder="Eine neue Idee festhalten ..." aria-label="Notiztext" rows={3} required />
            <div className="deadline-row"><label htmlFor="deadline">Ablaufdatum <span>(optional)</span></label><input id="deadline" type="date" value={draftDeadline} onChange={(event) => setDraftDeadline(event.target.value)} /></div>
            <div className="composer-footer"><button className="add-button large" type="submit" disabled={!draftTitle.trim() || !draftText.trim()}>{editingId ? 'Speichern' : 'Hinzufügen'} <span>{icons.plus}</span></button></div>
          </form>
          <section className="notes-section"><div className="section-heading"><div><span className="section-kicker">DEINE SAMMLUNG</span><h2>Offene Gedanken</h2></div><span className="count-badge">{openNotes.length}</span></div><div className="notes-list">{openNotes.length === 0 && <div className="empty-state">Alles erledigt. Zeit für neue Gedanken.</div>}{openNotes.map(renderNote)}</div></section>
          {completedNotes.length > 0 && <section className="completed-section"><div className="section-heading"><div><span className="section-kicker">ABGESCHLOSSEN</span><h2>Erledigte Gedanken</h2></div><span className="count-badge muted">{completedNotes.length}</span></div><div className="notes-list">{completedNotes.map(renderNote)}</div></section>}
        </div> : <div className="view-panel calendar-panel">
          <section className="calendar-hero"><p className="eyebrow">DEINE PLANUNG</p><h1>Dein <em>Kalender</em></h1></section>
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
                <div className={`calendar-day${isToday ? ' today' : ''}${dayNotes.length ? ' has-notes' : ''}`} key={date}>
                  {dayNotes.length > 1 ? (
                    <button className="calendar-date-button" onClick={() => openCalendarDate(date, dayNotes.map((note) => note.id))}>{day}</button>
                  ) : <span>{day}</span>}
                  <div className="calendar-events">
                    {dayNotes.map((note) => (
                      <button
                        className={`calendar-event${note.completed ? ' completed' : ''}`}
                        key={note.id}
                        onClick={() => setSelectedNoteId(note.id)}
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

        <nav className="bottom-nav" aria-label="Ansichten"><button className={view === 'list' ? 'active' : ''} onClick={() => changeView('list')}>{icons.list}<span>Gedanken</span></button><button className={view === 'calendar' ? 'active' : ''} onClick={() => changeView('calendar')}>{icons.calendar}<span>Kalender</span></button></nav>
        {selectedNoteId && (() => { const selectedNote = notes.find((note) => note.id === selectedNoteId); return selectedNote ? <div className="modal-backdrop" role="presentation" onClick={() => setSelectedNoteId(null)}><section className="event-modal glass-card" role="dialog" aria-modal="true" aria-labelledby="event-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setSelectedNoteId(null)} aria-label="Popup schließen">{icons.close}</button><span className="section-kicker">EREIGNIS</span><h2 id="event-title">{selectedNote.title}</h2><p>{selectedNote.text}</p>{selectedNote.deadline && <span className="deadline-label">{formatDate(selectedNote.deadline)}</span>}<div className="modal-actions"><button className={`modal-action complete${selectedNote.completed ? ' is-selected' : ''}`} onClick={() => { toggleNote(selectedNote.id); setSelectedNoteId(null); }} aria-label={selectedNote.completed ? 'Als offen markieren' : 'Als erledigt markieren'}>{icons.check}</button><button className="modal-action" onClick={() => editNote(selectedNote)} aria-label="Ereignis bearbeiten">{icons.edit}</button><button className="modal-action danger" onClick={() => deleteNote(selectedNote.id)} aria-label="Ereignis löschen">{icons.trash}</button></div></section></div> : null; })()}
        {calendarSelection && <div className="modal-backdrop" role="presentation" onClick={() => setCalendarSelection(null)}><section className="event-modal picker-modal glass-card" role="dialog" aria-modal="true" aria-labelledby="picker-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setCalendarSelection(null)} aria-label="Popup schließen">{icons.close}</button><span className="section-kicker">{formatDate(calendarSelection.date)}</span><h2 id="picker-title">Welches Ereignis?</h2><div className="modal-event-list">{calendarSelection.noteIds.map((id) => { const note = notes.find((item) => item.id === id); return note ? <button className="event-option" key={note.id} onClick={() => { setSelectedNoteId(note.id); setCalendarSelection(null); }}><span className="event-option-title">{note.title}</span><span>{note.text}</span>{icons.right}</button> : null; })}</div></section></div>}
        <footer><span className="footer-dot" />Deine Gedanken bleiben bei dir <span className="footer-separator">·</span> <strong>Wische für die nächste Ansicht</strong></footer>
      </section>
    </main>
  );
}

export default App;
