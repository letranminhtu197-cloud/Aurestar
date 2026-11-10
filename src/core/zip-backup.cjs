const fs=require('node:fs');
const zlib=require('node:zlib');
const NAME=Buffer.from('manifest.json');
const crcTable=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);t[n]=c>>>0;}return t;})();
function crc32(buf){let c=0xffffffff;for(const b of buf)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function createZipBackup(filePath,payload){
 const source=Buffer.from(JSON.stringify(payload),'utf8'), compressed=zlib.deflateRawSync(source), crc=crc32(source);
 const local=Buffer.alloc(30+NAME.length);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0x0800,6);local.writeUInt16LE(8,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(source.length,22);local.writeUInt16LE(NAME.length,26);NAME.copy(local,30);
 const central=Buffer.alloc(46+NAME.length);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x0800,8);central.writeUInt16LE(8,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(source.length,24);central.writeUInt16LE(NAME.length,28);central.writeUInt32LE(0,42);NAME.copy(central,46);
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(local.length+compressed.length,16);
 fs.writeFileSync(filePath,Buffer.concat([local,compressed,central,end]));
 return {filePath,bytes:fs.statSync(filePath).size};
}
function readZipBackup(filePath){
 const zip=fs.readFileSync(filePath);let eocd=-1;
 for(let i=zip.length-22;i>=Math.max(0,zip.length-65557);i--)if(zip.readUInt32LE(i)===0x06054b50){eocd=i;break;}
 if(eocd<0)throw new Error('Invalid ZIP backup: end record not found.');
 const count=zip.readUInt16LE(eocd+10),offset=zip.readUInt32LE(eocd+16);let cursor=offset,manifest=null;
 for(let i=0;i<count;i++){
  if(zip.readUInt32LE(cursor)!==0x02014b50)throw new Error('Invalid ZIP central directory.');
  const method=zip.readUInt16LE(cursor+10),crcExpected=zip.readUInt32LE(cursor+16),compressedSize=zip.readUInt32LE(cursor+20),uncompressedSize=zip.readUInt32LE(cursor+24),nameLen=zip.readUInt16LE(cursor+28),extraLen=zip.readUInt16LE(cursor+30),commentLen=zip.readUInt16LE(cursor+32),localOffset=zip.readUInt32LE(cursor+42);
  const name=zip.subarray(cursor+46,cursor+46+nameLen).toString('utf8');
  if(name==='manifest.json'){
   if(zip.readUInt32LE(localOffset)!==0x04034b50)throw new Error('Invalid ZIP local header.');
   const localName=zip.readUInt16LE(localOffset+26),localExtra=zip.readUInt16LE(localOffset+28),start=localOffset+30+localName+localExtra;
   if(uncompressedSize>256*1024*1024||compressedSize>256*1024*1024)throw new Error('ZIP backup exceeds the supported size limit.');
   const packed=zip.subarray(start,start+compressedSize);
   manifest=method===0?packed:method===8?zlib.inflateRawSync(packed,{maxOutputLength:256*1024*1024}):null;
   if(!manifest)throw new Error('Unsupported ZIP compression method.');
   if(manifest.length!==uncompressedSize||crc32(manifest)!==crcExpected)throw new Error('ZIP backup integrity check failed.');
  }
  cursor+=46+nameLen+extraLen+commentLen;
 }
 if(!manifest)throw new Error('ZIP backup does not contain manifest.json.');
 const payload=JSON.parse(manifest.toString('utf8'));
 if(payload?.format!=='aurestar-sqlite-export')throw new Error('ZIP does not contain a valid Aurestar backup.');
 return payload;
}
module.exports={createZipBackup,readZipBackup};
