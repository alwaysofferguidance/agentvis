// Cross-platform local launcher; uses installed workspace dependencies directly.
const { spawn, spawnSync } = require('node:child_process')
const path = require('node:path')
const root = path.resolve(__dirname,'..')
const demo=process.argv.includes('--demo')
const children=[]
let exiting=false
const stop=code=>{if(exiting)return;exiting=true;for(const child of children)child.kill();process.exitCode=code}
if(!demo){
 const build=spawnSync(process.execPath,[path.join(__dirname,'build-relay.js')],{cwd:root,stdio:'inherit'})
 if(build.status!==0)process.exit(build.status || 1)
 children.push(spawn(process.execPath,[path.join(__dirname,'.dev-relay.js')],{cwd:root,stdio:'inherit',windowsHide:true}))
}
children.push(spawn(process.execPath,[require.resolve('next/dist/bin/next',{paths:[path.join(root,'web')]}),'dev','--hostname','127.0.0.1'],{cwd:path.join(root,'web'),stdio:'inherit',windowsHide:true,env:{...process.env,NEXT_PUBLIC_DEMO:demo?'1':'0',NEXT_PUBLIC_RELAY_PORT:'3001'}}))
for(const child of children){child.on('error',error=>{console.error(error.message);stop(1)});child.on('exit',code=>stop(code || 0))}
process.on('SIGINT',()=>stop(0));process.on('SIGTERM',()=>stop(0))
