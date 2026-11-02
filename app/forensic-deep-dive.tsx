'use client';
import {useEffect,useMemo,useState} from 'react';
import {AlertCircle,BarChart3,ChevronDown,Download,ExternalLink,FileText,MapPin,Search,UploadCloud} from 'lucide-react';
import {ufNames,type Election} from '../lib/election';
import {importSections,type SectionImport,type SectionVotes} from '../lib/forensic-csv';

type City={code:string;name:string;ibge:string};
type Zone={zone:string;first:number;second:number;valid:number;turnout:number|null;eligible:number|null;sectionsCounted:number|null;sectionsTotal:number|null;source:string};
type ZonePayload={uf:string;city:string;cityName:string;round:1|2;zones:Zone[];requested:number;totalZones:number;missing:string[];truncated:boolean;source:string;receivedAt:string};
type ZoneRow=Zone&{share:number;deviation:number;relativeImpact:number;deltaMargin:number|null;deltaShare:number|null;exclusive:'Lula'|'Flávio'|null;complete:boolean};
const fmt=(n:number|null|undefined)=>n==null?'—':Math.round(n).toLocaleString('pt-BR');
const signed=(n:number|null|undefined)=>n==null?'—':(n>0?'+':'')+fmt(n);
const pct=(n:number|null|undefined)=>n==null?'—':n.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const SOURCE='https://dadosabertos.tse.jus.br/dataset/resultados-2026';
const TSE_REPORT='https://www.justicaeleitoral.jus.br/fato-ou-boato/checagens/2026/e-falso-que-124-mil-urnas-tenham-registrado-votos-apenas-para-lula-no-2o-turno-das-eleicoes-2026';
const C13='#e53d4d',C22='#398dff';
const DEFAULT_MIN=70;

