<script lang="ts">
    import { API } from '$/lib/api';
    import type { Snippet } from 'svelte';
    import type { LayoutData } from './$types';

    let { children, data }: { children: Snippet, data: LayoutData } = $props();

    API.hydrateFromServer(data.api);
</script>

{@render children()}
