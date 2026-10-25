import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
const keys=['br','ac','al','ap','am','ba','ce','df','es','go','ma','mt','ms','mg','pa','pb','pr','pe','pi','rj','rn','rs','ro','rr','sc','sp','se','to','zz'];
export async function GET(){
 const election=process.env.TSE_ELECTION_ID||'6258';
 if(!/^[0-9]{4,6}$/.test(election))return NextResponse.json({error:'ID inválido'},{status:500});
 const code=election.padStart(6,'0');
 const results=await Promise.all(keys.map(async k=>{
  const url=`https://resultados.tse.jus.br/oficial/ele2026/${election}/dados/${k}/${k}-c0001-e${code}-u.json`;
  try{
   const r=await fetch(url,{next:{revalidate:90},signal:AbortSignal.timeout(12000)});
   if(!r.ok)return null;
   const data=await r.json();
   if(!Array.isArray(data?.carg))return null;
   return [k.toUpperCase(),{data,source:url,receivedAt:new Date().toISOString()}] as const;
  }catch{return null}
 }));
 return NextResponse.json({results:Object.fromEntries(results.filter(x=>x!==null)),receivedAt:new Date().toISOString()},{headers:{'Cache-Control':'public, s-maxage=45, stale-while-revalidate=90'}});
}
