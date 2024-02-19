import { Procedure, TypedProcedure, type BaseParams, type Method, type Params } from './server/procedure.js';
import type { Any, Arrayable } from './types.js';

/**
 * @internal
 */
export type RouterObject = {
    [key: string]:
        | RouterObject
        | Arrayable<Procedure<Params<Any, Any, Any, Any>> | TypedProcedure<Params<Any, Any, Any, Any>>>;
};

export class Router<R extends RouterObject> {
    public endpoints: R;
    private pathedRoutes: Record<string, Partial<Record<Method, Procedure<BaseParams> | TypedProcedure<BaseParams>>>> =
        {};
    private paths: string[] = [];

    constructor(endpoints: R) {
        this.endpoints = endpoints;

        const keys: {
            id: string;
            path: string;
            endpoints: RouterObject;
        }[] = Object.keys(endpoints).map((key) => ({
            id: key,
            path: key,
            endpoints: endpoints,
        }));

        while (keys.length != 0) {
            const key = keys.pop()!;
            const value = key.endpoints[key.id];

            if (value instanceof Procedure || value instanceof TypedProcedure) {
                this.paths.push(key.path);
                this.pathedRoutes[key.path] = {
                    [value.method]: value,
                };
                continue;
            }

            if (Array.isArray(value)) {
                this.paths.push(key.path);

                const baseRecord: Partial<Record<Method, Procedure<BaseParams> | TypedProcedure<BaseParams>>> = {};

                for (const procedure of value) {
                    baseRecord[procedure.method] = procedure;
                }

                this.pathedRoutes[key.path] = baseRecord;

                continue;
            }

            const subKeys = Object.keys(value).map((subKey) => ({
                id: subKey,
                path: `${key.path}/${subKey}`,
                endpoints: key.endpoints[key.id] as RouterObject,
            }));

            keys.push(...subKeys);
        }
    }

    public includes(path: string) {
        if (this.paths.includes(path)) {
            return true;
        }

        return false;
    }

    public getPath(path: keyof typeof this.pathedRoutes) {
        return this.pathedRoutes[path];
    }
}
