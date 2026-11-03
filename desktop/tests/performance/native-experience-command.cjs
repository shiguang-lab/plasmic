// Named test actions only, against the isolated native-studio-experience fixture.
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
(async()=>{
  const directory=path.resolve(process.argv[2]),action=process.argv[3],id=randomUUID();
  const command=path.join(directory,"native-command.json");
  await fs.writeFile(command+".next",JSON.stringify({id,action}),{mode:0o600});
  await fs.rename(command+".next",command);
  const deadline=Date.now()+70000;
  while(Date.now()<deadline){
    let result;
    try{result=JSON.parse(await fs.readFile(path.join(directory,"native-result.json"),"utf8"));}catch(error){if(!["ENOENT"].includes(error.code)&&!(error instanceof SyntaxError))throw error;}
    if(result?.id===id){process.stdout.write(JSON.stringify(result)+"\n");if(result.error)process.exitCode=1;return;}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw Error("Native test action timed out: "+action);
})().catch(error=>{console.error(error);process.exitCode=1;});
