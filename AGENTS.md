## Command Hygiene

Validation commands must be non-emitting unless the user explicitly approves an emitting build or generation step.

Use this source-only check for kitsui:
- `pnpm exec tsc --noEmit --baseUrl src --moduleResolution node --target ES2022 --strict --esModuleInterop --allowJs --experimentalDecorators --skipLibCheck src\kitsui.ts`

Run lint in parallel with the TypeScript validation command:
- `pnpm exec lint`

Do not use task wrappers such as `npx task ts`, `pnpm task ts`, or build/watch/generation commands as validation unless the user has explicitly approved files being emitted or regenerated.

## Generic Component Builders

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

## Sortable Lists

`Kit.Sortable(rows, key, render, options?)` owns generic row reordering. Use `options.draggable(row, index)` for inert rows such as headings or separators, and `options.droppable(row, index)` when a row should not receive drops. Keep this behaviour in kitsui rather than rebuilding drag/drop list semantics in downstream apps.
