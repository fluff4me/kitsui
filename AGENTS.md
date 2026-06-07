## Command Hygiene

Validation commands must be non-emitting unless the user explicitly approves an emitting build or generation step.

Use this source-only check for kitsui:
- `pnpm exec tsc --noEmit --baseUrl src --moduleResolution node --target ES2022 --strict --esModuleInterop --allowJs --experimentalDecorators --skipLibCheck src\kitsui.ts`

Run lint in parallel with the TypeScript validation command:
- `pnpm exec lint`

Do not use task wrappers such as `npx task ts`, `pnpm task ts`, or build/watch/generation commands as validation unless the user has explicitly approved files being emitted or regenerated.
