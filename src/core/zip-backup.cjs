const fs=require('node:fs');
const zlib=require('node:zlib');
const crcTable=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);t[n]=c>>>0;}return t;})();
function crc32(buf){let c=0xffffffff;for(const b of buf)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function createZipBackup(filePath,payload,extraFiles={}) {
 const entries=[['manifest.json',Buffer.from(JSON.stringify({format:'aurestar-zip-backup',version:1,schemaVersion:payload.schemaVersion||1,createdAt:new Date().toISOString(),files:['export.json',...Object.keys(extraFiles)]}))],['export.json',Buffer.from(JSON.stringify(payload))]];
 for(const [name,value] of Object.entries(extraFiles)){
  const safe=String(name).replace(/\\/g,'/');
  if(!safe||safe.startsWith('/')||safe.split('/').some(part=>part==='..'||part===''))throw new Error('Unsafe ZIP entry path.');
  entries.push([safe,Buffer.isBuffer(value)?value:Buffer.from(String(value))]);
 }
 const localParts=[],centralParts=[];let offset=0;
 for(const [nameText,source] of entries){
  const name=Buffer.from(nameText,'utf8'),compressed=zlib.deflateRawSync(source),crc=crc32(source);
  const local=Buffer.alloc(30+name.length);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0x0800,6);local.writeUInt16LE(8,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(source.length,22);local.writeUInt16LE(name.length,26);name.copy(local,30);
  localParts.push(local,compressed);
  const central=Buffer.alloc(46+name.length);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x0800,8);central.writeUInt16LE(8,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(source.length,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(offset,42);name.copy(central,46);
  centralParts.push(central);offset+=local.length+compressed.length;
 }
 const centralSize=centralParts.reduce((n,b)=>n+b.length,0),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(centralSize,12);end.writeUInt32LE(offset,16);
 fs.writeFileSync(filePath,Buffer.concat([...localParts,...centralParts,end]));
 return {filePath,bytes:fs.statSync(filePath).size,files:entries.map(x=>x[0])};
}
function readZipBackup(filePath){
 const zip=fs.readFileSync(filePath);let eocd=-1;
 for(let i=zip.length-22;i>=Math.max(0,zip.length-65557);i--)if(zip.readUInt32LE(i)===0x06054b50){eocd=i;break;}
 if(eocd<0)throw new Error('Invalid ZIP backup: end record not found.');
 const count=zip.readUInt16LE(eocd+10),offset=zip.readUInt32LE(eocd+16);let cursor=offset,manifest=null,exportJson=null,total=0;
 for(let i=0;i<count;i++){
  if(zip.readUInt32LE(cursor)!==0x02014b50)throw new Error('Invalid ZIP central directory.');
  const method=zip.readUInt16LE(cursor+10),crcExpected=zip.readUInt32LE(cursor+16),compressedSize=zip.readUInt32LE(cursor+20),uncompressedSize=zip.readUInt32LE(cursor+24),nameLen=zip.readUInt16LE(cursor+28),extraLen=zip.readUInt16LE(cursor+30),commentLen=zip.readUInt16LE(cursor+32),localOffset=zip.readUInt32LE(cursor+42);
  const name=zip.subarray(cursor+46,cursor+46+nameLen).toString('utf8');
  if(!name||name.startsWith('/')||name.split('/').some(part=>part==='..'||part===''))throw new Error('Unsafe ZIP entry path.');
  {
   total+=uncompressedSize;if(uncompressedSize>256*1024*1024||total>512*1024*1024)throw new Error('ZIP backup exceeds the supported size limit.');
   if(zip.readUInt32LE(localOffset)!==0x04034b50)throw new Error('Invalid ZIP local header.');
   const localName=zip.readUInt16LE(localOffset+26),localExtra=zip.readUInt16LE(localOffset+28),start=localOffset+30+localName+localExtra;
   const packed=zip.subarray(start,start+compressedSize),data=method===0?packed:method===8?zlib.inflateRawSync(packed,{maxOutputLength:256*1024*1024}):null;
   if(!data)throw new Error('Unsupported ZIP compression method.');
   if(data.length!==uncompressedSize||crc32(data)!==crcExpected)throw new Error('ZIP backup integrity check failed.');
   if(name==='manifest.json'){if(manifest)throw new Error('Duplicate ZIP manifest.');manifest=JSON.parse(data.toString('utf8'));}
   if(name==='export.json'){if(exportJson)throw new Error('Duplicate ZIP export.');exportJson=JSON.parse(data.toString('utf8'));}
  }
  cursor+=46+nameLen+extraLen+commentLen;
 }
 if(!manifest||manifest.format!=='aurestar-zip-backup')throw new Error('ZIP backup manifest is missing or invalid.');
 if(!exportJson||exportJson.format!=='aurestar-sqlite-export')throw new Error('ZIP backup does not contain a valid Aurestar export.');
 return exportJson;
}
module.exports={createZipBackup,readZipBackup};
