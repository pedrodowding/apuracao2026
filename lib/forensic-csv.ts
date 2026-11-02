/** Streamed importer for the TSE's "votação por seção" CSV. No synthetic records. */
export type SectionVotes={
 key:string;uf:string;municipalityCode:string;municipality:string;zone:string;section:string;
 lula:number;flavio:number;others:number;blank:number;nullVotes:number
};
export type SectionImport={round:1|2;fileName:string;uf:string;sections:SectionVotes[];rowsRead:number;rowsMatched:number;importedAt:string};
function columns(line:string){
 const values:string[]=[];let current='',quoted=false;
 for(let i=0;i<line.length;i++){
  const char=line[i];
  if(char==='"'){if(quoted&&line[i+1]==='"'){current+='"';i++}else quoted=!quoted}
  else if(char===';'&&!quoted){values.push(current.trim());current=''}
  else current+=char;
 }
 values.push(current.trim());return values;
}
const normalized=(x:string)=>x.replace(/^\uFEFF/,'').replace(/^"|"$/g,'').trim().toUpperCase();
function code(value:string){return value.trim().replace(/^0+(?=\d)/,'')}
export async function importSections(file:File,round:1|2,uf:string,onProgress?:(pct:number)=>void):Promise<SectionImport>{
 if(!file.name.toLowerCase().endsWith('.csv')&&!file.name.toLowerCase().endsWith('.txt'))throw Error('Descompacte o ZIP do TSE e escolha o arquivo CSV.');
 if(file.size>350*1024*1024)throw Error('Arquivo maior que 350 MB. Utilize o CSV da UF selecionada, em vez do arquivo nacional.');
 if(file.size===0)throw Error('Arquivo vazio.');
 const reader=file.stream().getReader(),decoder=new TextDecoder('windows-1252');
 let textBuffer='',headers:Record<string,number>|null=null,read=0,rowsRead=0,rowsMatched=0;
 const sections=new Map<string,SectionVotes>();
 const idx=(names:string[])=>{for(const name of names){const n=headers?.[name];if(n!==undefined)return n}return -1};
 let indexes:Record<string,number>|null=null;
 const processLine=(line:string)=>{
  if(!line.trim())return;
  if(!headers){
   const cols=columns(line);headers=Object.fromEntries(cols.map((h,i)=>[normalized(h),i]));
   indexes={turn:idx(['NR_TURNO']),uf:idx(['SG_UF']),city:idx(['CD_MUNICIPIO']),name:idx(['NM_MUNICIPIO']),zone:idx(['NR_ZONA']),section:idx(['NR_SECAO']),office:idx(['CD_CARGO']),officeName:idx(['DS_CARGO']),candidate:idx(['NR_VOTAVEL','NR_CANDIDATO']),votes:idx(['QT_VOTOS']),election:idx(['CD_ELEICAO'])};
   for(const field of ['uf','city','zone','section','candidate','votes'])if(indexes[field]<0)throw Error('O CSV não contém a coluna obrigatória: '+field+'. Verifique se é o arquivo de votação por seção do TSE.');
   if(indexes.office<0&&indexes.officeName<0)throw Error('Arquivo sem identificação do cargo. Impossível distinguir votação presidencial.');
   if(indexes.turn<0&&indexes.election<0)throw Error('Arquivo sem identificação do turno/eleição.');
   return;
  }
  rowsRead++;
  const p=columns(line),i=indexes!;
  const val=(field:string)=>i[field]>=0?(p[i[field]]||'').trim():'';
  const lineUf=val('uf').toUpperCase();
  if(lineUf!==uf||i.turn>=0&&Number(val('turn'))!==round||i.election>=0&&['6257','6258'].includes(code(val('election')))&&Number(code(val('election')))!==(round===1?6257:6258))return;
  if(i.office>=0?Number(val('office'))!==1:!val('officeName').toLocaleLowerCase('pt-BR').includes('presidente'))return;
  const city=val('city'),zone=code(val('zone')).padStart(4,'0'),section=code(val('section')).padStart(4,'0');
  const voteCount=Number(val('votes')),candidate=code(val('candidate'));
  if(!/^\d{5}$/.test(city)||!/^\d{4}$/.test(zone)||!/^\d{4}$/.test(section)||!Number.isSafeInteger(voteCount)||voteCount<0)return;
  rowsMatched++;
  const key=[lineUf,city,zone,section].join('|');
  let item=sections.get(key);
  if(!item){item={key,uf:lineUf,municipalityCode:city,municipality:val('name')||city,zone,section,lula:0,flavio:0,others:0,blank:0,nullVotes:0};sections.set(key,item)}
  if(candidate==='13')item.lula+=voteCount;
  else if(candidate==='22')item.flavio+=voteCount;
  else if(candidate==='95')item.blank+=voteCount;
  else if(candidate==='96')item.nullVotes+=voteCount;
  else if(/^\d+$/.test(candidate)&&Number(candidate)>0&&Number(candidate)<95)item.others+=voteCount;
 };
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   read+=value.byteLength;textBuffer+=decoder.decode(value,{stream:true});
   let end=textBuffer.indexOf('\n');
   while(end!==-1){processLine(textBuffer.slice(0,end).replace(/\r$/,''));textBuffer=textBuffer.slice(end+1);end=textBuffer.indexOf('\n')}
   onProgress?.(Math.min(99,Math.round(100*read/file.size)));
  }
  textBuffer+=decoder.decode();if(textBuffer.trim())processLine(textBuffer.replace(/\r$/,''));
 }finally{reader.releaseLock()}
 if(!headers||!indexes||rowsMatched===0||sections.size===0)throw Error('Não foram encontrados votos presidenciais do '+round+'º turno para '+uf+' neste arquivo.');
 onProgress?.(100);
 return {round,fileName:file.name,uf,sections:[...sections.values()],rowsRead,rowsMatched,importedAt:new Date().toISOString()};
}
