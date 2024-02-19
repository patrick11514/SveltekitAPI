import type { Router, RouterObject } from '../router.js';
import { Params, Procedure, TypedProcedure } from '../server/procedure.js';
import type { Any, DistributeMethods, ExtractMethod, ExtractReturnType, ExtractType, HydrateData } from '../types.js';

type FetchFunction<T, O> = T extends 'NOTHING' ? () => Promise<O> : (data: T) => Promise<O>;

type DistributeFunctions<T, M> = T extends Any
    ? ExtractMethod<T> extends M
        ? FetchFunction<ExtractType<T>, ExtractReturnType<T>>
        : never
    : never;

type FinalObjectBuilder<O> = O extends object
    ? {
          [K in keyof O]: O[K] extends Procedure<Params<Any, Any, Any, infer Output>>
              ? FetchFunction<'NOTHING', Output>
              : O[K] extends TypedProcedure<Params<infer T, Any, Any, infer Output>>
                ? FetchFunction<T, Output>
                : O[K] extends Array<Any>
                  ? {
                        [Key in DistributeMethods<O[K][number]>]: DistributeFunctions<O[K][number], Key>;
                    }
                  : FinalObjectBuilder<O[K]>;
      }
    : O;

type APIClient<R extends Router<RouterObject>> = {
    basePath: string;
    hydrateFromServer: (data: HydrateData<R>) => void;
} & FinalObjectBuilder<R['endpoints']>;

const fetchFunction = (path: string, method: string) => {
    return async (data?: Any) => {
        const request = await fetch(path, {
            method,
            body: data
                ? data instanceof FormData
                    ? data
                    : typeof data === 'object'
                      ? JSON.stringify(data)
                      : data
                : undefined,
        });

        const text = await request.text();

        try {
            const json = JSON.parse(text);

            return json;
        } catch (_) {
            return text;
        }
    };
};

export const createAPIClient = <R extends Router<RouterObject>>(basePath: string) => {
    return {
        basePath,
        hydrateFromServer: function (data: HydrateData<R>) {
            const toDo: {
                fullPath: string;
                key: string;
                parent: Any;
                obj: Any;
            }[] = Object.keys(data).map((key) => {
                return {
                    fullPath: '/' + key,
                    key,
                    parent: this,
                    obj: data,
                };
            });

            while (toDo.length != 0) {
                const top = toDo.pop()!;
                const data = top.obj[top.key];

                if (typeof data === 'string') {
                    top.parent[top.key] = fetchFunction(this.basePath + top.fullPath, data);

                    continue;
                }

                if (Array.isArray(data)) {
                    top.parent[top.key] = {};

                    data.forEach((procedure) => {
                        top.parent[top.key][procedure] = fetchFunction(this.basePath + top.fullPath, procedure);
                    });
                    continue;
                }

                top.parent[top.key] = {};

                toDo.push(
                    ...Object.keys(data).map((key) => {
                        return {
                            fullPath: top.fullPath + '/' + key,
                            key,
                            parent: top.parent[top.key],
                            obj: data,
                        };
                    }),
                );
            }
        },
    } as APIClient<R>;
};
