'use client';
import {useMemo,useState} from 'react';
import type {Election} from '../lib/election';

type Snapshot={t:string,a:number,b:number,ts?:number};
const keys=['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO','ZZ'];
const fmt=(n:number)=>Math.round(n).toLocaleString('pt-BR');
const pct=(n:number)=>n.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const color=(n:string,name:string)=>n==='13'||name.toLowerCase().includes('lula')?'#e53d4d':n==='22'||name.toLowerCase().includes('bolsonaro')?'#398dff':'#92a4b9';
export default function ProjectionCurves({nation,places,history,uf,citySelected}:{nation:Election|null;places:Record<string,Election>;history:Snapshot[];uf:string;citySelected:boolean}){
 const [swing,setSwing]=useState(10);
 const model=useMemo(()=>{
  if(!nation||nation.candidates.length!==2)return null;
  const [a,b]=nation.candidates;
  const counted=a.votes+b.votes;
  const pending=nation.pendingElectors;
  if(pending===null||!Number.isFinite(pending)||pending<0)return {kind:'unavailable' as const,reason:'Sem limite oficial verificável de eleitores pendentes.'};
  const validStates=keys.map(k=>places[k]);
  if(validStates.some(e=>!e||e.pendingElectors===null||e.eligible===null))return {kind:'unavailable' as const,reason:'A projeção territorial exige as 27 UFs e o exterior com eleitores pendentes consistentes.'};
  let totalPending=0,forecastA=0,forecastB=0,lowA=0,highA=0,remainingValid=0;
  for(const e of validStates){
   const v0=e.candidates.find(c=>c.number===a.number)?.votes||0;
   const v1=e.candidates.find(c=>c.number===b.number)?.votes||0;
   const valid=v0+v1,pend=e.pendingElectors!;
   const countedElectors=e.eligible!-pend;
   if(pend>0&&(countedElectors<=0||valid<=0))return {kind:'unavailable' as const,reason:'Uma ou mais localidades não têm base observada para estimar votos futuros.'};
   const validTurnout=countedElectors>0?Math.min(1,valid/countedElectors):0;
   const future=pend*validTurnout;
   const share=valid>0?v0/valid:.5;
   const lo=Math.max(0,share-swing/100),hi=Math.min(1,share+swing/100);
   forecastA+=future*share;forecastB+=future*(1-share);
   lowA+=future*lo;highA+=future*hi;
   remainingValid+=future;totalPending+=pend;
  }
  if(Math.abs(totalPending-pending)>Math.max(100,0.01*Math.max(pending,1)))return {kind:'unavailable' as const,reason:'Os eleitores pendentes nacionais não conciliam com a soma das localidades. Aguardando atualização sincronizada.'};
  if(!counted)return {kind:'unavailable' as const,reason:'Ainda não há votos suficientes para projetar.'};
  const finalA=a.votes+forecastA,finalB=b.votes+forecastB;
  const locked=a.votes>b.votes+pending?'a':b.votes>a.votes+pending?'b':pending===0?(a.votes>b.votes?'a':b.votes>a.votes?'b':'tie'):null;
  return {kind:'ready' as const,a,b,counted,pending,remainingValid,finalA,finalB,lowA:a.votes+lowA,highA:a.votes+highA,lowB:b.votes+remainingValid-highA,highB:b.votes+remainingValid-lowA,locked};
 },[nation,places,swing]);
 const actual=useMemo(()=>{
  if(!nation||nation.candidates.length!==2)return [];
  const [a,b]=nation.candidates;
  // Historical snapshots predate identity-tagging: only use snapshots with the same leader ordering.
  const snapshots=history.filter(x=>Number.isFinite(x.a)&&Number.isFinite(x.b)&&x.a>=0&&x.b>=0);
  const ordered=snapshots.filter((x,i)=>i===0||x.a!==snapshots[i-1].a||x.b!==snapshots[i-1].b).slice(-120);
  return ordered.map((x,i)=>({a:x.a,b:x.b,t:x.t,i}));
 },[history,nation]);
 const ready=model?.kind==='ready'?model:null;
 const maxV=Math.max(1,...actual.flatMap(p=>[p.a,p.b]),ready?.highA||0,ready?.highB||0);
 const count=actual.length;
 const X=(i:number)=>35+(count<=1?0:i*430/(count-1));
 const Y=(n:number)=>240-205*n/maxV;
 const line=(k:'a'|'b')=>actual.map((p,i)=>(i?'L':'M')+X(i).toFixed(1)+','+Y(p[k]).toFixed(1)).join(' ');
 const base=actual[count-1];
 const startX=count?X(count-1):35;
 const projectionVisible=uf==='BR'&&!citySelected&&ready!==null;
 const xa=projectionVisible?startX:465;
 const endX=projectionVisible?690:465;
 const a=nation?.candidates[0],b=nation?.candidates[1];
 return <section className="panel curves-panel"><div className="sectionhead"><div><div className="eyebrow">CURVAS DE APURAÇÃO</div><h2>Votos registrados e projeção final</h2></div></div>
 <div className="curves-legend">{a&&<span style={{color:color(a.number,a.name)}}>● {a.name}</span>}{b&&<span style={{color:color(b.number,b.name)}}>● {b.name}</span>}<span>— observado</span><span>┄ cenário projetado</span></div>
 <div className="curves-chart"><svg viewBox="0 0 730 275" role="img" aria-label="Linhas de votos observados e extensão condicional para o total final" preserveAspectRatio="none"><line x1="35" y1="240" x2="700" y2="240" stroke="#62758c" strokeWidth="1"/><line x1="35" y1="138" x2="700" y2="138" stroke="#3b526b" strokeDasharray="4 6"/><line x1="35" y1="35" x2="700" y2="35" stroke="#3b526b" strokeDasharray="4 6"/>
 {actual.length>1&&<><path d={line('a')} fill="none" stroke={a?color(a.number,a.name):'#e53d4d'} strokeWidth="3" vectorEffect="non-scaling-stroke"/><path d={line('b')} fill="none" stroke={b?color(b.number,b.name):'#398dff'} strokeWidth="3" vectorEffect="non-scaling-stroke"/></>}
 {projectionVisible&&base&&<><path d={`M${xa},${Y(base.a)} L${endX},${Y(ready!.finalA)}`} fill="none" stroke={color(ready!.a.number,ready!.a.name)} strokeWidth="3" strokeDasharray="8 5" vectorEffect="non-scaling-stroke"/><path d={`M${xa},${Y(base.b)} L${endX},${Y(ready!.finalB)}`} fill="none" stroke={color(ready!.b.number,ready!.b.name)} strokeWidth="3" strokeDasharray="8 5" vectorEffect="non-scaling-stroke"/><line x1={endX} y1={Y(ready!.lowA)} x2={endX} y2={Y(ready!.highA)} stroke={color(ready!.a.number,ready!.a.name)} strokeWidth="9" opacity=".4"/><line x1={endX-9} y1={Y(ready!.lowB)} x2={endX-9} y2={Y(ready!.highB)} stroke={color(ready!.b.number,ready!.b.name)} strokeWidth="9" opacity=".4"/><line x1={xa} y1="20" x2={xa} y2="240" stroke="#8193aa" strokeDasharray="3 5"/></>}
 <text x="38" y="21" fill="#9eb4cc" fontSize="12">{fmt(maxV)} votos</text><text x="38" y="258" fill="#9eb4cc" fontSize="11">Registros observados</text>{projectionVisible&&<text x="610" y="258" fill="#9eb4cc" fontSize="11">Cenário final</text>}</svg></div>
 {count<2&&<p className="muted">O histórico precisa de pelo menos duas capturas distintas. Nenhuma linha histórica é inventada. Deixe a página aberta durante novas atualizações.</p>}
 <div className="curves-metrics"><div><small>Votos observados</small><strong>{fmt(nation?.candidates.reduce((sum,c)=>sum+c.votes,0)||0)}</strong></div><div><small>Eleitores pendentes (teto)</small><strong>{model?.kind==='ready'?fmt(model.pending):'—'}</strong></div><div><small>Projeção de votos válidos adicionais</small><strong>{ready?fmt(ready.remainingValid):'—'}</strong></div></div>
 {ready&&<><div className="curves-projected"><div><small>Projeção · {ready.a.name}</small><strong style={{color:color(ready.a.number,ready.a.name)}}>{fmt(ready.finalA)}</strong><small>Cenários: {fmt(ready.lowA)} a {fmt(ready.highA)}</small></div><div><small>Projeção · {ready.b.name}</small><strong style={{color:color(ready.b.number,ready.b.name)}}>{fmt(ready.finalB)}</strong><small>Cenários: {fmt(ready.lowB)} a {fmt(ready.highB)}</small></div></div><label className="curves-sensitivity">Variação hipotética na preferência dos votos pendentes: <b>±{swing} pontos percentuais</b><input type="range" min="0" max="25" step="5" value={swing} onChange={e=>setSwing(Number(e.target.value))}/></label><p className="curves-verdict">{ready.locked==='a'||ready.locked==='b'?'Vitória matematicamente irreversível para '+(ready.locked==='a'?ready.a.name:ready.b.name):ready.locked==='tie'?'Empate com zero eleitores pendentes':'Resultado ainda matematicamente reversível. Não existe probabilidade de vitória validada.'}</p></>}
 {model?.kind==='unavailable'&&<p className="alert">{model.reason} Sem projeção numérica enquanto os requisitos não forem atendidos.</p>}
 <p className="footnote">Método: cada UF e o exterior projetam votos válidos restantes usando a taxa válida por eleitor já apurado e a divisão local observada. A faixa varia a preferência futura em ±{swing} p.p. por território; <b>não é intervalo de confiança estatístico</b> nem previsão calibrada. A irreversibilidade é verificada pelo teto oficial de eleitores pendentes. A projeção exige conciliação entre o total nacional e as 28 abrangências. As linhas observadas são capturas deste navegador, não série histórica oficial.</p>
 </section>;
}
