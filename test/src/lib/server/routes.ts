import { z } from 'zod';
import { procedure, protectedProcedure, router } from './api';
import { FormDataInput } from '@patrick115/sveltekitapi';

export const r = router({
    testGET: procedure.GET.query(async () => {
        return 'Hello from GET';
    }),
    testPOST: procedure.POST.input(z.string()).query(async ({ input }) => {
        return 'Hello ' + input;
    }),
    multipleMethods: [
        procedure.GET.query(async () => 'GET'),
        procedure.POST.input(z.string()).query(async ({ input }) => input),
    ],
    formData: procedure.PUT.input(FormDataInput).query(({ input }) => {
        const resultObject: Record<string, unknown> = {};

        for (const [key, value] of input.entries()) {
            resultObject[key] = value;
        }

        return resultObject;
    }),
    protected: protectedProcedure.GET.query(() => {
        return 'OK';
    }),
    experiment: [
        procedure.GET.query(() => 'test1'),
        {
            aa: procedure.GET.query(() => 'test2'),
        },
    ],
    form: procedure.POST.input(FormDataInput).query(({ input }) => {
        const username = input.get('username');
        const password = input.get('password');

        if (username === 'admin' && password === 'admin') {
            return { status: true };
        }
        return { status: false };
    }),
});

export type AppRouter = typeof r;
