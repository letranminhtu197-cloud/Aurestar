const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createZipBackup,readZipBackup}=require('../src/core/zip-backup.cjs');

test('ZIP backup round-trips an Aurestar SQLite export and rejects corrupt archives',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aurestar-zip-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const file=path.join(dir,'backup.zip');
 const payload={format:'aurestar-sqlite-export',version:1,tables:{habits:[{id:'h1',name:'Read'}]}};
 const result=createZipBackup(file,payload,{'aurestar.sqlite':Buffer.from('sqlite-image'),'metadata.json':Buffer.from('{}'),'assets/itsuki/portrait.jpg':Buffer.from('asset')});
 assert.ok(result.bytes>0);assert.ok(result.files.includes('aurestar.sqlite'));assert.ok(result.files.includes('assets/itsuki/portrait.jpg'));
 assert.deepEqual(readZipBackup(file),payload);
 const corrupt=fs.readFileSync(file);corrupt[40]^=0xff;fs.writeFileSync(path.join(dir,'corrupt.zip'),corrupt);
 assert.throws(()=>readZipBackup(path.join(dir,'corrupt.zip')));
});
