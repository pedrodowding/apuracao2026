import {NextRequest,NextResponse} from 'next/server';
import {parseElection} from '../../../../lib/election';

export const dynamic='force-dynamic';
const states=new Set(['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO','ZZ']);
type ZoneResult={zone:string;first:number;second:number;valid:number;turnout:number|null;eligible:number|null;sectionsCounted:number|null;sectionsTotal:number|null;source:string};
const number=(v:unknown)=>String(v??'').replace(/\D/g,'');

export async function GET(req:NextRequest){
 const uf=(req.nextUrl.searchParams.get('uf')||'').toUpperCase();
 const city=req.nextUrl.searchParams.get('city')||'';
 const round=req.nextUrl.searchParams.get('round')==='1'?1:2;
 if(!states.has(uf)||!/^\d{5}$/.test(city))return NextResponse.json({error:'Selecione uma UF e um município válido.'},{status:400});
 const election=round===1?'6257':process.env.TSE_ELECTION_ID||'6258';
 if(!/^\d{4,6}$/.test(election))return NextResponse.json({error:'Identificador da eleição inválido.'},{status:500});
 const code=election.padStart(6,'0'),base=`https://resultados.tse.jus.br/oficial/ele2026/${election}`;
 const configUrl=`${base}/config/mun-e${code}-cm.json`;
 try{
  const cfgResponse=await fetch(configUrl,{next:{revalidate:86400},signal:AbortSignal.timeout(12000)});
  if(!cfgResponse.ok)throw Error('Cadastro TSE HTTP '+cfgResponse.status);
  const cfg=await cfgResponse.json();
  const state=Array.isArray(cfg?.abr)?cfg.abr.find((x:{cd:unknown})=>String(x.cd).toUpperCase()===uf):null;
  const municipality=state?.mu?.find((m:{cd:unknown})=>number(m.cd).padStart(5,'0')===city);
  if(!municipality)return NextResponse.json({error:'Município não encontrado no cadastro oficial.'},{status:404});
  const rawZones=Array.isArray(municipality.zon)?municipality.zon:Array.isArray(municipality.zo)?municipality.zo:[];
  const zones=[...new Set<string>(rawZones.map((z:{cd:unknown})=>number(z.cd).padStart(4,'0')).filter((z:string)=>/^\d{4}$/.test(z)))].sort();
  if(zones.length===0)return NextResponse.json({error:'O cadastro oficial não informou zonas para este município. Não é possível calcular a comparação.'},{status:503});
  const LIMIT=140,selected=zones.slice(0,LIMIT);
  const results:ZoneResult[]=[],missing:string[]=[];
  // Bounded batches to avoid saturating the TSE and to make coverage auditable.
  for(let i=0;i<selected.length;i+=8){
   const batch=await Promise.all(selected.slice(i,i+8).map(async zone=>{
    const source=`${base}/dados/${uf.toLowerCase()}/${uf.toLowerCase()}${city}-z${zone}-c0001-e${code}-u.json`;
    try{
     const response=await fetch(source,{next:{revalidate:600},signal:AbortSignal.timeout(7000)});
     if(!response.ok)return {zone,record:null};
     const raw=await response.json();
     const parsed=parseElection({data:raw,source},uf);
     if(!parsed)return {zone,record:null};
     const first=parsed.candidates.find(c=>c.number==='13')?.votes||0;
     const second=parsed.candidates.find(c=>c.number==='22')?.votes||0;
     if(parsed.validVotes===null||parsed.validVotes<first+second)return {zone,record:null};
     const record:ZoneResult={zone,first,second,valid:parsed.validVotes,turnout:parsed.turnout,eligible:parsed.eligible,sectionsCounted:parsed.sectionsCounted,sectionsTotal:parsed.sectionsTotal,source};
     return {zone,record};
    }catch{return {zone,record:null}}
   }));
   for(const {zone,record} of batch){if(record)results.push(record);else missing.push(zone)}
  }
  return NextResponse.json({uf,city,cityName:String(municipality.nm||city),round,zones:results,requested:selected.length,totalZones:zones.length,missing,truncated:zones.length>LIMIT,source:configUrl,receivedAt:new Date().toISOString()},{headers:{'Cache-Control':'public,s-maxage=300,stale-while-revalidate=900'}});
 }catch(e){return NextResponse.json({error:'Não foi possível consultar as zonas no TSE.',detail:String(e),source:configUrl},{status:503})}
}
