import { Task } from 'task'
import build from './build'

export default Task('watch', task => task.watch(['src/**/*.ts'], build))
