import { Server } from '$/lib/server/server';
import type { Actions, PageServerLoad } from './$types';

export const load = (async (ev) => {
    const formData = new FormData();
    formData.set('name', 'Patrik');
    formData.set('password', 'coolPaSSw0rD');

    //cookies result
    const withoutCookie = await Server.ssr.protected(ev);

    ev.cookies.set('name', 'patrick115', {
        path: '/'
    });

    const withCookie = await Server.ssr.protected(ev);
    //                               ^?

    ev.cookies.delete('name', {
        path: '/'
    });

    Server.ssr.formData;

    return {
        serverData: [
            await Server.ssr.testGET(ev),
            await Server.ssr.testPOST(ev, 'Pepa'),
            await Server.ssr.multipleMethods.GET(ev),
            await Server.ssr.multipleMethods.POST(ev, 'POST'),
            await Server.ssr.formData(ev, formData),
            [withoutCookie, withCookie]
        ]
    };
}) satisfies PageServerLoad;

export const actions = {
    default: Server.actions.form
} satisfies Actions;
