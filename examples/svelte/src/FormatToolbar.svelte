<script>
  let { open, onformat } = $props();
</script>
{#if open}
  <div class="format-toolbar visible" role="group" aria-label="Markdown formatting">
    <button class="format-btn" aria-label="Bold" onclick={() => onformat('**', '**')}><strong>B</strong></button>
    <button class="format-btn" aria-label="Italic" onclick={() => onformat('_', '_')}><em>I</em></button>
    <button class="format-btn" aria-label="Heading" onclick={() => onformat('# ', '')}>H1</button>
    <button class="format-btn" aria-label="Link" onclick={() => onformat('[', '](https://example.com)')}>↗</button>
  </div>
{/if}
