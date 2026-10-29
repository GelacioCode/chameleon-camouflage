export function createOfficeMap(THREE,mapData,{layout='plan',assets=null}={}){
const T=THREE,scene=new T.Group(),layoutMode=layout,planMode=layout==='plan';
const scale=mapData.source.metersPerPixel;
const px=n=>(n-mapData.source.originPx[0])*scale;
const pz=n=>(n-mapData.source.originPx[1])*scale;
const mat=(color,roughness=.8,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
const white=mat('#e9e8e1'),gray=mat('#7e8d90'),edge=mat('#b9c2bf'),black=mat('#202627'),seat=mat('#272e2e'),silver=mat('#aab0ad',.4,.55),red=mat('#d53337'),wall=mat('#f2f0e6');
function texture(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;}
let seed=44;function rnd(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
const carpet=texture(256,256,(c,w,h)=>{c.fillStyle='#777a77';c.fillRect(0,0,w,h);for(let i=0;i<23000;i++){let v=100+rnd()*49;c.fillStyle=`rgba(${v},${v+2},${v+1},.5)`;c.fillRect(rnd()*w,rnd()*h,1,1+rnd()*6);}c.fillStyle='#666b6720';c.fillRect(0,0,128,256);});carpet.wrapS=carpet.wrapT=T.RepeatWrapping;carpet.repeat.set(18,16);
const wood=texture(256,256,(c,w,h)=>{c.fillStyle='#c6ac87';c.fillRect(0,0,w,h);for(let i=0;i<1300;i++){c.strokeStyle=`rgba(${100+rnd()*65},${78+rnd()*45},45,${rnd()*.12})`;c.beginPath();let y=rnd()*h;c.moveTo(0,y);c.bezierCurveTo(65,y+rnd()*6,180,y-rnd()*6,256,y+2);c.stroke();}});const woodMat=new T.MeshStandardMaterial({map:wood,roughness:.65});
const ceilingTex=texture(256,256,(c,w,h)=>{c.fillStyle='#dfdfd7';c.fillRect(0,0,w,h);for(let i=0;i<3500;i++){c.fillStyle='#858a7e22';c.fillRect(rnd()*w,rnd()*h,1,1);}c.fillStyle='#aaaDA4';c.fillRect(0,0,2,256);c.fillRect(0,0,256,2);});ceilingTex.wrapS=ceilingTex.wrapT=T.RepeatWrapping;ceilingTex.repeat.set(22,20);
const obstacles=[],colliders=[],columns=[],chairFootprints=[],monitors=[],props=[];function box(x,y,z,w,h,d,m,solid=false,parent=scene){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);parent.add(o);if(solid){obstacles.push({x,z,w:w+.48,d:d+.48});colliders.push({kind:'box',center:[x,y,z],size:[w,h,d]});}return o;}
function cylinder(x,y,z,r,h,m,parent=scene){const o=new T.Mesh(new T.CylinderGeometry(r,r,h,12),m);o.position.set(x,y,z);parent.add(o);return o;}
function label(text,w,h,color='#bd3037',bg='#ecece5'){const t=texture(1024,256,(c,W,H)=>{c.fillStyle=bg;c.fillRect(0,0,W,H);c.fillStyle=color;c.font='bold 116px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText(text,W/2,H/2);});return new T.MeshBasicMaterial({map:t});}

function addColumn(x,z,w,d,m=red){columns.push({x,z,w,d});box(x,1.6,z,w,3.2,d,m,true);}
if(!planMode){
box(0,-.1,0,26,.2,24,new T.MeshStandardMaterial({map:carpet}));box(0,3.25,0,26,.15,24,new T.MeshStandardMaterial({map:ceilingTex}));box(0,1.6,-12,26,3.2,.15,wall);box(13,1.6,0,.15,3.2,24,wall);box(0,1.6,12,26,3.2,.15,wall);
for(const z of [-11.9,11.9])box(0,.08,z,26,.16,.06,gray);box(12.9,.08,0,.06,.16,24,gray);
const sky=mat('#cfdfdf');const blind=mat('#edddb3');
for(let z=-10.5;z<12;z+=3){box(-13,1.6,z,.15,3.2,3,white);box(-12.9,1.8,z,.07,2.6,2.65,sky);box(-12.8,2.57,z,.09,1.05,2.66,blind);box(-12.73,2.04,z,.06,.05,2.7,white);box(-12.73,.59,z,.08,.08,2.7,white);box(-12.73,1.25,z,.07,.05,2.7,white);box(-12.72,1.4,z,.06,1.7,.055,white);for(let b=-1;b<=1;b++){box(-14.5,1.1,z+b*.6,.8,1.6,.4,mat(b===0?'#acbab8':'#d0cebc'));}}
for(const x of [-11.9,8.3])for(const z of [-8.9,6.6])addColumn(x,z,.85,.85);
for(const x of [-5.1,9.6])for(const z of [-4,8])addColumn(x,z,.13,.13,white);
for(const z of [-8,0,8])box(0,3.04,z,26,.3,.7,white);
const lamp=new T.MeshStandardMaterial({color:0xfffce9,emissive:0xfff4cf,emissiveIntensity:2});
for(let x=-10;x<13;x+=4)for(let z=-10;z<12;z+=4){box(x,3.16,z,.66,.035,.66,lamp);if((x+z)%8===0){box(x+1.3,3.15,z+1.2,.6,.03,.6,gray);for(let k=0;k<5;k++)box(x+1.3,3.13,z+1+k*.08,.5,.02,.018,white);}}
box(1,1.95,-11.89,5.3,1.1,.02,label('OFFICE CAMO'));box(-4.2,1.8,-11.88,2.4,1.55,.02,label('WORK TOGETHER',2,1,'#536568'));box(6.5,1.8,-11.88,2.4,1.55,.02,label('CREATE IMPACT',2,1,'#536568'));
const glass=new T.MeshStandardMaterial({color:'#b1cdca',transparent:true,opacity:.3,roughness:.2});box(9.7,1.4,-11.8,2.1,2.8,.035,glass);for(let k=0;k<6;k++)box(9.7,1.1+k*.12,-11.75,2,.04,.015,white);box(10.4,1.3,-11.7,.035,.55,.06,silver);box(9.7,2.95,-11.7,1,.25,.05,label('EXIT',1,1,'#256e47','#cdebd5'));
box(12.86,1.3,8,.05,2.6,1.4,woodMat);box(12.81,1.2,7.55,.06,.04,.16,silver);

}
function chair(x,z,rot){
 const clear=(a,b)=>!columns.some(c=>Math.abs(a-c.x)<c.w/2+.49&&Math.abs(b-c.z)<c.d/2+.49)&&!chairFootprints.some(c=>Math.hypot(a-c.x,b-c.z)<.78);
 let fit=null;for(const delta of [0,.2,-.2,.4,-.4]){const a=x+Math.cos(rot)*delta,b=z-Math.sin(rot)*delta;if(clear(a,b)){fit={x:a,z:b};break;}}
 if(!fit)return; x=fit.x;z=fit.z;chairFootprints.push({x,z,radius:.30});
 const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rot;scene.add(g);cylinder(0,.32,0,.035,.48,silver,g);box(0,.48,0,.53,.1,.5,seat,false,g);const back=box(0,.86,.24,.51,.66,.065,seat,false,g);back.rotation.x=-.07;box(0,1.22,.27,.32,.13,.09,black,false,g);for(let s of [-1,1]){box(s*.32,.62,.02,.055,.25,.05,black,false,g);box(s*.32,.75,-.01,.07,.045,.29,black,false,g);}for(let i=0;i<5;i++){let a=i*Math.PI*2/5;const leg=box(Math.sin(a)*.18,.13,Math.cos(a)*.18,.045,.055,.4,black,false,g);leg.rotation.y=a;cylinder(Math.sin(a)*.35,.07,Math.cos(a)*.35,.045,.07,black,g);}for(let i=0;i<9;i++)box(0,.61+i*.055,.281,.46,.008,.006,gray,false,g);}
function monitor(x,z,rot){const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rot;scene.add(g);box(0,.8,0,.32,.025,.22,silver,false,g);box(0,.98,.02,.045,.33,.045,silver,false,g);box(0,1.21,0,.69,.43,.055,black,false,g);const screen=box(0,1.21,-.031,.645,.385,.005,mat('#10181b'),false,g);monitors.push({group:g,screen,x,z,rotation:rot,on:false});box(0,.802,-.33,.39,.018,.14,black,false,g);box(.3,.8,-.32,.06,.026,.095,black,false,g);}
const desks=[],mapWalls=[];
function planBox(cx,cz,w,d,m=woodMat,height=.75){return box(px(cx),height,pz(cz),w*scale,.065,d*scale,m,true);}
function segmentWall(w){const [ax,az]=w.a,[bx,bz]=w.b;const width=Math.max(Math.abs(bx-ax)*scale,.13),depth=Math.max(Math.abs(bz-az)*scale,.13);const isGlass=planMode&&w.id.startsWith('meeting-');
 if(isGlass){
 const gm=new T.MeshStandardMaterial({color:'#b9d7d8',transparent:true,opacity:.16,roughness:.13,metalness:.05,depthWrite:false});
 box(px((ax+bx)/2),w.height/2,pz((az+bz)/2),width>depth?width:width*.35,w.height,width>depth?depth*.35:depth,gm,true);
 for(const y of [.04,w.height-.04])box(px((ax+bx)/2),y,pz((az+bz)/2),width,.055,depth,silver);
 if(width>depth){for(let x=px(Math.min(ax,bx));x<=px(Math.max(ax,bx));x+=1.15)box(x,w.height/2,pz((az+bz)/2),.035,w.height,.055,silver);for(let i=0;i<3;i++)box(px((ax+bx)/2),1.05+i*.12,pz((az+bz)/2),width,.035,.045,white);}
 else{for(let z=pz(Math.min(az,bz));z<=pz(Math.max(az,bz));z+=1.15)box(px((ax+bx)/2),w.height/2,z,.055,w.height,.035,silver);for(let i=0;i<3;i++)box(px((ax+bx)/2),1.05+i*.12,pz((az+bz)/2),.045,.035,depth,white);}
 }else box(px((ax+bx)/2),w.height/2,pz((az+bz)/2),width,w.height,depth,wall,true);mapWalls.push({x:px((ax+bx)/2),z:pz((az+bz)/2),w:width,d:depth});}
if(!planMode){
for(const cx of [-8.5,-1.8,4.9])for(const cz of [-7,-1.6,3.8]){box(cx,.75,cz,4.8,.065,1.55,woodMat,true);desks.push({x:cx,z:cz});for(let sx of [-2.22,2.22])for(let sz of [-.62,.62])box(cx+sx,.36,cz+sz,.055,.72,.055,silver);box(cx,1.12,cz,4.8,.68,.045,gray);for(let x of [-2.4,-.8,.8,2.4]){box(cx+x,1.12,cz,.045,.68,1.55,gray);for(let sz of [-.68,.68])box(cx+x,.83,cz+sz,.075,.09,.07,white);}for(const dx of [-1.6,0,1.6])for(const s of [-1,1]){monitor(cx+dx,cz+s*.32,s===1?0:Math.PI);chair(cx+dx+(rnd()-.5)*.18,cz+s*1.23,s===1?0:Math.PI);}}
}else{
 const [l,t,r,b]=mapData.boundsPx;
 box(px((l+r)/2),-.1,pz((t+b)/2),(r-l)*scale,.2,(b-t)*scale,new T.MeshStandardMaterial({map:carpet}));
 box(px((l+r)/2),3.27,pz((t+b)/2),(r-l)*scale,.1,(b-t)*scale,new T.MeshStandardMaterial({map:ceilingTex}));
 mapData.walls.forEach(segmentWall);
 for(const zone of mapData.zones){const [x1,z1,x2,z2]=zone.rect; if(zone.blocked){box(px((x1+x2)/2),1.45,pz((z1+z2)/2),(x2-x1)*scale,2.9,(z2-z1)*scale,white,true);} }
 for(const c of mapData.columns)addColumn(px(c.cx),pz(c.cz),c.width*scale,c.depth*scale);
 const sky=mat('#d4e0db'),blind=mat('#e8dab4');
 for(let x=865;x<1490;x+=100){box(px(x),1.85,pz(999),2.2,2.35,.06,sky);box(px(x),2.55,pz(998),2.2,.9,.065,blind);for(const dx of [-1.12,0,1.12])box(px(x)+dx,1.85,pz(996),.04,2.4,.04,white);box(px(x),1.6,pz(996),2.25,.04,.04,white);}
 const lamp=new T.MeshStandardMaterial({color:'#fffbe8',emissive:'#fff4cc',emissiveIntensity:1.5});
 for(let x=580;x<1800;x+=130)for(let z=95;z<1000;z+=135)box(px(x),3.19,pz(z),.65,.025,.65,lamp);
 for(const bank of mapData.banks){const x=px(bank.cx),z=pz(bank.cz),w=bank.width*scale,d=bank.depth*scale;
 desks.push({x,z,w,d});
 // Columns occupy reserved gaps in the first workstation rows.
 const collidesPost=(a,b,ww,dd)=>columns.some(c=>Math.abs(a-c.x)<(ww+c.w)/2+.04&&Math.abs(b-c.z)<(dd+c.d)/2+.04);
 if(bank.orientation==='vertical'){
 const step=d/bank.count;
 box(x,1.12,z,.045,.68,d,gray);
 for(let i=0;i<bank.count;i++){const zz=z-d/2+step*(i+.5);
 for(const side of [-1,1]){const xx=x+side*w/4;if(collidesPost(xx,zz,w/2,step-.035))continue;
 box(xx,.75,zz,w/2-.025,.065,step-.035,woodMat,true);
 for(const dx of [-w/4+.07,w/4-.07])for(const dz of [-step/2+.08,step/2-.08])box(xx+dx,.36,zz+dz,.045,.72,.045,silver);
 monitor(x+side*.37,zz,side===-1?Math.PI/2:-Math.PI/2);
 chair(x+side*(w/2+.08),zz,side===-1?-Math.PI/2:Math.PI/2);
 }
 if(i>0)box(x,1.12,z-d/2+step*i,w,.68,.04,gray);
 }
 }else{const step=w/bank.count;for(let i=0;i<bank.count;i++){const xx=x-w/2+step*(i+.5);box(xx,.75,z,step-.025,.065,d,woodMat,true);for(const sx of [-.4,.4])box(xx+sx,.36,z,.045,.72,.045,silver);monitor(xx,z+.12,Math.PI);chair(xx,z-.92,Math.PI);if(i>0)box(x-w/2+step*i,1.08,z,.04,.6,d,gray);}}
 }
 // Reception and meeting room remain accessible through the traced door gaps.
 box(px(397),.75,pz(710),2.5,.08,.9,woodMat,true);chair(px(397),pz(680),Math.PI);
 box(px(704),.75,pz(905),3.8,.08,1.5,woodMat,true);for(const xx of [660,710,760]){chair(px(xx),pz(855),Math.PI);chair(px(xx),pz(954),0);}
 box(px(1060),1.9,pz(35),6,1.1,.04,label('OFFICE CAMO'));
}

const decorRandom=(()=>{let n=mapData.decorationSeed??20261029;return()=>{n=(n*16807)%2147483647;return(n-1)/2147483646;};})();
const artAssets=assets?.art||[],memeAssets=assets?.memes||[];
if(assets&&mapData.expectedArtworkCount&&artAssets.length!==mapData.expectedArtworkCount)throw new Error('Artwork manifest is incomplete');
if(assets&&mapData.expectedWallpaperCount&&memeAssets.length!==mapData.expectedWallpaperCount)throw new Error('Wallpaper manifest is incomplete');
function imageTexture(image,width=768,height=432){return texture(width,height,(c,w,h)=>{c.fillStyle='#101418';c.fillRect(0,0,w,h);const ratio=Math.min(w/image.width,h/image.height);const iw=image.width*ratio,ih=image.height*ratio;c.drawImage(image,(w-iw)/2,(h-ih)/2,iw,ih);});}
const papers=memeAssets.map(a=>{const t=imageTexture(a.texture.image);return new T.MeshStandardMaterial({map:t,emissive:'#ffffff',emissiveMap:t,emissiveIntensity:.42,roughness:.9});});
// Geometry-only imports may omit textures; the viewer awaits loadOfficeAssets.
if(!papers.length)papers.push(mat('#1a3039'));
const order=monitors.map((_,i)=>i);for(let i=order.length-1;i>0;i--){const j=Math.floor(decorRandom()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
const onCount=Math.round(monitors.length*(mapData.monitorOnRatio??.6));
const powered=order.slice(0,onCount).map(i=>monitors[i]);
const separation=mapData.wallpaperSeparationMeters??4;
const used=Array(papers.length).fill(0),assigned=[];
const adjacent=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z)<separation;
const family=i=>memeAssets[i]?.family||memeAssets[i]?.id||String(i);
// Color the proximity graph; distant screens may reuse images.
const degree=new Map(powered.map(m=>[m,powered.filter(n=>n!==m&&adjacent(m,n)).length]));
powered.sort((a,b)=>degree.get(b)-degree.get(a));
for(const monitor of powered){
 const nearby=assigned.filter(m=>adjacent(m,monitor));
 const candidates=Array.from({length:papers.length},(_,i)=>i).filter(i=>!memeAssets.length||!nearby.some(m=>family(m.wallpaper)===family(i)));
 if(!candidates.length)throw new Error('Wallpaper pool is too small for the configured screen separation');
 const score=candidates.map(i=>({i,score:used[i]+decorRandom()*.35})).sort((a,b)=>a.score-b.score);
 const chosen=score[0].i;used[chosen]++;monitor.on=true;monitor.wallpaper=chosen;monitor.screen.material=papers[chosen];monitor.screen.userData={kind:'monitor-screen',powered:true,wallpaper:chosen,assetId:memeAssets[chosen]?.id||null,family:family(chosen)};assigned.push(monitor);
}
for(let i=0;i<monitors.length;i++){const m=monitors[i],g=m.group;const r=decorRandom();
 if(r<.5){const mugmat=mat(['#dfd6be','#45817d','#a94e47','#c2b66b'][i%4]);cylinder(-.38,.85,-.2,.045,.12,mugmat,g);props.push({id:`mug-${i}`,type:'mug',anchorMonitor:i,collision:false});}
 if(r>.3&&r<.78){const notebook=box(.43,.79,-.22,.16,.025,.22,mat(i%2?'#718e7e':'#a35648'),false,g);notebook.rotation.y=.15;box(.43,.805,-.22,.135,.003,.2,white,false,g);props.push({id:`notebook-${i}`,type:'notebook',anchorMonitor:i,collision:false});}
 if(i%13===0){cylinder(-.38,.83,.22,.065,.1,mat('#d7d2bf'),g);for(let k=0;k<5;k++){const leaf=box(-.38+(k-2)*.02,.95,.22,.025,.2,.035,mat('#4e7658'),false,g);leaf.rotation.z=(k-2)*.2;}props.push({id:`desk-plant-${i}`,type:'small-plant',anchorMonitor:i,collision:false});}
}
function painting(x,z,rotation,index,wallId){const asset=artAssets[index%Math.max(1,artAssets.length)];const aspect=asset?asset.width/asset.height:1.45;const height=aspect<1?1.48:1.02,width=height*aspect;
 const g=new T.Group();g.position.set(x,1.9,z);g.rotation.y=rotation;scene.add(g);
 box(0,0,0,width+.14,height+.14,.07,mat('#755534'),false,g);
 box(0,0,-.04,width+.055,height+.055,.015,mat('#d1b56f'),false,g);
 const image=box(0,0,-.052,width,height,.008,new T.MeshStandardMaterial({map:asset?.texture||null,color:asset?'#ffffff':'#d9cfb6',roughness:.92}),false,g);
 image.userData={kind:'painting',assetId:asset?.id||null};props.push({id:`painting-${index}`,type:'painting',position:[x,1.9,z],rotation,wallId,width:width+.14,height:height+.14,assetId:asset?.id||null,collision:false});}
if(planMode){
 mapData.paintings.forEach((p,i)=>painting(px(p.x),pz(p.z),p.rotation,i,p.wall));
 // The leaf swings into the room and leaves the north doorway clear.
 const doorX=px(573),doorZ=pz(795),doorWidth=(615-573)*scale-.08;
 const pivot=new T.Group();pivot.name='meeting-door-open';pivot.position.set(doorX,0,doorZ);pivot.rotation.y=-Math.PI/2;scene.add(pivot);
 const gm=new T.MeshStandardMaterial({color:'#bedddd',transparent:true,opacity:.2,roughness:.12,depthWrite:false});
 box(doorWidth/2,1.4,0,doorWidth,2.8,.035,gm,false,pivot);
 for(const y of [.04,2.77])box(doorWidth/2,y,0,doorWidth,.045,.05,silver,false,pivot);
 for(const x of [.02,doorWidth-.02])box(x,1.4,0,.04,2.8,.05,silver,false,pivot);
 box(doorWidth-.12,1.2,-.045,.035,.32,.03,silver,false,pivot);
 box(doorX,1.4,doorZ+doorWidth/2,.06,2.8,doorWidth,gm,true).visible=false;
 props.push({id:'meeting-door',type:'glass-door',position:[doorX,0,doorZ],open:true,angle:-Math.PI/2,collision:true});
 const candidatePlants=[[572,970],[806,970],[570,70],[1470,70]];
 for(let i=0;i<candidatePlants.length;i++){const [x,z]=candidatePlants[i],wx=px(x),wz=pz(z);if(obstacles.some(c=>Math.abs(wx-c.x)<c.w/2+.24&&Math.abs(wz-c.z)<c.d/2+.24)||chairFootprints.some(c=>Math.hypot(wx-c.x,wz-c.z)<c.radius+.3))continue;
 cylinder(wx,.23,wz,.22,.46,mat('#bca992'));box(wx,.23,wz,.44,.46,.44,mat('#bca992'),true).visible=false;
 for(let k=0;k<7;k++){const leaf=box(wx+Math.sin(k*2.4)*.12,.7+k*.035,wz+Math.cos(k*2.4)*.12,.13,.55,.075,mat(k%2?'#537b5d':'#37604b'));leaf.rotation.z=Math.sin(k)*.3;}
 props.push({id:`floor-plant-${i}`,type:'floor-plant',position:[wx,0,wz],collision:true});}
 const cabinet=box(px(800),.5,pz(832),.55,1,.9,white,true);for(const y of [.3,.65])box(px(800)-.29,y,pz(832),.025,.035,.4,silver);props.push({id:'meeting-cabinet',type:'cabinet',position:[px(800),.5,pz(832)],collision:true});
 const tableItems=[[665,890],[709,911],[745,890]];for(let i=0;i<tableItems.length;i++){const [x,z]=tableItems[i];box(px(x),.81,pz(z),.3,.045,.23,mat(['#9b5d4f','#587f80','#b3ab88'][i]));props.push({id:`meeting-book-${i}`,type:'book',position:[px(x),.81,pz(z)],collision:false});}
}else{painting(-9,-11.78,Math.PI,0,'north');painting(10.5,-11.78,Math.PI,1,'north');painting(12.78,-5,Math.PI/2,2,'east');painting(12.78,4,Math.PI/2,3,'east');painting(-7,11.78,0,4,'south');painting(6,11.78,0,5,'south');}
for(const c of chairFootprints)colliders.push({kind:'cylinder',center:[c.x,.65,c.z],radius:c.radius,height:1.3});
const spawn=planMode?[px(mapData.routePx[0][0]),1.65,pz(mapData.routePx[0][1])]:[10.6,1.65,9.2];
scene.name='OfficeMap';scene.userData={mapId:mapData.id,units:'meters',layout:layoutMode,seed:mapData.decorationSeed??20261029};
return {group:scene,colliders,obstacles,columns,chairFootprints,desks,mapWalls,monitors,props,spawn,stats:{monitors:monitors.length,on:onCount,off:monitors.length-onCount,props:props.length},dispose(){const geometries=new Set(),materials=new Set(),textures=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};

}

export async function loadOfficeAssets(THREE,{baseUrl=new URL('./',import.meta.url)}={}){
 const entries=await fetch(new URL('asset-sources.json',baseUrl)).then(r=>{if(!r.ok)throw new Error('Asset manifest could not load');return r.json();});
 const loader=new THREE.TextureLoader();
 const loaded=await Promise.all(entries.map(async asset=>{const texture=await loader.loadAsync(new URL(asset.path,baseUrl).href);texture.colorSpace=THREE.SRGBColorSpace;return{...asset,texture};}));
 return{art:loaded.filter(a=>a.kind==='art'),memes:loaded.filter(a=>a.kind==='memes')};
}
