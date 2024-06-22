import type { AsyncReturnType, CreateContext } from '@patrick115/sveltekitapi';

export const context = (async ({ cookies }) => {
    return {
        name: cookies.get('name'),
    };
}) satisfies CreateContext;

export type Context = AsyncReturnType<typeof context>;
