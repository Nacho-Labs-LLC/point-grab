<script>
  import { onMount } from 'svelte';
  import { pointGrab, getPointGrabApi, registerPointGrabPlugin } from '@point-grab/svelte';
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
  let walkthroughStarted = $state(false);
  let walkthroughComplete = $state(false);
  let reviewCount = $state(0);
  let walkthroughStep = $state(1);
  let promptPreview = $state('');

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

  function startWalkthrough() {
    walkthroughStarted = true;
    walkthroughComplete = false;
    reviewCount = 0;
    walkthroughStep = 1;
    promptPreview = '';
  }

  async function syncPromptPreview() {
    try {
      const prompt = await navigator.clipboard.readText();
      const count = (prompt.match(/^## Element /gm) ?? []).length;
      if (count > 0) {
        promptPreview = prompt;
        reviewCount = Math.min(count, 2);
      }
    } catch {
      // Clipboard reads can be denied outside a user gesture. A later accepted
      // review retries the preview without replacing the real capture flow.
    }
  }

  function handleCaptureSession(event) {
    if (!walkthroughStarted) return;
    const { action, annotationCount } = event.detail || {};

    if (action === 'accepted') {
      reviewCount = Math.min(annotationCount, 2);
      walkthroughStep = annotationCount === 1 ? 2 : 3;
      void syncPromptPreview();
    } else if (action === 'skipped' && walkthroughStep === 2) {
      walkthroughStep = 3;
    } else if (action === 'ended') {
      walkthroughComplete = reviewCount >= 2;
    }
  }

  onMount(() => {
    window.addEventListener('point-grab:capture-session', handleCaptureSession);
    registerPointGrabPlugin({
      name: 'svelte-guided-walkthrough',
      hooks: {
        onCopySuccess: () => {
          if (walkthroughStarted) void syncPromptPreview();
        },
      },
    });

    return () => {
      if (saveTimer) clearTimeout(saveTimer);
      window.removeEventListener('point-grab:capture-session', handleCaptureSession);
      getPointGrabApi()?.unregisterPlugin('svelte-guided-walkthrough');
    };
  });
</script>

<div use:pointGrab={{ devOnly: false }}>
  <header class="inkwell-header">
    <div class="inkwell-logo">
      <span class="inkwell-logotype">Inkwell</span>
      <span class="inkwell-beta">beta</span>
    </div>
    <div class="pg-hint">
      Toggle Point Grab with <kbd>Cmd+Shift+C</kbd> / <kbd>Ctrl+Shift+C</kbd>, then hover any element
    </div>
  </header>

  <section class="walkthrough-panel" aria-label="Guided capture walkthrough">
    <div class="walkthrough-copy">
      <span class="walkthrough-eyebrow">Guided capture</span>
      <h2>{walkthroughComplete ? 'Walkthrough complete' : 'Turn two UI notes into one prompt'}</h2>
      {#if !walkthroughStarted}
        <p>Start the guide, enter Capture Mode, then select two notes and accept their comments with a Skip in between.</p>
      {:else if walkthroughComplete}
        <p>Your two accepted comments were combined by the real capture session and copied as one review prompt.</p>
      {:else}
        <p>Step {walkthroughStep} of 3 — {walkthroughStep === 1 ? 'review the note title' : walkthroughStep === 2 ? 'skip the editor body to keep the session active' : 'review the tags'}, then continue.</p>
      {/if}
    </div>
    <div class="walkthrough-actions">
      {#if !walkthroughStarted || walkthroughComplete}
        <button class="walkthrough-start" onclick={startWalkthrough}>Start guided capture</button>
      {:else}
        <span class="walkthrough-progress" aria-live="polite">{reviewCount}/2 reviews accepted</span>
      {/if}
    </div>
    {#if promptPreview}
      <pre class="walkthrough-preview" data-walkthrough-preview aria-label="Aggregate prompt preview">{promptPreview}</pre>
    {/if}
  </section>

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
            class:walkthrough-target={walkthroughStarted && walkthroughStep === 1}
            data-walkthrough-target="note-title"
            type="text"
            value={selectedNote.title}
            oninput={updateTitle}
            placeholder="Note title"
          />

          <textarea
            class="editor-textarea"
            class:walkthrough-target={walkthroughStarted && walkthroughStep === 2}
            data-walkthrough-target="note-body"
            value={selectedNote.body}
            oninput={updateBody}
            placeholder="Start writing…"
          ></textarea>

          {#if selectedNote.tags.length > 0}
            <div
              class="editor-tags"
              class:walkthrough-target={walkthroughStarted && walkthroughStep === 3}
              data-walkthrough-target="note-tags"
            >
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
