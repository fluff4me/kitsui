import fs from 'fs/promises'
import { Task } from 'task'
import ts from './ts'

export default Task('build', async task => {
	await task.run(ts)
	await fs.rm('out/index.tsbuildinfo', { force: true, recursive: true })

	let js = await fs.readFile('out/index.js', 'utf-8')
	let dts = await fs.readFile('out/index.d.ts', 'utf-8')

	js = js
		.replace(/define\("([^"]*?)", \["require", "exports"(?:,([^\]]*))?\]/g, (_, name: string, imports: string) => {
			if (name !== 'kitsui') name = `kitsui/${name}`
			imports = !imports ? '' : `,${(imports
				.replace(/ "(?!kitsui)/g, ' "kitsui/')
			)}`
			return `define("${name}", ["require", "exports"${imports}]`
		})
	dts = dts
		.replace(/declare module "(?!kitsui)/g, 'declare module "kitsui/')
		.replace(/from "(?!kitsui)/g, 'from "kitsui/')
		.replace(/import\("(?!kitsui)/g, 'import("kitsui/')

	await fs.writeFile('out/index.js', js, 'utf-8')
	await fs.writeFile('out/index.d.ts', dts, 'utf-8')

	const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'))
	delete packageJson.private
	delete packageJson.scripts
	delete packageJson.devDependencies
	await fs.writeFile('out/package.json', JSON.stringify(packageJson, null, '\t'), 'utf-8')
})
