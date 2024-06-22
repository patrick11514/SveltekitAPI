import { FormDataInput } from '@patrick115/sveltekitapi';
import { z } from 'zod';
import { procedure, protectedProcedure, router } from './api';

export const r = router({
    testGET: procedure.GET.query(async () => {
        return 'Hello from GET';
    }),
    testPOST: procedure.POST.input(z.string()).query(async ({ input }) => {
        return 'Hello ' + input;
    }),
    multipleMethods: [
        procedure.GET.query(async () => 'GET'),
        procedure.POST.input(z.string()).query(async ({ input }) => input)
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
            aa: procedure.GET.query(() => 'test2')
        }
    ]
});

export type AppRouter = typeof r;
