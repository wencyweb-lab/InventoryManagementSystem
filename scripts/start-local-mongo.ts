import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { createConnection } from 'node:net'
import mongoose from 'mongoose'

const directory = path.resolve('storage/mongodb')
const port = 27017

async function listening(): Promise<boolean> {
  return new Promise(resolve => {
    const socket = createConnection({ host: '127.0.0.1', port })
    const finish = (ready: boolean) => { socket.destroy(); resolve(ready) }
    socket.setTimeout(500)
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
    socket.once('timeout', () => finish(false))
  })
}

async function main() {
  if (!await listening()) {
    const serverDirectory = path.join(directory, 'server')
    const executable = existsSync(serverDirectory)
      ? readdirSync(serverDirectory).map(name => path.join(serverDirectory, name, 'bin', 'mongod.exe')).find(existsSync)
      : undefined
    if (!executable) throw new Error('Local MongoDB binary missing from storage/mongodb/server. Install MongoDB Community Server first.')
    const dataDirectory = path.join(directory, 'data')
    mkdirSync(dataDirectory, { recursive: true })
    const child = spawn(executable, ['--dbpath', dataDirectory, '--bind_ip', '127.0.0.1', '--port', String(port),
      '--replSet', 'rs0', '--logpath', path.join(directory, 'mongod.log'), '--logappend'], {
      detached: true, windowsHide: true, stdio: 'ignore',
    })
    await new Promise<void>((resolve, reject) => {
      child.once('spawn', resolve)
      child.once('error', reject)
    })
    child.unref()
    for (let attempt = 0; !await listening(); attempt++) {
      if (attempt >= 60) throw new Error('MongoDB did not start. Inspect storage/mongodb/mongod.log.')
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  const connection = await mongoose.createConnection(`mongodb://127.0.0.1:${port}/admin?directConnection=true`, {
    serverSelectionTimeoutMS: 5000,
  }).asPromise()
  try {
    const admin = connection.db!.admin()
    try {
      await admin.command({ replSetGetStatus: 1 })
    } catch (error) {
      if ((error as { code?: number }).code !== 94) throw error
      await admin.command({ replSetInitiate: { _id: 'rs0', members: [{ _id: 0, host: `127.0.0.1:${port}` }] } })
    }
    for (let attempt = 0; attempt < 60; attempt++) {
      const hello = await admin.command({ hello: 1 })
      if (hello.isWritablePrimary) {
        console.log(`Local MongoDB is ready at 127.0.0.1:${port} (replica set ${hello.setName}).`)
        return
      }
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    throw new Error('MongoDB is running but has not elected a primary yet.')
  } finally {
    await connection.close()
  }
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
