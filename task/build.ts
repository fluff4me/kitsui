import fs from 'fs/promises'
import { Task } from 'task'
import ts from './ts'

export default Task('build', async task => {
	await task.run(ts)
	await fs.rm('out/index.tsbuildinfo', { force: true, recursive: true })

	let js = await fs.readFile('out/index.js', 'utf-8')
	let dts = await fs.readFile('out/index.d.ts', 'utf-8')
	js = js.replaceAll('define("', 'define("kitsui/').replace('"kitsui/kitsui"', '"kitsui"')
	dts = dts.replaceAll('declare module "', 'declare module "kitsui/').replace('"kitsui/kitsui"', '"kitsui"')
	await fs.writeFile('out/index.js', js, 'utf-8')
	await fs.writeFile('out/index.d.ts', dts, 'utf-8')

	const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'))
	delete packageJson.private
	delete packageJson.scripts
	delete packageJson.devDependencies
	await fs.writeFile('out/package.json', JSON.stringify(packageJson, null, '\t'), 'utf-8')
})
