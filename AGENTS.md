## Command Hygiene

Validation commands must be non-emitting unless the user explicitly approves an emitting build or generation step.

Use this source-only check for kitsui:
- `pnpm exec tsc --noEmit --baseUrl src --moduleResolution node --target ES2022 --strict --esModuleInterop --allowJs --experimentalDecorators --skipLibCheck src\kitsui.ts`

Run lint in parallel with the TypeScript validation command:
- `pnpm exec lint`

Do not use task wrappers such as `npx task ts`, `pnpm task ts`, or build/watch/generation commands as validation unless the user has explicitly approved files being emitted or regenerated.

## Generic Component Builders

When a non-generic component builder's output type is not inferred correctly, provide the output type at the `Component` or `Component.Builder` call site.

Prefer:

```ts
const Example = Component<[], Example>('button', component => {
	const example: Example = component.extend<ExampleExtensions>(() => ({
		// extensions
	}))
	return example
})
```

Do not add a public builder namespace or cast the exported builder just to fix a non-generic output type. The explicit public builder object pattern is for generic builders whose public call signature must stay generic.

`Component.Builder(<T>(...) => ...)` does not preserve a generic public call signature by itself. For components whose public API must stay generic, define the implementation with `Component.Builder(...)`, then cast the exported builder value to an explicit public builder object type.

Prefer the object-style cast so the callable overloads and builder surface stay together:

```ts
const ExampleImplementation = Component.Builder(<T>(component: Component, value: T): Example<T> => {
	// implementation
}).setName('Example')

namespace Example {
	export type Params<T> = [value: T]

	export interface Builder extends Omit<Component.Builder<Params<unknown>, Example<unknown>>, 'from'> {
		<T> (...params: Params<T>): Example<T>
		from<COMPONENT extends Component, T> (component: COMPONENT | undefined, ...params: Params<T>): COMPONENT & Example<T>
	}
}

const Example = ExampleImplementation as never as Example.Builder
```

Do not patch over erased generic inference in downstream app code. Fix the public builder type in the component's own module so direct calls and `.and(...)` composition can both see the intended generic API.

## Custom Component Events

For Kitsui components with custom events, use `Component.WithEvents`.

Pattern:

```ts
import type { ComponentEvents } from 'Component'

interface ExampleEvents extends ComponentEvents {
	Commit (event: Example.CommitEvent): unknown
}

interface ExampleExtensions {
	readonly rows: State<readonly Row[]>
}

interface Example extends Component.WithEvents<ExampleEvents>, ExampleExtensions {
}

const Example = Component<Example.Params, Example>('div', (component, ...params) => {
	const example: Example = component.extend<ExampleExtensions>(() => ({
		rows,
	}))

	example.event.emit('Commit', event)

	return example
})
```

Custom component event names should be capitalized, such as `Commit` or `BackgroundOpen`. Do not use lowercase-only custom event names like `commit`.

When a custom event controls whether native/default behavior should continue, emit the custom event first and use `result.defaultPrevented`:

```ts
const result = example.event.emit('BackgroundOpen', path, data)
if (result.defaultPrevented)
	event.preventDefault()
```

Do not use `as never` casts for custom event emit/subscribe paths unless the component type genuinely cannot express the event. Fix the component output type instead.

## Sortable Lists

`Kit.Sortable(rows, key, render, options?)` owns generic row reordering. Use `options.draggable(row, index)` for inert rows such as headings or separators, and `options.droppable(row, index)` when a row should not receive drops. Keep this behaviour in kitsui rather than rebuilding drag/drop list semantics in downstream apps.
