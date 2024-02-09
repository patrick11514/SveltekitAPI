import type { Router, RouterObject } from '../router.js'
import type { HydrateData } from '../types.js'

/*export type DeepReplaceWith<O, R> = O extends object
    ? {
          [K in keyof O]: O[K] extends Procedure<Any> ? R : O[K] extends Array<Any> ? ReplaceArrayWith<O[K], R[]> : DeepReplaceWith<O[K], R>
      }
    : O

type HydratedDataProps<R extends Router<RouterObject>, H extends HydrateData<R>> = {
    [K in keyof R["endpoints"]]: K extends keyof H ? R["endpoints"][K] extends Procedure<Any> ? H[K] : : never
}*/

//type HydratedData<R extends Router<RouterObject>, H extends HydrateData<R>> = H
//hydrateFromServer: (data: HydrateData<R>) => void

export const createAPIClient = <R extends Router<RouterObject>>() => {
    return {
        hydrateFromServer: function (data: HydrateData<R>) {
            console.log(data)

            //type test = HydratedData<R, typeof data>
        },
    }
}
