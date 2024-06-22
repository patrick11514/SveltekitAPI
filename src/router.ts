import { Procedure, TypedProcedure, type BaseParams, type Method, type Params } from './server/procedure.js';
import type { Any, Arrayable } from './types.js';

/**
 * @internal
 * Router Object type
 */
export type RouterObject = {
    [$Key: string]:
        | RouterObject
        | Arrayable<Procedure<Params<Any, Any, Any, Any>> | TypedProcedure<Params<Any, Any, Any, Any>> | RouterObject>;
};

/**
 * Router Class
 */
export class Router<$Router extends RouterObject> {
    public endpoints: $Router;
    private pathedRoutes: Record<string, Partial<Record<Method, Procedure<BaseParams> | TypedProcedure<BaseParams>>>> =
        {};
    private paths: string[] = [];

    /**
     * Constructor
     * @param endpoints Router object
     */
    constructor(endpoints: $Router) {
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

                //separate procedures and subroutes
                const procedures: (Procedure<BaseParams> | TypedProcedure<BaseParams>)[] = [];
                //merge objects, last object keys are in priority
                let subRouter: RouterObject = {};

                for (const item of value) {
                    if (item instanceof Procedure || item instanceof TypedProcedure) {
                        procedures.push(item);
                    } else {
                        subRouter = { ...subRouter, ...item };
                    }
                }

                for (const procedure of procedures) {
                    baseRecord[procedure.method] = procedure;
                }

                this.pathedRoutes[key.path] = baseRecord;

                //subkeys of router

                const subKeys = Object.keys(subRouter).map((subKey) => ({
                    id: subKey,
                    path: `${key.path}/${subKey}`,
                    endpoints: subRouter,
                }));

                keys.push(...subKeys);

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

    /**
     * Check if router includes this path
     * @param path Path to be checked
     * @returns If path is included in this router
     */
    public includes(path: string) {
        if (this.paths.includes(path)) {
            return true;
        }

        return false;
    }

    /**
     * Get procedure form Path
     * @param path
     * @returns Procedure on that path, or undefined
     */
    public getPath(path: keyof typeof this.pathedRoutes) {
        return this.pathedRoutes[path];
    }
}
