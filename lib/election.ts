export type Candidate={name:string,votes:number,percentage:number};
export type Election={uf:string,updated:string,sectionsPercent:number|null,sectionsTotal:number|null,sectionsCounted:number|null,validVotes:number|null,turnout:number|null,eligible:number|null,abstentions:number|null,pendingElectors:number|null,candidates:Candidate[],source:string};
const num=(v:unknown):number|null=>{if(v===undefined||v===null||v==='')return null;const n=Number(String(v).replace(',','.'));return Number.isFinite(n)&&n>=0?n:null;};
const pct=(v:unknown):number|null=>{const n=num(v);return n===null?null:n;};
export function parseElection(payload:any,uf:string):Election|null{
 const d=payload?.data;if(!d||!Array.isArray(d.carg))return null;
 const contest=d.carg.find((x:any)=>String(x.cd)==='1');
 if(!contest||!Array.isArray(contest.agr))return null;
 const raw=contest.agr.flatMap((a:any)=>Array.isArray(a.par)?a.par.flatMap((p:any)=>Array.isArray(p.cand)?p.cand:[]):[]);
 const candidates:Candidate[]=raw.map((x:any)=>({name:String(x.nmu||x.nm||'Candidato'),votes:num(x.vap)??0,percentage:pct(x.pvap)??0})).filter((x:Candidate)=>x.votes>0).sort((a:Candidate,b:Candidate)=>b.votes-a.votes);
 const sectionsTotal=num(d.s?.ts),sectionsCounted=num(d.s?.st);
 const sectionsPercent=pct(d.s?.pst)??(sectionsTotal!==null&&sectionsCounted!==null&&sectionsTotal>0?100*sectionsCounted/sectionsTotal:null);
 const eligible=num(d.e?.te),turnout=num(d.e?.c),pendingElectors=num(d.e?.esnt);
 const consistent=eligible!==null&&pendingElectors!==null&&num(d.e?.est)!==null&&eligible===pendingElectors+num(d.e.est)!;
 return {uf,updated:[d.dt,d.ht].filter(Boolean).join(' '),sectionsPercent,sectionsTotal,sectionsCounted,validVotes:num(d.v?.vv),turnout,eligible,abstentions:num(d.e?.a),pendingElectors:consistent?pendingElectors:null,candidates,source:payload.source};
}
export function getMath(e:Election){
 if(e.candidates.length!==2)return null;
 const [leader,other]=e.candidates;const lead=leader.votes-other.votes;
 const pendingUpper=e.pendingElectors;
 if(pendingUpper===null)return {lead,pendingUpper:null,status:'indeterminado' as const,minimumShare:null};
 const status=lead>pendingUpper?'irreversível (limite superior)' as const:'reversão matematicamente possível' as const;
 const minimumShare=pendingUpper>0?50*(1+lead/pendingUpper):null;
 return {lead,pendingUpper,status,minimumShare:minimumShare!==null&&minimumShare<=100?minimumShare:null};
}
export const ufNames:Record<string,string>={BR:'Brasil',AC:'Acre',AL:'Alagoas',AP:'Amapá',AM:'Amazonas',BA:'Bahia',CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',MT:'Mato Grosso',MS:'Mato Grosso do Sul',MG:'Minas Gerais',PA:'Pará',PB:'Paraíba',PR:'Paraná',PE:'Pernambuco',PI:'Piauí',RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RS:'Rio Grande do Sul',RO:'Rondônia',RR:'Roraima',SC:'Santa Catarina',SP:'São Paulo',SE:'Sergipe',TO:'Tocantins'};
export const regions:Record<string,string[]>={Norte:['AC','AP','AM','PA','RO','RR','TO'],Nordeste:['AL','BA','CE','MA','PB','PE','PI','RN','SE'], 'Centro-Oeste':['DF','GO','MT','MS'],Sudeste:['ES','MG','RJ','SP'],Sul:['PR','RS','SC']};
