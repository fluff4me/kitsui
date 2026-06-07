import { Task } from 'task'

export default Task('install', async task => task.install(
	{
		path: '.',
		devDependencies: {
			task: { repo: 'chirivulpes/task', branch: 'package' },
			lint: { repo: 'fluff4me/lint' },
			chiri: { repo: 'fluff4me/chiri', branch: 'package' },
			weaving: { repo: 'chirivulpes/weaving', branch: 'package' },
		},
	}
))
