import { APICreate, MiddleWareError } from '@patrick115/sveltekitapi';
import type { Context } from './context';

export const api = new APICreate<Context>();

export const router = api.router;
export const procedure = api.procedure;
export const protectedProcedure = procedure.use(async ({ ctx, next }) => {
    if (ctx.name !== 'patrick115') {
        throw new MiddleWareError({
            status: false,
            code: 401,
            message: 'Unauthorized',
        });
    }
    return next(ctx);
});
