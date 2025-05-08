<script lang="ts">
    import { API } from '$/lib/api';
    import { onMount } from 'svelte';
    import type { PageProps } from './$types';
    import { enhance } from '$app/forms';

    const { data, form }: PageProps = $props();

    let clientData = $state<any[]>([]);

    let testResult = $state<boolean[]>([]);

    onMount(async () => {
        console.log(await API.experiment.aa());

        const responses = [
            API.testGET(),
            API.testPOST('Pepo'),
            API.multipleMethods.GET(),
            API.multipleMethods.POST('POST'),
            (() => {
                const formData = new FormData();
                formData.set('name', 'Patrik');
                formData.set('password', 'coolPaSSw0rD');

                return API.formData(formData);
            })(),
            (async () => {
                const withoutCookie = await API.protected();

                document.cookie = 'name=patrick115';

                const withCookie = await API.protected();

                document.cookie = 'name=patrick115; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                return [withoutCookie, withCookie];
            })(),
        ];

        const results = [
            'fulfilled',
            'fulfilled',
            'fulfilled',
            'fulfilled',
            'fulfilled',
            'fulfilled',
        ] satisfies PromiseSettledResult<void>['status'][];

        const promiseResult = await Promise.allSettled(responses);

        let localTestResult: typeof testResult = [];
        let localClientData: typeof clientData = [];

        for (const resultId in promiseResult) {
            const promise = promiseResult[resultId];

            if (promise.status === results[resultId]) {
                localTestResult.push(true);
            } else {
                localTestResult.push(false);
            }

            if (promise.status === 'fulfilled') {
                localClientData.push(promise.value);
            } else {
                localClientData.push(undefined);
            }
        }

        testResult = localTestResult;
        clientData = localClientData;
    });

    const printData = (data: unknown) => {
        if (typeof data === 'number' || typeof data === 'bigint') {
            return data.toString();
        }

        if (typeof data === 'object') {
            return JSON.stringify(data);
        }

        return data;
    };
</script>

{#each data.serverData as item, id}
    <h1>Test #{id + 1}</h1>
    <pre>
        Server Result: {printData(item)}
        Client Result: {printData(clientData[id])}
        Client Status: {testResult[id] === true ? '👍' : '👎'}
    </pre>
{/each}

<form method="POST" use:enhance>
    <input type="text" name="username" placeholder="Name" />
    <input type="password" name="password" placeholder="Password" />
    <button type="submit">Submit</button>
</form>
{JSON.stringify(form)}
{#if form === null}
    <p>Form is null</p>
{:else if form.status == true}
    <p>You've entered correct data</p>
{:else}
    <p>You've entered incorrect data</p>
{/if}
