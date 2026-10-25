import {NextRequest,NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 const uf=(request.nextUrl.searchParams.get('uf')||'').toUpperCase();
 if(!/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO|ZZ)$/.test(uf))
  return NextResponse.json({error:'UF inválida'},{status:400});
 const election=process.env.TSE_ELECTION_ID||'6258';
 if(!/^\\d{4,6}$/.test(election))return NextResponse.json({error:'Eleição inválida'},{status:500});
 const url=`https://resultados.tse.jus.br/oficial/ele2026/${election}/config/mun-e${election.padStart(6,'0')}-cm.json`;
 try{
  const response=await fetch(url,{next:{revalidate:3600},signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('TSE HTTP '+response.status);
  const data=await response.json();
  const section=Array.isArray(data?.abr)?data.abr.find((a:any)=>String(a.cd).toUpperCase()===uf):null;
  if(!section||!Array.isArray(section.mu))throw Error('Municípios não disponíveis para '+uf);
  const cities=section.mu.map((c:any)=>({code:String(c.cd||''),name:String(c.nm||''),ibge:String(c.cdi||'')}))
   .filter((c:any)=>/^\\d{5}$/.test(c.code)&&c.name).sort((a:any,b:any)=>a.name.localeCompare(b.name,'pt-BR'));
  return NextResponse.json({cities,source:url},{headers:{'Cache-Control':'public,s-maxage=3600'}});
 }catch(e){return NextResponse.json({error:'Lista oficial de municípios indisponível',detail:String(e)},{status:503})}
}
