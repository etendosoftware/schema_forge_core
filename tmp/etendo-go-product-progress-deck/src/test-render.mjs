import { Presentation, column, text, shape, fill, hug, fixed } from '@oai/artifact-tool';
import fs from 'node:fs/promises';
const p=Presentation.create({slideSize:{width:1920,height:1080}}); const s=p.slides.add();
s.compose(column({width:fill,height:fill,padding:80,gap:20},[shape({width:fixed(200),height:fixed(80),fill:'#FFD500'}),text('Hola',{width:fill,height:hug,style:{fontSize:60,bold:true,color:'#121217'}})]),{frame:{left:0,top:0,width:1920,height:1080},baseUnit:8});
const png=await s.export({format:'png'}); console.log(png.constructor.name, Object.getOwnPropertyNames(Object.getPrototypeOf(png))); console.log('type', png.type, 'size', png.size); const ab=await png.arrayBuffer(); await fs.writeFile('scratch/test-slide.png', Buffer.from(ab));
