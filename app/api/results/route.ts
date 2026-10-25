import {NextRequest,NextResponse} from 'next/server';
export const dynamic='force-dynamic';
const valid=/^(br|ac|al|ap|am|ba|ce|df|es|go|ma|mt|ms|mg|pa|pb|pr|pe|pi|rj|rn|rs|ro|rr|sc|sp|se|to|zz)$/;
export async function GET(request:NextRequest){
 const uf=(request.nextUrl.searchParams.get('uf')||'br').toLowerCase();
 if(!valid.test(uf))return NextResponse.json({error:'UF inválida'},{status:400});
 const election=process.env.TSE_ELECTION_ID||'6258';
 if(!/^\d{4,6}$/.test(election))return NextResponse.json({error:'ID de eleição inválido'},{status:500});
 const code=election.padStart(6,'0');
 const url=`https://resultados.tse.jus.br/oficial/ele2026/${election}/dados/${uf}/${uf}-c0001-e${code}-u.json`;
 try{
  const response=await fetch(url,{next:{revalidate:30},signal:AbortSignal.timeout(9000)});
  if(!response.ok)throw new Error(`TSE HTTP ${response.status}`);
  const data=await response.json();
  if(!data||typeof data!=='object'||!Array.isArray(data.carg))throw new Error('Esquema inesperado da fonte oficial');
  return NextResponse.json({source:url,receivedAt:new Date().toISOString(),data},{headers:{'Cache-Control':'public, s-maxage=25, stale-while-revalidate=30'}});
 }catch(e){return NextResponse.json({error:'Dados oficiais indisponíveis ou incompatíveis; nenhum valor será estimado.',detail:String(e),source:url},{status:503});}
}
