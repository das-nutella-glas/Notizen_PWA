import { FormEvent, type CSSProperties, useEffect, useMemo, useState } from 'react';

type Note = {
  id: string;
  text: string;
  createdAt: number;
  completed: boolean;
};

const initialNotes: Note[] = [
  { id: 'welcome', text: 'Willkommen in deinem Gedankenraum.', createdAt: Date.now() - 1000 * 60 * 5, completed: false },
  { id: 'idea', text: 'Eine kleine Idee ist der Anfang von etwas Großem.', createdAt: Date.now() - 1000 * 60 * 4, completed: false },
];

const icons = {
  spark: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 1.55 6.45L20 10l-6.45 1.55L12 18l-1.55-6.45L4 10l6.45-1.55L12 2Z" /><path d="m19 16 .63 2.37L22 19l-2.37.63L19 22l-.63-2.37L16 19l2.37-.63L19 16Z" /></svg>,
  plus: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>,
  check: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7" /></svg>,
  trash: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>,
  edit: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16.5-.75 3.25L6.5 19 18 7.5 15.5 5 4 16.5ZM14 6.5l2.5 2.5" /></svg>,
  moon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.5 8.5 0 1 0 20.5 15.2Z" /></svg>,
};

function App() {
  const [notes, setNotes] = useState<Note[]>(() => {
    const saved = localStorage.getItem('gedankenraum-notes');
    return saved ? JSON.parse(saved) as Note[] : initialNotes;
  });
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNightMode, setIsNightMode] = useState(false);

  useEffect(() => {
    localStorage.setItem('gedankenraum-notes', JSON.stringify(notes));
  }, [notes]);

  const openNotes = useMemo(() => notes.filter((note) => !note.completed), [notes]);
  const completedNotes = useMemo(() => notes.filter((note) => note.completed), [notes]);

  function saveNote(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    if (editingId) {
      setNotes((current) => current.map((note) => note.id === editingId ? { ...note, text } : note));
      setEditingId(null);
    } else {
      setNotes((current) => [{ id: crypto.randomUUID(), text, createdAt: Date.now(), completed: false }, ...current]);
    }
    setDraft('');
  }

  function editNote(note: Note) {
    setDraft(note.text);
    setEditingId(note.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggleNote(id: string) {
    setNotes((current) => current.map((note) => note.id === id ? { ...note, completed: !note.completed } : note));
  }

  function deleteNote(id: string) {
    setNotes((current) => current.filter((note) => note.id !== id));
  }

  return (
    <main className={`app-shell${isNightMode ? ' night-mode' : ''}`}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <section className="app-content">
        <header className="topbar">
          <div className="brand"><span className="brand-mark">{icons.spark}</span><span>Gedankenraum</span></div>
          <button className="icon-button" onClick={() => setIsNightMode((current) => !current)} aria-label="Darstellung wechseln">{icons.moon}</button>
        </header>

        <section className="hero">
          <p className="eyebrow">DEIN RUHIGER ORT FÜR IDEEN</p>
          <h1>Was geht dir<br /><em>durch den Kopf?</em></h1>
          <p className="hero-copy">Halte deine Gedanken fest, bevor sie weiterziehen.</p>
        </section>

        <form className="note-composer glass-card" onSubmit={saveNote}>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Eine neue Idee festhalten ..."
            aria-label="Neue Notiz"
            rows={3}
          />
          <div className="composer-footer">
            <span>{editingId ? 'Notiz bearbeiten' : 'Nur für dich bestimmt'}</span>
            <button className="add-button" type="submit" disabled={!draft.trim()}>
              {editingId ? 'Speichern' : 'Hinzufügen'} <span>{icons.plus}</span>
            </button>
          </div>
        </form>

        <section className="notes-section">
          <div className="section-heading">
            <div><span className="section-kicker">DEINE SAMMLUNG</span><h2>Offene Gedanken</h2></div>
            <span className="count-badge">{openNotes.length}</span>
          </div>
          <div className="notes-list">
            {openNotes.length === 0 && <div className="empty-state">Alles erledigt. Zeit für neue Gedanken.</div>}
            {openNotes.map((note, index) => (
              <article className="note-card glass-card" style={{ '--delay': `${index * 70}ms` } as CSSProperties} key={note.id}>
                <button className="complete-button" onClick={() => toggleNote(note.id)} aria-label="Als erledigt markieren">{icons.check}</button>
                <p>{note.text}</p>
                <div className="note-actions">
                  <button onClick={() => editNote(note)} aria-label="Notiz bearbeiten">{icons.edit}</button>
                  <button onClick={() => deleteNote(note.id)} aria-label="Notiz löschen">{icons.trash}</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {completedNotes.length > 0 && <section className="completed-section">
          <div className="section-heading"><div><span className="section-kicker">ABGESCHLOSSEN</span><h2>Erledigte Gedanken</h2></div><span className="count-badge muted">{completedNotes.length}</span></div>
          <div className="notes-list">
            {completedNotes.map((note) => <article className="note-card glass-card completed" key={note.id}><button className="complete-button selected" onClick={() => toggleNote(note.id)} aria-label="Als offen markieren">{icons.check}</button><p>{note.text}</p><div className="note-actions"><button onClick={() => deleteNote(note.id)} aria-label="Notiz löschen">{icons.trash}</button></div></article>)}
          </div>
        </section>}

        <footer><span className="footer-dot" />Deine Gedanken bleiben bei dir <span className="footer-separator">·</span> <strong>Bereit für deine nächste Idee?</strong></footer>
      </section>
    </main>
  );
}

export default App;
