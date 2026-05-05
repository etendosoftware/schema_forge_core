import { Presentation, PresentationFile, column, text, shape, fill, hug, fixed } from '@oai/artifact-tool';
const p=Presentation.create({slideSize:{width:1920,height:1080}});
const s=p.slides.add();
s.compose(column({width:fill,height:fill,padding:80,gap:20},[
 shape({name:'bg', width: fixed(200), height: fixed(80), fill:'#FFD500', borderRadius:'rounded-lg'}),
 text('Hola', {name:'t',width:fill,height:hug,style:{fontSize:60,bold:true,color:'#121217',fontFace:'Inter'}})
]),{frame:{left:0,top:0,width:1920,height:1080},baseUnit:8});
const blob=await PresentationFile.exportPptx(p); await blob.save('output/test-deck.pptx');
const png=await s.export({format:'png'}); await png.save('scratch/test-slide.png');
console.log('ok')
