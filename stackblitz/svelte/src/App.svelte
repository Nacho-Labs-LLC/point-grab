<script>
  import { onMount } from 'svelte';
  import { pointGrab } from '@point-grab/svelte';
  import './app.css';

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
    const id = nextId++;
    notes = [
      { id, title: 'Untitled note', body: '', tags: [] },
      ...notes,
    ];
    selectedNoteId = id;
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
      </div>

      <div class="note-list">
        {#each notes as note (note.id)}
          <button
            class="note-item {note.id === selectedNoteId ? 'active' : ''}"
            onclick={() => selectNote(note.id)}
          >
            <div class="note-title-preview">{note.title || 'Untitled note'}</div>
            <div class="note-snippet">{note.body.split('\n')[0] || 'No content'}</div>
            {#if note.tags.length > 0}
              <div class="note-tags">
                {#each note.tags as tag}
                  <span class="tag">{tag}</span>
                {/each}
              </div>
            {/if}
          </button>
        {/each}
      </div>
    </aside>

    <!-- Right editor panel -->
    <main class="editor-panel">
      {#if selectedNote}
        <div class="editor-topbar">
          <div class="format-toolbar" class:visible={toolbarOpen}>
            <button class="format-btn" title="Bold"><strong>B</strong></button>
            <button class="format-btn" title="Italic"><em>I</em></button>
            <button class="format-btn" title="Heading">H1</button>
            <button class="format-btn" title="Link">🔗</button>
          </div>
          <button class="toggle-format-btn" onclick={() => toolbarOpen = !toolbarOpen}>
            {toolbarOpen ? 'Hide toolbar' : 'Format ↓'}
          </button>

          <div class="editor-meta">
            <span class="word-count">{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
            {#if saving}
              <span class="saving-dot" aria-label="Saving..."></span>
            {/if}
          </div>
        </div>

        <div class="editor-body">
          <input
            class="editor-title"
            type="text"
            value={selectedNote.title}
            oninput={updateTitle}
            placeholder="Note title"
          />

          <textarea
            class="editor-textarea"
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
</div>
