<script lang="ts">
    import { API } from '$/lib/api';
    import type { LayoutData } from './$types';

    export let data: LayoutData;

    API.hydrateFromServer(data.api);
</script>

<slot />
