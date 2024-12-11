# Sveltekit API

Package for creating [SvelteKit](https://kit.svelte.dev/) API endpoints with typesafe routes and client.

_This package is highly inspired by [TRPC](https://trpc.io)'s structure._

## Showcase

![Showcase](./assets/showcase.gif)

-   First step is creating new API with your context, which will be accesible in every procedure and middleware.
    Also you can export router and basic procedure.

    **src/lib/server/api.ts**

    ```TS

    import { APICreate } from '@patrick115/sveltekitapi'
    import type { Context } from './context'

    export const api = new APICreate<Context>()

    export const router = api.router
    export const procedure = api.procedure

    ```

-   Here you can create your context, which get called on every request and get passed SvelteKit's RequestEvent.

    **src/lib/server/context.ts**

    ```TS
    import type { AsyncReturnType, CreateContext } from '@patrick115/sveltekitapi'

    export const context = (async (ev /*<- SvelteKit's RequestEvent */) => {
        return {} // Here you can put your context
    }) satisfies CreateContext

    export type Context = AsyncReturnType<typeof context>
    ```

-   Now we create router and pass object to it with our procedures. In each procedure we can specify HTTP method (GET, POST, PUT, DELETE, PATCH). For methods other than GET we can specify input schema with .input(ZodSchema). Then we specify what to do with the request with .query(). Parameters for query function are: context, input (in case of method other than GET), and ev, which is RequestEvent from SvelteKit in case you need to set cookies, or get user's ip or access the raw request.

    **src/lib/server/routes.ts**

    ```TS
    import { json } from '@sveltejs/kit'
    import { z } from 'zod'
    import { postProcedure, proc2, procedure, router } from './api'

    export const r = router({
        example: procedure.GET.query(() => {
            return 'Hello from the API!'
        }),
    })

    export type AppRouter = typeof r
    ```

-   At the end we create server and pass in the router, path to API and context.

    **src/lib/server/server.ts**

    ```TS
    import { APIServer } from '@patrick115/sveltekitapi'
    import { context } from './context'
    import { r } from './routes'

    export const Server = new APIServer({
        router: r,
        path: '/api',
        context
    })
    ```

-   If we want to use our API in SvelteKit's endpoint we can do it like this:
    (export const for each method you want to use, in this case GET, POST, PUT, DELETE, PATCH)

    **src/routes/api/[...data]/+server.ts**

    ```TS
    import { Server } from '$/lib/server/server'

    export const GET = Server.handler
    export const POST = Server.handler
    export const PUT = Server.handler
    export const DELETE = Server.handler
    export const PATCH = Server.handler

    ```

-   Now syncing with frontend
-   First we create an API client. As type we pass our router type and as parameter we pass rootPath for our API (same as in server).

    **src/lib/api.ts**

    ```TS
    import { createAPIClient } from '@patrick115/sveltekitapi'
    import type { AppRouter } from './server/routes'

    export const API = createAPIClient<AppRouter>('/api')

    ```

-   Syncing with frontend. From load function we return object with our object returned from Server.hydrateToClient() function.

    **src/routes/+layout.server.ts**

    ```TS
    import { Server } from '$/lib/server/server'
    import type { LayoutServerLoad } from './$types'

    export const load = (async () => {
        return {
            api: Server.hydrateToClient()
        }
    }) satisfies LayoutServerLoad
    ```

-   Now we need to pass this object to our client

    **src/routes/+layout.svelte**

    ```html
    <script lang="ts">
        import { API } from '$/lib/api';
        import type { Snippet } from 'svelte';
        import type { LayoutData } from './$types';

        let { children, data }: { children: Snippet; data: LayoutData } = $props();

        API.hydrateFromServer(data.api);
    </script>

    {@render children()}
    ```

-   Now we can call our API from our frontend

    **src/routes/+page.svelte**

    ```html
    <script lang="ts">
        import { API } from '$/lib/api';
        import { onMount } from 'svelte';

        onMount(async () => {
            const res = await API.example();
            console.log(res);
        });
    </script>

    <h1>Hello from SvelteKit!</h1>
    ```

## Installation

```bash
#npm
npm install @patrick115/sveltekitapi

#pnpm
pnpm install @patrick115/sveltekitapi

#yarn
yarn add @patrick115/sveltekitapi
```

## Usage

### Context

Context is a function that gets called on every request and returns object with data that will be accesible in every procedure and middleware. It gets passed SvelteKit's RequestEvent.

Example of passing user's IP and session cookie to every procedure and middleware.

```TS
import type { AsyncReturnType, CreateContext } from '@patrick115/sveltekitapi'

export const context = (async (ev) => {
    const ip = ev.getClientAddress()
    const cookie = ev.cookies.get("session")
    return {
        cookie,
        ip
    }
}) satisfies CreateContext

export type Context = AsyncReturnType<typeof context>
```

### Middleware

Middleware is a function that gets called before every request on procedure, that uses that middleware. It gets passed context, input (with unknown type, because it can be used on multiple endpoints with multiple methods. In case of GET method, input contains undefined), SvelteKit's RequestEvent and next function, which is used to call next middleware or procedure. You need to call this function at the end of your middleware and return its result. You can pass new context as next function's parameter.

Example of middleware that checks if user is logged in and if not, it returns error.

```TS
import { MiddleWareError } from '@patrick115/sveltekitapi'

export const procedure = api.procedure

export const securedProcedure = procedure.use(async ({ctx, next}) => {
    if (!ctx.cookie) {
        throw new MiddleWareError({
            status: 401,
            message: 'You need to be logged in to access this endpoint.'
        })
    }

    const data = jwt.getCookie<User>(ctx.cookie)

    if (!data) {
        throw new MiddleWareError({
            status: 401,
            message: 'You need to be logged in to access this endpoint.'
        })
    }

    return next({
        ...ctx, //note, that context will be overwritten with new context, so if you want to pass some data from old context, you need to pass it here
        user: data
    })
})
```

### Procedure

In router we can define procedures, each procedure can have each HTTP method (GET, POST, PUT, DELETE, PATCH). For methods other than GET we can specify input schema with .input(ZodSchema). Then we specify what to do with the request with .query(). Parameters for query function are: context, input (in case of method other than GET), and ev, which is RequestEvent from SvelteKit in case you need to set cookies, or get user's ip or access the raw request.

Note: if some procedure implements some middleware, return type will be ErrorApiResponse | your returned type, since you can throw error from middleware.

Example of procedure that returns Hello World.

```TS

import { procedure, router } from './api'

export const r = router({
    example: procedure.GET.query(() => {
        return `Hello world` as const
    })
})

export type AppRouter = typeof r
```

Calling this procedure from frontend.

```TS
const data = await API.example()
console.log(data) //Hello world
//           ^? data: "Hello world"
//Note, if this procedure would implement some middleware, return type would be ErrorApiResponse | "Hello world"
```

Multiple HTTP methods on one endpoint.

```TS
import { z } from 'zod'
import { procedure, router } from './api'

export const r = router({
    example: [
        procedure.GET.query(() => {
            return `Hello world` as const
        }),
        procedure.POST.input(
            z.object({
                username: z.string()
            })
        ).query(({ input }) => {
            return `Hello ${input.username}` as const
        })
    ]
})

export type AppRouter = typeof r
```

Calling this procedure from frontend.

```TS
const data = await API.example.GET() //here we can see, that we need to select which method we want to call
console.log(data)
//           ^? data: "Hello world"

const data2 = await API.example.POST({
    username: 'Patrik'
})
console.log(data2)
//           ^? data: "Hello ${string}"
```

Procedure with FormData as input

```TS
import { FormDataInput } from '@patrick115/sveltekitapi'
import { procedure, router } from './api'

export const r = router({
    example: procedure.POST.input(FormDataInput).query(({ input }) => {
        const name = input.get('name')
        return `Hello ${name ?? 'World'}` as const
    })
})

export type AppRouter = typeof r

```

Calling this procedure from frontend.

```TS
const formData = new FormData()
formData.append("name", "Patrik)

const data = await API.example(formData)
console.log(data) //Hello Patrik
//           ^? data: "Hello ${string}"
```

Extending endpoint with sub routes

```TS
import { z } from 'zod'
import { procedure, router } from './api'

export const r = router({
    example: [
        procedure.GET.query(() => {
            return `Hello world` as const
        }),
        procedure.POST.input(
            z.object({
                username: z.string()
            })
        ).query(({ input }) => {
            return `Hello ${input.username}` as const
        }),
        //Subroutes, but only single sub-object is supported
        {
            // /api/example/hello
            hello: procedure.GET.query(() => {
                return "Hello World, again" as const
            })
        }
    ]
})

export type AppRouter = typeof r
```

Calling this procedure from frontend.

```TS
const data = await API.example.GET() //here we can see, that we need to select which method we want to call
console.log(data)
//           ^? data: "Hello world"

const data2 = await API.example.POST({
    username: 'Patrik'
})
console.log(data2)
//           ^? data: "Hello ${string}"

const data3 = await API.example.hello()
console.log(data3)
//           ^? data: "Hello World, again"
```
