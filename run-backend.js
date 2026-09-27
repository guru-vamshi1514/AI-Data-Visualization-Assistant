import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isWin = process.platform === 'win32'
const venvPythonWin = path.join(__dirname, 'backend', '.venv', 'Scripts', 'python.exe')
const venvPythonPosix = path.join(__dirname, 'backend', '.venv', 'bin', 'python')

let pythonPath = 'python'
if (fs.existsSync(venvPythonWin)) {
  pythonPath = venvPythonWin
} else if (fs.existsSync(venvPythonPosix)) {
  pythonPath = venvPythonPosix
}

console.log(`Starting FastAPI backend using: ${pythonPath}`)

const child = spawn(pythonPath, ['-m', 'uvicorn', 'main:app', '--reload', '--port', '8000'], {
  cwd: path.join(__dirname, 'backend'),
  stdio: 'inherit',
})

child.on('exit', (code) => {
  process.exit(code || 0)
})
