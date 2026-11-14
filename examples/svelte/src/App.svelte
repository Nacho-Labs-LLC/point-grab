<script>
  import { onMount } from 'svelte';
  import { pointGrab } from '@point-grab/svelte';
  import './app.css';
  import NoteCard from './NoteCard.svelte';
  import FormatToolbar from './FormatToolbar.svelte';
  import GrabGuide from './GrabGuide.svelte';

  const initialNotes = [
    { id: 1, title: 'Product launch checklist', body: 'Review pricing page copy\nUpdate hero section\nTest mobile breakpoints', tags: ['work', 'launch'] },
    { id: 2, title: 'Weekend reading', body: 'The Pragmatic Programmer — chapter 4\nCheck Hacker News discussion', tags: ['personal'] },
    { id: 3, title: 'AI prompting tips', body: 'Be specific about which element\nInclude component name and file\nDescribe what you want changed', tags: ['dev'] },
  ];

  let notes = $state(initialNotes);
  let selectedNoteId = $state(1);
  let toolbarOpen = $state(false);
  let saving = $state(false);
  let nextId = $state(4);
  let query = $state('');
  let editor = $state(null);
  let visibleNotes = $derived(notes.filter(note => `${note.title} ${note.body} ${note.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())));

  let saveTimer = null;

  let selectedNote = $derived(notes.find(n => n.id === selectedNoteId) ?? notes[0]);
  let wordCount = $derived(
    selectedNote?.body.trim()
      ? selectedNote.body.trim().split(/\s+/).length
      : 0
  );

  function selectNote(id) {
    selectedNoteId = id;
  }

  function updateTitle(e) {
    notes = notes.map(n =>
      n.id === selectedNoteId ? { ...n, title: e.target.value } : n
    );
    triggerSave();
  }

  function updateBody(e) {
    notes = notes.map(n =>
      n.id === selectedNoteId ? { ...n, body: e.target.value } : n
    );
    triggerSave();
  }

  function triggerSave() {
    saving = true;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saving = false;
    }, 1500);
  }

  function newNote() {
    query = '';
    const id = nextId++;
    notes = [
      { id, title: 'Untitled note', body: '', tags: [] },
      ...notes,
    ];
    selectedNoteId = id;
  }

  function formatSelection(prefix, suffix) {
    if (!editor || !selectedNote) return;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const body = selectedNote.body;
    const selection = body.slice(start, end) || 'text';
    notes = notes.map(note => note.id === selectedNoteId ? { ...note, body: body.slice(0, start) + prefix + selection + suffix + body.slice(end) } : note);
    triggerSave();
    editor.focus();
  }

  onMount(() => {
    return () => {
      if (saveTimer) clearTimeout(saveTimer);
    };
  });
</script>

<div use:pointGrab={{ activationMode: 'hold', devOnly: false }}>
  <header class="inkwell-header">
    <div class="inkwell-logo">
      <span class="inkwell-logotype">Inkwell</span>
      <span class="inkwell-beta">beta</span>
    </div>
    <div class="pg-hint">
      Hold <kbd>Cmd+C</kbd> / <kbd>Ctrl+C</kbd>, hover any element, click to grab its context
    </div>
  </header>

  <div class="app-layout">
    <!-- Left sidebar -->
    <aside class="note-sidebar">
      <div class="sidebar-top">
        <button class="new-note-btn" onclick={newNote}>+ New Note</button>
        <input class="note-search" aria-label="Search notes" type="search" placeholder="Find a thought…" bind:value={query} />
      </div>

      <div class="note-list">
        {#each visibleNotes as note (note.id)}
          <NoteCard {note} active={note.id === selectedNoteId} onselect={selectNote} />
        {/each}
        {#if visibleNotes.length === 0}<p class="empty-notes">No matching notes.</p>{/if}
      </div>
    </aside>

    <!-- Right editor panel -->
    <main class="editor-panel">
      {#if selectedNote}
        <div class="editor-topbar">
          <FormatToolbar open={toolbarOpen} onformat={formatSelection} />
          <button class="toggle-format-btn" aria-expanded={toolbarOpen} onclick={() => toolbarOpen = !toolbarOpen}>
            {toolbarOpen ? 'Hide toolbar' : 'Format ↓'}
          </button>

          <div class="editor-meta">
            <span class="word-count">{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
            <span class="session-status" role="status">{saving ? 'Updating…' : 'In this tab only'}</span>
          </div>
        </div>

        <div class="editor-body">
          <div class="writing-flow"><span class="motion-pen" data-testid="motion-sample" aria-hidden="true">✎</span><span class="flow-help"><button data-testid="freeze-trigger" aria-describedby="flow-tip">Writing flow ↗</button><span id="flow-tip" role="tooltip" data-testid="freeze-popover">A little motion for a quiet workspace. Hover or focus here and use Point Grab Freeze (F) to inspect this moment. Markdown controls wrap your selected text.</span></span></div>
          <input
            class="editor-title"
            aria-label="Note title"
            type="text"
            value={selectedNote.title}
            oninput={updateTitle}
            placeholder="Note title"
          />

          <textarea
            class="editor-textarea"
            aria-label="Note body"
            bind:this={editor}
            value={selectedNote.body}
            oninput={updateBody}
            placeholder="Start writing…"
          ></textarea>

          {#if selectedNote.tags.length > 0}
            <div class="editor-tags">
              {#each selectedNote.tags as tag}
                <span class="tag">{tag}</span>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </main>
  </div>
  <GrabGuide />
</div>
