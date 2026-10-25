'use client';
import {useMemo,useState} from 'react';
import type {Election} from '../lib/election';

type Snapshot={t:string,a:number,b:number,ts?:number,firstNumber?:string,secondNumber?:string,progress?:number};
const keys=['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO','ZZ'];
const fmt=(n:number)=>Math.round(n).toLocaleString('pt-BR');
const pct=(n:number)=>n.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const color=(n:string,name:string)=>n==='13'||name.toLowerCase().includes('lula')?'#e53d4d':n==='22'||name.toLowerCase().includes('bolsonaro')?'#398dff':'#92a4b9';
export default function ProjectionCurves({nation,places,history,uf,citySelected}:{nation:Election|null;places:Record<string,Election>;history:Snapshot[];uf:string;citySelected:boolean}){
 const [swing,setSwing]=useState(10);
 const [showProjection,setShowProjection]=useState(true);
 const model=useMemo(()=>{
  if(!nation||nation.candidates.length!==2)return null;
  const [a,b]=nation.candidates;
  const counted=a.votes+b.votes;
  const pending=nation.pendingElectors;
  if(pending===null||!Number.isFinite(pending)||pending<0)return {kind:'unavailable' as const,reason:'Sem limite oficial verificável de eleitores pendentes.'};
  const validStates=keys.map(k=>places[k]);
  if(validStates.some(e=>!e||e.pendingElectors===null||e.eligible===null))return {kind:'unavailable' as const,reason:'A projeção territorial exige as 27 UFs e o exterior com eleitores pendentes consistentes.'};
  let totalPending=0,forecastA=0,forecastB=0,lowA=0,highA=0,remainingValid=0;
  for(const maybe of validStates){
   const e=maybe!;
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
  // Legacy snapshots lack candidate IDs; their ordering can invert when the leader changes.
  // Never display those as if their candidate identity were known.
  const observed=history.filter(x=>x.firstNumber&&x.secondNumber&&x.firstNumber!==x.secondNumber&&Number.isFinite(x.progress)&&x.progress!>=0&&x.progress!<=100&&Number.isFinite(x.a)&&Number.isFinite(x.b)).map(x=>({
   a:x.firstNumber===a.number?x.a:x.secondNumber===a.number?x.b:NaN,
   b:x.firstNumber===b.number?x.a:x.secondNumber===b.number?x.b:NaN,
   progress:x.progress!,t:x.t
  })).filter(x=>Number.isFinite(x.a)&&Number.isFinite(x.b));
  if(nation.sectionsPercent!==null&&Number.isFinite(nation.sectionsPercent))observed.push({a:a.votes,b:b.votes,progress:nation.sectionsPercent,t:nation.updated});
  const byProgress=new Map<number,{a:number,b:number,progress:number,t:string}>();
  for(const x of observed)byProgress.set(x.progress,x);
  return [...byProgress.values()].sort((x,y)=>x.progress-y.progress).slice(-120);
 },[history,nation]);
 const ready=model?.kind==='ready'?model:null;
 const a=nation?.candidates[0],b=nation?.candidates[1];
 const current=actual[actual.length-1];
 const projectionVisible=uf==='BR'&&!citySelected&&ready!==null&&current!==undefined&&showProjection&&current.progress<100;
 const chartMax=Math.max(1,...actual.flatMap(p=>[p.a,p.b]),projectionVisible?ready!.highA:0,projectionVisible?ready!.highB:0);
 const upper=Math.ceil(chartMax/1000000)*1000000;
 const left=72,right=714,top=20,bottom=244;
 const X=(p:number)=>left+(right-left)*p/100;
 const Y=(n:number)=>bottom-(bottom-top)*n/upper;
 const line=(key:'a'|'b')=>actual.map((p,i)=>(i?'L':'M')+X(p.progress).toFixed(1)+','+Y(p[key]).toFixed(1)).join(' ');
 const compact=(n:number)=>n>=1000000?(n/1000000).toLocaleString('pt-BR',{maximumFractionDigits:1})+' mi':n>=1000?(n/1000).toLocaleString('pt-BR',{maximumFractionDigits:0})+' mil':fmt(n);
 return <section className="panel curves-panel"><div className="sectionhead"><div><div className="eyebrow">CURVAS DE APURAÇÃO</div><h2>Votos registrados e projeção final</h2></div></div>
 <div className="curves-legend">{a&&<span style={{color:color(a.number,a.name)}}>● {a.name}</span>}{b&&<span style={{color:color(b.number,b.name)}}>● {b.name}</span>}<span>— observado</span><span>┄ cenário projetado</span></div>
 <label className="curves-projection-toggle"><input type="checkbox" checked={showProjection} onChange={e=>setShowProjection(e.target.checked)}/> Exibir cenário futuro (hipótese, não previsão validada)</label>
 <div className="curves-chart"><svg viewBox="0 0 760 295" role="img" aria-label="Votos acumulados por percentual de seções totalizadas, com cenários finais separados" preserveAspectRatio="xMidYMid meet">
 {projectionVisible&&<rect x={X(current.progress)} y={top} width={right-X(current.progress)} height={bottom-top} fill="#7e9cbd" opacity=".09"/>}
 {[0,.25,.5,.75,1].map((v,i)=><g key={'y'+i}><line x1={left} y1={Y(upper*v)} x2={right} y2={Y(upper*v)} stroke="#314761" strokeDasharray={i?'4 6':'0'}/><text x={left-9} y={Y(upper*v)+4} textAnchor="end" fill="#a5bad3" fontSize="12">{compact(upper*v)}</text></g>)}
 {[0,25,50,75,100].map(v=><g key={'x'+v}><line x1={X(v)} y1={bottom} x2={X(v)} y2={bottom+5} stroke="#667e9c"/><text x={X(v)} y={bottom+22} textAnchor="middle" fill="#a5bad3" fontSize="12">{v}%</text></g>)}
 {actual.length>1&&<><path d={line('a')} fill="none" stroke={a?color(a.number,a.name):'#e53d4d'} strokeWidth="3" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/><path d={line('b')} fill="none" stroke={b?color(b.number,b.name):'#398dff'} strokeWidth="3" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/></>}
 {current&&<><circle cx={X(current.progress)} cy={Y(current.a)} r="5" fill={a?color(a.number,a.name):'#e53d4d'} stroke="#0c192a" strokeWidth="2"/><circle cx={X(current.progress)} cy={Y(current.b)} r="5" fill={b?color(b.number,b.name):'#398dff'} stroke="#0c192a" strokeWidth="2"/></>}
 {projectionVisible&&<><path d={`M${X(current.progress)},${Y(current.a)} L${right},${Y(ready!.finalA)}`} fill="none" stroke={color(ready!.a.number,ready!.a.name)} strokeWidth="2.5" strokeDasharray="6 7" opacity=".8" vectorEffect="non-scaling-stroke"/><path d={`M${X(current.progress)},${Y(current.b)} L${right},${Y(ready!.finalB)}`} fill="none" stroke={color(ready!.b.number,ready!.b.name)} strokeWidth="2.5" strokeDasharray="6 7" opacity=".8" vectorEffect="non-scaling-stroke"/><line x1={right} y1={Y(ready!.lowA)} x2={right} y2={Y(ready!.highA)} stroke={color(ready!.a.number,ready!.a.name)} strokeWidth="9" opacity=".35"/><line x1={right-8} y1={Y(ready!.lowB)} x2={right-8} y2={Y(ready!.highB)} stroke={color(ready!.b.number,ready!.b.name)} strokeWidth="9" opacity=".35"/><line x1={X(current.progress)} y1={top} x2={X(current.progress)} y2={bottom} stroke="#c2d1e5" strokeDasharray="3 6" opacity=".65"/></>}
 <text x={(left+right)/2} y="290" textAnchor="middle" fill="#a5bad3" fontSize="12">Seções totalizadas</text>
 </svg></div>
 {actual.length<2&&<p className="curves-notice">{actual.length===1?"Há somente um ponto oficial observado. O gráfico marca esse ponto; a linha tracejada é um cenário, não uma tendência histórica.":"Aguardando um registro com percentual de seções totalizadas. Nenhum ponto histórico foi inventado."}</p>}
 <div className="curves-metrics"><div><small>Votos observados</small><strong>{fmt(nation?.candidates.reduce((sum,c)=>sum+c.votes,0)||0)}</strong></div><div><small>Eleitores pendentes (teto)</small><strong>{model?.kind==='ready'?fmt(model.pending):'—'}</strong></div><div><small>Projeção de votos válidos adicionais</small><strong>{ready?fmt(ready.remainingValid):'—'}</strong></div></div>
 {ready&&<><div className="curves-projected"><div><small>Projeção · {ready.a.name}</small><strong style={{color:color(ready.a.number,ready.a.name)}}>{fmt(ready.finalA)}</strong><small>Cenários: {fmt(ready.lowA)} a {fmt(ready.highA)}</small></div><div><small>Projeção · {ready.b.name}</small><strong style={{color:color(ready.b.number,ready.b.name)}}>{fmt(ready.finalB)}</strong><small>Cenários: {fmt(ready.lowB)} a {fmt(ready.highB)}</small></div></div><label className="curves-sensitivity">Variação hipotética na preferência dos votos pendentes: <b>±{swing} pontos percentuais</b><input type="range" min="0" max="25" step="5" value={swing} onChange={e=>setSwing(Number(e.target.value))}/></label><p className="curves-verdict">{ready.locked==='a'||ready.locked==='b'?'Vitória matematicamente irreversível para '+(ready.locked==='a'?ready.a.name:ready.b.name):ready.locked==='tie'?'Empate com zero eleitores pendentes':'Resultado ainda matematicamente reversível. Não existe probabilidade de vitória validada.'}</p></>}
 {model?.kind==='unavailable'&&<p className="alert">{model.reason} Sem projeção numérica enquanto os requisitos não forem atendidos.</p>}
 <p className="footnote">Método: cada UF e o exterior projetam votos válidos restantes usando a taxa válida por eleitor já apurado e a divisão local observada. A faixa varia a preferência futura em ±{swing} p.p. por território; <b>não é intervalo de confiança estatístico</b> nem previsão calibrada. A irreversibilidade é verificada pelo teto oficial de eleitores pendentes. A projeção exige conciliação entre o total nacional e as 28 abrangências. As linhas observadas são capturas deste navegador, não série histórica oficial.</p>
 </section>;
}