export default function ForensicDeepDive({currentUf,nation}:{currentUf:string;nation:Election|null}){
 const [tab,setTab]=useState<'zones'|'sections'>('zones');
 const [selectedUf,setSelectedUf]=useState(currentUf==='BR'?'RJ':currentUf);
 const [cities,setCities]=useState<City[]>([]),[city,setCity]=useState(''),[cityFilter,setCityFilter]=useState('');
 const [cityBusy,setCityBusy]=useState(false),[cityError,setCityError]=useState('');
 const [zones2,setZones2]=useState<ZonePayload|null>(null),[zones1,setZones1]=useState<ZonePayload|null>(null);
 const [zoneBusy,setZoneBusy]=useState(false),[zoneError,setZoneError]=useState('');
 const [minValid,setMinValid]=useState(DEFAULT_MIN),[threshold,setThreshold]=useState(20);
 const [view,setView]=useState<'all'|'exclusive'|'extreme'>('all');
 const [zoneSort,setZoneSort]=useState<'impact'|'change'|'deviation'>('impact');
 const [imports,setImports]=useState<Partial<Record<1|2,SectionImport>>>({});
 const [importBusy,setImportBusy]=useState<1|2|null>(null),[importError,setImportError]=useState(''),[progress,setProgress]=useState(0);
 const [sectionMode,setSectionMode]=useState<'exclusive'|'near'|'all'>('exclusive'),[zoneQuery,setZoneQuery]=useState('');
 useEffect(()=>{if(currentUf!=='BR')setSelectedUf(currentUf)},[currentUf]);
 useEffect(()=>{
  let active=true;setCities([]);setCity('');setCityFilter('');setCityError('');setZones1(null);setZones2(null);setZoneError('');setImports({});
  setCityBusy(true);
  fetch('/api/municipalities?uf='+selectedUf).then(async r=>{const json=await r.json();if(!r.ok)throw Error(json.error||'Cadastro indisponível');if(active)setCities(json.cities||[])})
   .catch(e=>{if(active)setCityError(e instanceof Error?e.message:String(e))})
   .finally(()=>{if(active)setCityBusy(false)});
  return()=>{active=false};
 },[selectedUf]);
 useEffect(()=>{setZones1(null);setZones2(null);setZoneError('')},[city]);
 const chooseZone=async()=>{
  if(!city||zoneBusy)return;setZoneBusy(true);setZones1(null);setZones2(null);setZoneError('');
  try{
   const query=new URLSearchParams({uf:selectedUf,city});
   const [one,two]=await Promise.all([1,2].map(async round=>{
    const r=await fetch('/api/forensics/zones?'+query+'&round='+round,{cache:'no-store'});
    const result=await r.json();
    if(!r.ok)throw Error(result.error||'Falha no TSE, turno '+round);
    return result as ZonePayload;
   }));
   setZones1(one);setZones2(two);
  }catch(e){setZoneError(e instanceof Error?e.message:String(e))}
  finally{setZoneBusy(false)}
 };
 const zoneStats=useMemo(()=>{
  if(!zones2)return null;
  const old=new Map((zones1?.zones||[]).map(z=>[z.zone,z]));
  const matched=zones2.zones.filter(z=>z.first+z.second>0);
  const total=matched.reduce((s,z)=>s+z.first+z.second,0);
  const first=matched.reduce((s,z)=>s+z.first,0);
  const second=matched.reduce((s,z)=>s+z.second,0);
  const share=total?first/total:0;
  const zoneRows:ZoneRow[]=matched.map(z=>{
   const valid=z.first+z.second,shareZone=z.first/valid;
   const before=old.get(z.zone),prevValid=before?before.first+before.second:0;
   return {...z,share:shareZone*100,deviation:(shareZone-share)*100,
    relativeImpact:(z.first-z.second)-(2*share-1)*valid,
    deltaMargin:before?(z.first-z.second)-(before.first-before.second):null,
    deltaShare:prevValid?100*(shareZone-before!.first/prevValid):null,
    exclusive:z.first===0?'Flávio':z.second===0?'Lula':null,
    complete:z.sectionsTotal===null||z.sectionsCounted===null?false:z.sectionsCounted===z.sectionsTotal
   };
  });
  const extreme=zoneRows.filter(z=>z.complete&&z.first+z.second>=minValid&&Math.abs(z.deviation)>=threshold);
  const exclusive=zoneRows.filter(z=>z.complete&&z.first+z.second>=minValid&&z.exclusive);
  const oldMatched=matched.map(z=>old.get(z.zone)).filter((z):z is Zone=>!!z);
  const delta=oldMatched.length===matched.length?first-second-oldMatched.reduce((s,z)=>s+z.first-z.second,0):null;
  return {rows:zoneRows,first,second,total,share,extreme,exclusive,delta,priorCoverage:oldMatched.length};
 },[zones2,zones1,minValid,threshold]);
 const visibleZoneRows=useMemo(()=>{
  if(!zoneStats)return [];
  const list=zoneStats.rows.filter(z=>view==='exclusive'?z.exclusive&&z.complete&&z.first+z.second>=minValid:view==='extreme'?z.complete&&z.first+z.second>=minValid&&Math.abs(z.deviation)>=threshold:true);
  return list.sort((a,b)=>zoneSort==='change'?Math.abs(b.deltaMargin||0)-Math.abs(a.deltaMargin||0):zoneSort==='deviation'?Math.abs(b.deviation)-Math.abs(a.deviation):Math.abs(b.relativeImpact)-Math.abs(a.relativeImpact)).slice(0,80);
 },[zoneStats,view,minValid,threshold,zoneSort]);
 const onImport=async(file:File|undefined,round:1|2)=>{
  if(!file||importBusy)return;setImportBusy(round);setProgress(0);setImportError('');
  try{const data=await importSections(file,round,selectedUf,setProgress);setImports(old=>({...old,[round]:data}))}
  catch(e){setImportError(e instanceof Error?e.message:String(e))}
  finally{setImportBusy(null)}
 };
 const sections=useMemo(()=>{
  const source=imports[2]?.sections||[],prior=new Map((imports[1]?.sections||[]).map(s=>[s.key,s]));
  const totalValid=source.reduce((s,x)=>s+x.lula+x.flavio,0);
  const exclusive=source.filter(s=>s.lula+s.flavio>=minValid&&(s.lula===0||s.flavio===0));
  const near=source.filter(s=>{const n=s.lula+s.flavio;return n>=minValid&&Math.max(s.lula,s.flavio)/n>=.95});
  const margin=source.reduce((a,s)=>a+s.lula-s.flavio,0);
  const comparison=source.map(s=>({section:s,previous:prior.get(s.key),valid:s.lula+s.flavio,margin:s.lula-s.flavio,delta:prior.has(s.key)?s.lula-s.flavio-(prior.get(s.key)!.lula-prior.get(s.key)!.flavio):null})).filter(x=>x.valid>0);
  const filtered=comparison.filter(x=>(sectionMode==='exclusive'?x.valid>=minValid&&(x.section.lula===0||x.section.flavio===0):sectionMode==='near'?x.valid>=minValid&&Math.max(x.section.lula,x.section.flavio)/x.valid>=.95:true)&&(!zoneQuery||[x.section.zone,x.section.municipality,x.section.municipalityCode,x.section.section].join(' ').toLocaleLowerCase('pt-BR').includes(zoneQuery.toLocaleLowerCase('pt-BR'))));
  filtered.sort((a,b)=>sectionMode==='all'?Math.abs(b.delta||b.margin)-Math.abs(a.delta||a.margin):b.valid-a.valid);
  return {totalValid,margin,exclusive,near,comparison,filtered:filtered.slice(0,100),filteredCount:filtered.length,matchCount:comparison.filter(x=>x.previous).length};
 },[imports,minValid,sectionMode,zoneQuery]);
 const exportRows=()=>{
  if(!imports[2]||!sections.filteredCount)return;
  const rows=['UF;MUNICIPIO;ZONA;SECAO;VOTOS_LULA;VOTOS_FLAVIO;VALIDOS_2T;SALDO_2T;VARIACAO_SALDO_1T_2T',
   ...sections.filtered.map(({section:s,valid,margin,delta})=>[s.uf,s.municipality,s.zone,s.section,s.lula,s.flavio,valid,margin,delta??''].join(';'))].join('\n');
  const blob=new Blob(['\uFEFF'+rows],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='analise-secoes-'+selectedUf+'.csv';a.click();URL.revokeObjectURL(url);
 };
 const cityOptions=cities.filter(c=>c.name.toLocaleLowerCase('pt-BR').includes(cityFilter.toLocaleLowerCase('pt-BR'))||c.code===city).slice(0,100);
 return <div className="forensic">
  <div className="forensic-heading"><div><div className="eyebrow">OBSERVATÓRIO DE PADRÕES</div><h3>Votações extremas e impactos territoriais</h3></div><span className="forensic-source-tag">Fonte: TSE</span></div>
  <p className="muted forensic-intro">Compare zonas entre os dois turnos e investigue seções com votação unânime ou concentrada. <b>Padrão incomum não é prova de irregularidade.</b> Os cálculos mostram contribuições à margem e diferenças territoriais, não votos fraudulentos.</p>
  <div className="forensic-tabs" role="tablist" aria-label="Níveis de análise">
   <button type="button" role="tab" aria-selected={tab==='zones'} className={tab==='zones'?'active':''} onClick={()=>setTab('zones')}><MapPin size={16}/> Zonas eleitorais</button>
   <button type="button" role="tab" aria-selected={tab==='sections'} className={tab==='sections'?'active':''} onClick={()=>setTab('sections')}><FileText size={16}/> Seções e urnas</button>
  </div>
  <div className="forensic-filters"><label>Estado<select value={selectedUf} onChange={e=>setSelectedUf(e.target.value)}>{Object.entries(ufNames).filter(([k])=>k!=='BR').map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
   <label>Mínimo de votos válidos por unidade<select value={minValid} onChange={e=>setMinValid(Number(e.target.value))}><option value={1}>1 voto</option><option value={30}>30 votos</option><option value={70}>70 votos</option><option value={100}>100 votos</option><option value={200}>200 votos</option></select></label>
  </div>
  {tab==='zones'?<>
   <div className="forensic-controls">
    <label>Filtrar municípios<input type="search" value={cityFilter} onChange={e=>setCityFilter(e.target.value)} placeholder="Nome do município"/></label>
    <label>Município<select value={city} onChange={e=>setCity(e.target.value)} disabled={cityBusy||cities.length===0}><option value="">Selecione o município</option>{city&&cityOptions.every(c=>c.code!==city)&&cities.filter(c=>c.code===city).map(c=><option value={c.code} key={c.code}>{c.name}</option>)}{cityOptions.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
    <button className="forensic-primary" type="button" onClick={chooseZone} disabled={!city||zoneBusy}>{zoneBusy?'Consultando TSE...':'Comparar os dois turnos'}</button>
   </div>
   {cityError&&<p className="forensic-warning">{cityError}</p>}
   {zoneError&&<p className="forensic-warning">{zoneError} Confira o cadastro do TSE ou tente outro município.</p>}
   {!zones2&&!zoneBusy&&!zoneError&&<p className="forensic-empty">Escolha uma cidade e clique em <b>Comparar os dois turnos</b>. O painel busca os resultados oficiais de cada zona, sem valores simulados.</p>}
   {zones2&&zoneStats&&<>
    <div className="forensic-coverage"><b>{zones2.cityName} / {selectedUf}</b><span>{zones2.zones.length}/{zones2.totalZones} zonas recebidas do 2º turno · {zoneStats.priorCoverage}/{zones2.zones.length} com comparação do 1º</span></div>
    {(zones2.truncated||zones2.missing.length>0||zones1&&zones1.missing.length>0)&&<p className="forensic-warning">Cobertura incompleta: {zones2.missing.length} zona(s) sem resposta no 2º turno, {zones1?.missing.length||0} no 1º e {zones2.truncated?'limite de consultas aplicado.':'sem truncamento.'} Os números abaixo valem apenas para as zonas obtidas.</p>}
    <div className="forensic-kpis">
     <div><small>Zonas com voto exclusivo</small><strong>{fmt(zoneStats.exclusive.length)}</strong><span>≥ {minValid} votos, 100% para um candidato</span></div>
     <div><small>Zonas com desvio ≥ {threshold} p.p.</small><strong>{fmt(zoneStats.extreme.length)}</strong><span>vs. média das zonas consultadas da cidade</span></div>
     <div><small>Mudança no saldo 1º → 2º</small><strong>{signed(zoneStats.delta)}</strong><span>Lula menos Flávio, nas zonas pareadas</span></div>
    </div>
    <div className="forensic-controls compact">
     <label>Ver<select value={view} onChange={e=>setView(e.target.value as typeof view)}><option value="all">Todas as zonas</option><option value="exclusive">Votação exclusiva</option><option value="extreme">Desvio da cidade</option></select></label>
     <label>Desvio mínimo<select value={threshold} onChange={e=>setThreshold(Number(e.target.value))}><option value={10}>10 p.p.</option><option value={15}>15 p.p.</option><option value={20}>20 p.p.</option><option value={30}>30 p.p.</option><option value={40}>40 p.p.</option></select></label>
     <label>Ordenar<select value={zoneSort} onChange={e=>setZoneSort(e.target.value as typeof zoneSort)}><option value="impact">Maior desvio em votos</option><option value="change">Maior variação entre turnos</option><option value="deviation">Maior desvio em p.p.</option></select></label>
    </div>
    <div className="forensic-rows">
     {visibleZoneRows.length===0?<p className="forensic-empty">Nenhuma zona atende aos filtros neste recorte. Isso não significa que não existam seções com votos exclusivos dentro das zonas.</p>:visibleZoneRows.map(z=><div className="forensic-row" key={z.zone}>
      <div className="forensic-rowhead"><b>Zona {Number(z.zone)}</b><span>{z.exclusive?'100% dos válidos: '+z.exclusive:z.complete?'Seções totalizadas':'Totalização parcial'}</span><a href={z.source} target="_blank" rel="noreferrer" title="Resultado da zona no TSE">TSE <ExternalLink size={13}/></a></div>
      <div className="forensic-votebar" role="img" aria-label={'Lula '+fmt(z.first)+' votos; Flávio '+fmt(z.second)+' votos'}><span style={{width:z.share+'%',background:C13}}/><span style={{flex:1,background:C22}}/></div>
      <div className="forensic-duo"><span style={{color:C13}}>Lula {fmt(z.first)} · {pct(z.share)}</span><span style={{color:C22}}>Flávio {fmt(z.second)} · {pct(100-z.share)}</span></div>
      <div className="forensic-rowmetrics"><span>Saldo na zona <b>{signed(z.first-z.second)}</b></span><span>Δ margem entre turnos <b>{signed(z.deltaMargin)}</b></span><span>Desvio da cidade <b>{z.deviation>0?'+':''}{pct(z.deviation)}</b></span><span>Impacto relativo ao padrão local <b>{signed(z.relativeImpact)}</b></span></div>
     </div>)}
    </div>
    {zoneStats.rows.length>80&&<p className="footnote">Mostrando até 80 zonas com maior destaque pelo critério selecionado.</p>}
    <p className="footnote">Desvio em p.p. = porcentagem de Lula na zona − porcentagem de Lula nas zonas consultadas do município (entre votos 13 e 22). Impacto relativo = saldo real (13 − 22) menos saldo esperado se a zona tivesse a proporção média municipal, mantendo seu total de votos. Impactos positivos favorecem Lula em relação à média; negativos favorecem Flávio. <b>Não representam votos inválidos nem alteração comprovada.</b> A mudança no saldo entre turnos inclui votos de candidatos eliminados, comparecimento e mudanças de voto, não transferências individuais.</p>
   </>}
  </>:<>
   <div className="forensic-official-reference"><AlertCircle size={18}/><div><b>Referência nacional divulgada pela Justiça Eleitoral</b><p>No 2º turno, o TSE informou 110 seções com todos os votos válidos para um candidato: <b>106 para Lula (14.860 votos)</b> e <b>4 para Flávio (296 votos)</b>, entre 499.205 seções com votos. Trata-se de uma referência publicada pelo TSE, não da análise dos seus arquivos importados.</p><a href={TSE_REPORT} target="_blank" rel="noreferrer">Ver levantamento oficial <ExternalLink size={13}/></a></div></div>
   <p className="muted">Para identificar cada urna e calcular o impacto, importe os CSVs descompactados do TSE. O processamento ocorre <b>no seu navegador</b>; os arquivos não são enviados ao servidor.</p>
   <div className="forensic-upload-grid">{([1,2] as const).map(round=><label className="forensic-upload" key={round}><UploadCloud size={22}/><b>{round}º turno</b><small>{imports[round]?imports[round]!.fileName:importBusy===round?'Lendo arquivo '+progress+'%':'Selecionar arquivo .CSV'}</small><input type="file" accept=".csv,.txt,text/csv" disabled={importBusy!==null} onChange={e=>{void onImport(e.target.files?.[0],round);e.target.value=''}}/><span>{imports[round]?fmt(imports[round]!.sections.length)+' seções lidas':'Escolher CSV descompactado'}</span></label>)}</div>
   {importBusy&&<div className="forensic-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{width:progress+'%'}}/></div>}
   {importError&&<p className="forensic-warning">{importError}</p>}
   <p className="footnote">Fonte recomendada: <a href={SOURCE} target="_blank" rel="noreferrer">Resultados 2026 · Votação por seção eleitoral no TSE <ExternalLink size={12}/></a>. Escolha arquivos CSV do estado {selectedUf}, com campos NR_TURNO, SG_UF, CD_CARGO, NR_VOTAVEL e QT_VOTOS. Não importamos ZIP diretamente; descompacte antes. A correspondência entre turnos usa UF, município, zona e seção.</p>
   {imports[2]?<>
    <div className="forensic-coverage"><b>Análise carregada: {selectedUf}</b><span>{fmt(imports[2]!.sections.length)} seções no 2º turno · {fmt(sections.matchCount)} com registro correspondente no 1º</span></div>
    <div className="forensic-kpis">
     <div><small>Seções exclusivas · Lula</small><strong style={{color:C13}}>{fmt(sections.exclusive.filter(s=>s.flavio===0).length)}</strong><span>{fmt(sections.exclusive.filter(s=>s.flavio===0).reduce((n,s)=>n+s.lula,0))} votos válidos</span></div>
     <div><small>Seções exclusivas · Flávio</small><strong style={{color:C22}}>{fmt(sections.exclusive.filter(s=>s.lula===0).length)}</strong><span>{fmt(sections.exclusive.filter(s=>s.lula===0).reduce((n,s)=>n+s.flavio,0))} votos válidos</span></div>
     <div><small>Participação no saldo observado</small><strong>{fmt(sections.exclusive.reduce((n,s)=>n+s.lula-s.flavio,0))}</strong><span>Margem líquida das seções exclusivas neste arquivo</span></div>
    </div>
    <p className="forensic-note">As estatísticas acima valem para as seções presentes no CSV de {selectedUf}, com pelo menos {minValid} votos válidos. O total nacional do TSE inclui seções menores e todas as UFs.</p>
    <div className="forensic-controls compact">
     <label>Mostrar<select value={sectionMode} onChange={e=>setSectionMode(e.target.value as typeof sectionMode)}><option value="exclusive">100% para um candidato</option><option value="near">95% ou mais para um</option><option value="all">Todas as seções importadas</option></select></label>
     <label>Busca<input value={zoneQuery} onChange={e=>setZoneQuery(e.target.value)} placeholder="Município, zona ou seção"/></label>
     <button className="forensic-secondary" type="button" onClick={exportRows} disabled={!sections.filteredCount}><Download size={15}/> Exportar lista</button>
    </div>
    <div className="forensic-rows">{sections.filtered.length===0?<p className="forensic-empty">Nenhuma seção encontrada com esses critérios.</p>:sections.filtered.map(({section:s,valid,margin,delta})=><div className="forensic-row" key={s.key}>
     <div className="forensic-rowhead"><b>{s.municipality}</b><span>Zona {Number(s.zone)} · Seção {Number(s.section)}</span></div>
     <div className="forensic-votebar"><span style={{width:100*s.lula/valid+'%',background:C13}}/><span style={{flex:1,background:C22}}/></div>
     <div className="forensic-duo"><span style={{color:C13}}>Lula {fmt(s.lula)}</span><span style={{color:C22}}>Flávio {fmt(s.flavio)}</span></div>
     <div className="forensic-rowmetrics"><span>Válidos <b>{fmt(valid)}</b></span><span>Saldo 2º turno <b>{signed(margin)}</b></span><span>Mudança no saldo 1º → 2º <b>{signed(delta)}</b></span><span>Brancos / nulos <b>{fmt(s.blank)} / {fmt(s.nullVotes)}</b></span></div>
    </div>)}</div>
    {sections.filteredCount>100&&<p className="footnote">Exibindo 100 de {fmt(sections.filteredCount)} seções filtradas. O CSV exportado contém essas 100 linhas visíveis.</p>}
    <p className="footnote">Seção com 100% para um dos dois candidatos significa zero votos válidos para o outro. Comparecimento, brancos e nulos podem existir. Saldo = Lula − Flávio; variação do saldo = saldo no 2º turno − saldo no 1º, quando há correspondência de seção. O arquivo importado não é verificado criptograficamente; confira cada caso no BU oficial. Um padrão extremo não constitui prova de irregularidade.</p>
   </>:<p className="forensic-empty">Importe ao menos o CSV do 2º turno para ver as urnas, os casos unânimes e os impactos. Adicione o 1º turno para medir a mudança entre as duas votações.</p>}
  </>}
  <div className="forensic-disclaimer"><b>Como interpretar:</b> este é um instrumento de exploração de resultados. Não faz atribuições de fraude, não estima eleitores que mudaram de voto e não determina irregularidade pela distribuição estatística isoladamente. Inconsistências documentais precisam ser confrontadas com os boletins de urna e registros oficiais.</div>
 </div>;
}
