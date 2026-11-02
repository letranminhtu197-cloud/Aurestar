const fs=require('node:fs');const path=require('node:path');const sharp=require('sharp');
const source=path.resolve(__dirname,'..','legacy-extension','Aurestar');
(async()=>{
for(const name of ['assets','icons']){const from=path.join(source,name),to=path.join(__dirname,name);if(!fs.existsSync(from)){console.warn('Legacy asset folder not found:',from);continue;}fs.rmSync(to,{recursive:true,force:true});fs.cpSync(from,to,{recursive:true});}
for(const name of ['logo-star.svg','icon.svg']){const from=path.join(source,name),to=path.join(__dirname,name);if(fs.existsSync(from))fs.copyFileSync(from,to);}
const svg=path.join(source,'icon.svg');
if(fs.existsSync(svg)){const icons=path.join(__dirname,'icons');fs.mkdirSync(icons,{recursive:true});await sharp(svg,{density:384}).resize(256,256,{fit:'contain'}).png().toFile(path.join(icons,'icon256.png'));console.log('Generated 256x256 Windows icon from the original SVG.');}
console.log('Prepared Aurestar legacy icons and media assets for desktop packaging.');
})().catch(e=>{console.error(e);process.exitCode=1;});
