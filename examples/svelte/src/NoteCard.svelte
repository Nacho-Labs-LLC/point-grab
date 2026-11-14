<script>
  let { note, active, onselect } = $props();
</script>
<button class="note-item {active ? 'active' : ''}" aria-pressed={active} onclick={() => onselect(note.id)} data-testid="note-card">
  <span class="note-title-preview">{note.title || 'Untitled note'}</span>
  <span class="note-snippet">{note.body.split('\n')[0] || 'No content'}</span>
  {#if note.tags.length > 0}<span class="note-tags">{#each note.tags as tag}<span class="tag">{tag}</span>{/each}</span>{/if}
</button>
